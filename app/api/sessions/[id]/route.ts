//  api/sessions/[id]/route.ts

/**
 *  API Routes para aprovar, rejeitar, iniciar, terminar e estender sessões.
 *  Inclui todas as validações do regulamento: horário, elegibilidade, 30 minutos de antecedência.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
    SESSION_ACTIONS,
    canApplyAction,
    getAuditAction,
    getUpdateData,
    removesFromQueue,
    reindexQueuePositions,
    requiresStaffRole,
    type SessionAction,
} from "@/lib/session-workflow";

const SessionActionSchema = z.object({
    action: z.enum(SESSION_ACTIONS), // Valida que a acção é uma das permitidas
    note: z.string().max(500).optional(), // Nota opcional para ações de staff, com limite de 500 caracteres
});

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;

    const session = await auth();
    if (!session?.user)
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const parsed = SessionActionSchema.safeParse(
        await request.json().catch(() => ({})),
    );

    if (!parsed.success) {
        return NextResponse.json({ error: "Acção inválida" }, { status: 400 });
    }

    const { action, note } = parsed.data;
    const isStaff = ["STAFF", "ADMIN"].includes(session.user.role);

    if (requiresStaffRole(action) && !isStaff) {
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // Transação para garantir consistência e lidar com concorrência
    let txResult:
        | {
              updated: Awaited<ReturnType<typeof prisma.session.update>>; // Tipo do objeto retornado pela actualização da sessão
              previousStatus: string; // Status da sessão antes da actualização, para fins de auditor
          }
        | undefined;

    // Tentativa de transação com retry em caso de conflito de concorrência
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const result = await prisma.$transaction(
                async (tx) => {

                    // Recarregar a sessão dentro da transação para garantir dados consistentes
                    const current = await tx.session.findUnique({
                        where: { id },
                    });

                    if (!current) return { error: "NOT_FOUND" as const };

                    // Verificar se o utilizador é o dono da sessão ou um staff (para cancelamento)
                    const isOwner = current.userId === session.user.id;
                    if (action === "cancel" && !isStaff && !isOwner) {
                        return { error: "FORBIDDEN" as const };
                    }

                    // Verificar se a acção é permitida no estado actual da sessão
                    if (!canApplyAction(current.status, action)) {
                        return {
                            error: "INVALID_STATE" as const,
                            currentStatus: current.status,
                        };
                    }

                    // Se a acção for "start", verificar se já existe uma sessão activa
                    if (action === "start") {
                        const activeSession = await tx.session.findFirst({
                            where: { status: "ACTIVE" },
                            select: { id: true },
                        });

                        if (activeSession && activeSession.id !== current.id) {
                            return { error: "ACTIVE_EXISTS" as const };
                        }
                    }

                    // Gerar os dados de actualização com base na acção e se o actor é staff ou não
                    const updateData = getUpdateData(
                        action as SessionAction,
                        isStaff,
                        note,
                    );

                    // Actualizar a sessão com os novos dados
                    const updated = await tx.session.update({
                        where: { id },
                        data: updateData,
                    });

                    // Se a acção remover a sessão da fila, reindexar as posições da fila
                    if (removesFromQueue(action as SessionAction)) {
                        await reindexQueuePositions(tx);
                    }

                    // Criar um registo de auditoria para esta acção, incluindo os dados antes e depois da actualização
                    await tx.auditLog.create({
                        data: {
                            actorId: session.user.id,
                            action: getAuditAction(action as SessionAction),
                            entityType: "Session",
                            entityId: id,
                            beforeData: {
                                status: current.status,
                                queuePos: current.queuePos,
                            },
                            afterData: {
                                status: updated.status,
                                queuePos: updated.queuePos,
                            },
                        },
                    });

                    // Retornar os dados actualizados e o status anterior para uso posterior (ex: notificações)
                    return {
                        updated,
                        previousStatus: current.status,
                    };
                },
                // Usar isolamento serializável para evitar condições de corrida
                { isolationLevel: "Serializable" },
            );

            if ("error" in result) {
                if (result.error === "NOT_FOUND") {
                    return NextResponse.json(
                        { error: "Sessão não encontrada" },
                        { status: 404 },
                    );
                }

                if (result.error === "FORBIDDEN") {
                    return NextResponse.json(
                        { error: "Sem permissão" },
                        { status: 403 },
                    );
                }

                if (result.error === "ACTIVE_EXISTS") {
                    return NextResponse.json(
                        { error: "Já existe uma sessão activa em curso" },
                        { status: 409 },
                    );
                }

                if (result.error === "INVALID_STATE") {
                    return NextResponse.json(
                        {
                            error: `Acção '${action}' não permitida no estado '${result.currentStatus}'`,
                        },
                        { status: 409 },
                    );
                }
            }

            txResult = result;
            break;
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2034" &&
                attempt === 0
            ) {
                continue;
            }
            throw error;
        }
    }

    if (!txResult) {
        return NextResponse.json(
            { error: "Conflito de concorrência. Tenta novamente." },
            { status: 409 },
        );
    }

    const updated = txResult.updated;

    if (action === "start") {
        await pusherServer.trigger(CHANNELS.SESSION, EVENTS.SESSION_STARTED, {
            sessionId: updated.id,
            userId: updated.userId,
            durationMin: updated.durationMin ?? 60,
        });
    }

    if (action === "end" || action === "cancel") {
        await pusherServer.trigger(CHANNELS.SESSION, EVENTS.SESSION_ENDED, {
            sessionId: updated.id,
        });
    }

    if (action === "approve") {
        await pusherServer.trigger(CHANNELS.STAFF, EVENTS.REQUEST_APPROVED, {
            sessionId: updated.id,
        });
    }

    if (action === "reject") {
        await pusherServer.trigger(CHANNELS.STAFF, EVENTS.REQUEST_REJECTED, {
            sessionId: updated.id,
        });
    }

    if (
        action === "start" ||
        action === "reject" ||
        action === "cancel" ||
        action === "end"
    ) {
        await pusherServer.trigger(CHANNELS.QUEUE, EVENTS.QUEUE_UPDATED, {
            sessionId: updated.id,
            action,
        });
    }

    return NextResponse.json(updated);
}
