// ─── PS42 Luanda — Motor de Elegibilidade ─────────────────────────────────
// Implementa os 8 critérios do Artigo 3.º do Regulamento

import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { createIntraClient } from "@/lib/intra";

// ── Tipos ─────────────────────────────────────────────────────────────────

export interface EligibilityCriterion {
    id: string;
    label: string;
    article: string;
    passed: boolean;
    reason?: string; // Motivo se falhou
}

export interface EligibilityResult {
    isEligible: boolean;
    criteria: EligibilityCriterion[];
    checkedAt: string;
    cacheHit: boolean;
}

const CACHE_TTL = 900; // 15 minutos em segundos
const LUANDA_CURSUS_ID = 21; // cursus_id do 42cursus — confirmar com staff

// ── Motor Principal ───────────────────────────────────────────────────────

// checkEligibility() é a função principal que avalia a elegibilidade de um usuário com base nos critérios definidos no Artigo 3.º do Regulamento,
// verificando o cache Redis para resultados anteriores, buscando dados necessários da API da 42 Intra e do banco de dados,
// avaliando cada critério e atualizando o status de elegibilidade no banco de dados e cache Redis.
export async function checkEligibility(
    userId: string,
    intraId: number,
    accessToken: string,
): Promise<EligibilityResult> {
    // 1. Verificar cache Redis
    const cacheKey = `eligibility:${userId}`;
    try {
        const cached = await redis.get<EligibilityResult>(cacheKey);
        if (cached) return { ...cached, cacheHit: true };
    } catch (e) {
        // Cache indisponível — continuar sem cache
        console.error("Erro ao acessar o cache Redis:", e);
    }

    // 2. Buscar dados necessários em paralelo
    const intra = createIntraClient(accessToken, userId, intraId);

    const [cursusData, projects, scaleTeams, dbUser, activeRecords] =
        await Promise.all([
            intra.getMyCursus().catch(() => []), // Cursus do usuário, incluindo nível e progresso
            intra.getMyProjects().catch(() => []), // Projetos do usuário, para avaliar atrasos e falhas
            intra.getMyScaleTeams().catch(() => []), // Avaliações recentes do usuário, para calcular a média de avaliações
            prisma.user.findUnique({ where: { id: userId } }), // Dados do usuário na nossa base de dados, incluindo role, isEligible e isBlocked
            prisma.disciplinaryRecord.findMany({
                // Registros disciplinares activos do usuário, para avaliar sanções e bloqueios, filtrando apenas aqueles que estão activos (isActive: true) para garantir que apenas sanções em vigor sejam consideradas na avaliação de elegibilidade.
                where: { userId, isActive: true },
            }),
        ]);

    // console.log("cursusData:", cursusData);
    // console.log("projects:", projects);
    // console.log("scaleTeams:", scaleTeams);
    // console.log("dbUser:", dbUser);
    // console.log("activeRecords:", activeRecords);

    // Cursus principal (42cursus)
    const mainCursus = cursusData.find((c) => c.cursus_id === LUANDA_CURSUS_ID);

    // 3. Avaliar cada critério do Art. 3.º ────────────────────────────────────

    const criteria: EligibilityCriterion[] = [
        // Art. 3a — Ser Cadete da 42 Luanda
        {
            id: "a_cadete",
            label: "Cadete da 42 Luanda",
            article: "Art. 3.º-a",
            passed: !!dbUser && dbUser.role === "STUDENT", // Verifica se o usuário existe na base de dados e tem o papel de STUDENT, garantindo que apenas cadetes (estudantes) sejam elegíveis para participar, e retornando false para qualquer usuário que não atenda a esses critérios, com um motivo específico para falha.
            reason: !dbUser
                ? "Utilizador não encontrado no sistema" // Se o usuário existe mas não é um estudante, retorna um motivo específico para falha, indicando que apenas estudantes têm acesso.
                : dbUser.role !== "STUDENT"
                  ? "Apenas estudantes têm acesso"
                  : undefined,
        },

        // Art. 3b — Concluído a 2ª Órbita do Holy Graph
        {
            id: "b_orbita",
            label: "2ª Órbita do Holy Graph",
            article: "Art. 3.º-b",
            passed: (mainCursus?.level ?? 0) >= 3, // nível 3+ ≈ 2ª órbita concluída
            reason: !mainCursus
                ? "Cursus 42 não encontrado"
                : mainCursus.level < 3
                  ? `Nível actual: ${mainCursus.level.toFixed(2)} (mín: 3.00)`
                  : undefined,
        },

        // Art. 3c — Ritmo ≤ 22
        {
            id: "c_ritmo",
            label: "Ritmo ≤ 22",
            article: "Art. 3.º-c",
            passed: (mainCursus?.level ?? 99) <= 22, // Se o nível do usuário no cursus principal for superior a 22, considera-se que ele tem um ritmo de progresso muito acelerado, o que pode indicar que ele está avançando rapidamente pelos conteúdos sem consolidar o aprendizado, e retorna false para qualquer usuário que exceda esse limite, com um motivo específico para falha indicando o nível actual.
            reason:
                (mainCursus?.level ?? 0) > 22
                    ? `Nível ${mainCursus?.level.toFixed(2)} excede o limite de 22`
                    : undefined,
        },

        // Art. 3d — Média de avaliações > 3/mês
        {
            id: "d_avaliacoes",
            label: "Média avaliações > 3/mês",
            article: "Art. 3.º-d",
            passed: (() => {
                const validEvals = scaleTeams.filter(
                    (s) => s.final_mark !== null,
                );
                if (validEvals.length === 0) return false;
                // Calcula a média das avaliações finais (final_mark) das equipes de avaliação válidas,
                // garantindo que apenas as avaliações com uma nota final definida sejam consideradas no cálculo da média,
                // e retornando true se a média for superior a 3, ou false caso contrário, com um motivo específico para falha se não houver avaliações válidas.
                const avg =
                    validEvals.reduce((s, e) => s + (e.final_mark ?? 0), 0) /
                    validEvals.length;
                return avg > 3;
            })(),
            reason: (() => {
                const validEvals = scaleTeams.filter(
                    (s) => s.final_mark !== null,
                );
                if (validEvals.length === 0)
                    return "Sem avaliações nos últimos 30 dias";
                const avg =
                    validEvals.reduce((s, e) => s + (e.final_mark ?? 0), 0) /
                    validEvals.length;
                return avg <= 3
                    ? `Média actual: ${avg.toFixed(1)} (mín: 3.0)`
                    : undefined;
            })(),
        },

        // Art. 3e — Sem histórico disciplinar grave
        {
            id: "e_disciplinar",
            label: "Sem histórico disciplinar grave",
            article: "Art. 3.º-e",
            // some(r) verifica se existe pelo menos um registro disciplinar activo do tipo 'SUSPENSION' ou 'EXPULSION',
            // garantindo que qualquer usuário com uma sanção disciplinar grave em vigor seja considerado inelegível,
            // e retornando false se houver uma sanção activa, com um motivo específico para falha indicando o tipo de sanção activa.
            passed: !activeRecords.some(
                (r) => r.type === "SUSPENSION" || r.type === "EXPULSION",
            ),
            reason: activeRecords.some((r) => r.type === "EXPULSION")
                ? "Expulsão activa no sistema"
                : activeRecords.some((r) => r.type === "SUSPENSION")
                  ? "Suspensão activa no sistema"
                  : undefined,
        },

        // Art. 3f — Situação académica regular
        {
            id: "f_academico",
            label: "Situação académica regular",
            article: "Art. 3.º-f",
            passed: (() => {
                // Ordena os projectos por data de atualização (updated_at) do mais recente para o mais antigo,
                // garantindo que a avaliação de atrasos e falhas seja feita com base nos projectos mais recentes,
                // e considerando apenas os projectos finalizados para avaliar atrasos e falhas,
                // retornando true se o número de projectos falhados for inferior a 3, ou false caso contrário,
                // com um motivo específico para falha se houver 3 ou mais projectos falhados.
                const sortedProjects = [...projects].sort(
                    (a, b) =>
                        new Date(b.updated_at).getTime() -
                        new Date(a.updated_at).getTime(),
                );

                // Filtra os projectos para identificar aqueles que estão finalizados (status === 'finished')
                // e não foram validados (validated? === false) com uma nota final inferior a 50,
                // garantindo que apenas os projectos que atendem a esses critérios sejam considerados como falhas graves,
                // e retornando true se o número de projectos falhados for inferior a 3, ou false caso contrário, com um motivo específico para falha se houver 3 ou mais projectos falhados.
                // final_mark null = projecto em andamento, então consideramos apenas os projectos com final_mark definido para avaliar falhas.

                const failed = sortedProjects.filter(
                    (p) =>
                        p.status === "finished" && // O projecto já terminou
                        p["validated?"] === false && // O sistema confirmou que NÃO passou
                        p.final_mark !== null && // Tem uma nota atribuída
                        p.final_mark < 50, // A nota é inferior a 50
                );

                return failed.length < 3; // < 3 projectos falhados consecutivos
            })(),
            reason: "Atrasos graves em projectos detectados",
        },

        // Art. 3g — Comportamento adequado (baseado em reports resolvidos)
        {
            id: "g_conduta",
            label: "Comportamento adequado",
            article: "Art. 3.º-g",
            passed: !dbUser?.isBlocked, // Verifica se o usuário não está bloqueado, garantindo que qualquer usuário que tenha sido bloqueado pelo staff por motivos de conduta inadequada seja considerado inelegível, e retornando false se o usuário estiver bloqueado, com um motivo específico para falha indicando que o acesso foi bloqueado pelo staff.
            reason: dbUser?.isBlocked
                ? "Acesso bloqueado pelo staff"
                : undefined,
        },

        // Art. 3h — Sem sanção disciplinar em vigor
        {
            id: "h_sancao",
            label: "Sem sanção disciplinar em vigor",
            article: "Art. 3.º-h",
            passed: !activeRecords.some((r) => {
                if (!r.isActive) return false; // Apenas sanções activas contam
                if (!r.validUntil) return r.type !== "WARNING"; // Warnings sem data de validade não bloqueiam, mas Suspensions e Expulsions sem data de validade bloqueiam
                return new Date(r.validUntil) > new Date();
            }),
            reason: "Sanção disciplinar activa e dentro do prazo",
        },
    ];

    const isEligible = criteria.every((c) => c.passed);
    const result: EligibilityResult = {
        isEligible,
        criteria,
        checkedAt: new Date().toISOString(),
        cacheHit: false,
    };

    // 4. Actualizar DB + cachear resultado
    await Promise.all([
        prisma.user.update({
            where: { id: userId },
            data: {
                isEligible,
                eligibilityNote: isEligible
                    ? null
                    : criteria
                          .filter((c) => !c.passed)
                          .map((c) => c.label)
                          .join(", "),
                lastSyncAt: new Date(),
            },
        }),
        // Cachear resultado no Redis com TTL, garantindo que os resultados de elegibilidade sejam armazenados em cache para acesso rápido,
        // e que o cache seja actualizado sempre que a função de verificação de elegibilidade for executada,
        // com um tempo de expiração definido para garantir que os dados não fiquem desatualizados.
        redis
            .set(cacheKey, result, { ex: CACHE_TTL })
            .catch((err) => console.error("Erro ao gravar no Upstash:", err)),
    ]);

    return result;
}

// ── Verificar bloqueio por horário/exames ─────────────────────────────────

export function isWithinOperatingHours(): {
    allowed: boolean;
    reason?: string;
} {
    const now = new Date();
    const day = now.getDay(); // 0=Dom, 1=Seg, ..., 5=Sex, 6=Sáb
    const hour = now.getHours();

    // Art. 4a — Seg a Sex: 08h às 17h
    if (day === 0 || day === 6) {
        return {
            allowed: false,
            reason: "A PlayStation não está disponível ao fim-de-semana.",
        };
    }
    if (hour < 8 || hour >= 17) {
        return {
            allowed: false,
            reason: "Fora do horário. Disponível Seg-Sex das 08h00 às 17h00.",
        };
    }

    return { allowed: true };
}
