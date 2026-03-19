// ─── PS42 Luanda — 42 Intra API Wrapper ───────────────────────────────────
// Wrapper centralizado para todas as chamadas à API 42 Intra.
// Todos os tipos reflectem a estrutura real da API.

const BASE_URL = 'https://api.intra.42.fr/v2'

// ── Tipos da API 42 ──────────────────────────────────────────────────────

export interface IntraUser {
    id: number
    login: string
    displayname: string
    email: string
    image: { link: string | null }
    cursus_users: IntraCursusUser[]
    campus_users: IntraCampusUser[]
    projects_users: IntraProject[]
}

export interface IntraCursusUser {
    id: number
    grade: string | null
    level: number
    cursus_id: number
    cursus: { name: string; slug: string }
}

export interface IntraCampusUser {
    campus_id: number
    is_primary: boolean
}

export interface IntraProject {
    id: number
    status: string  // 'finished'|'in_progress'|'searching_a_group'|'creating_group'
    validated?: boolean
    final_mark: number | null
    project: { name: string; slug: string }
    cursus_ids: number[]
    created_at: string
    updated_at: string
}

export interface IntraScaleTeam {
    id: number
    final_mark: number | null
    comment: string | null
    created_at: string
}

export interface IntraCoalition {
    id: number
    name: string
    color: string
    image_url: string | null
    score: number
}

export interface IntraEvent {
    id: number
    name: string
    kind: string
    begin_at: string
    end_at: string
    location: string | null
}

export interface IntraExam {
    id: number
    name: string
    begin_at: string
    end_at: string
    location: string | null
}

// ── Classe cliente ────────────────────────────────────────────────────────

export class IntraClient {
    private token: string

    constructor(token: string) {
        this.token = token
    }

    // Método genérico para fazer requisições GET à API 42, incluindo tratamento de erros e configuração de cache.
    // Record<string, string> é um tipo TypeScript que representa um objecto cujas chaves são strings e os valores também são strings, usado aqui para os parâmetros de consulta da API. 
    private async get<T>(path: string, params?: Record<string, string>): Promise<T> {

        // Construção da URL com parâmetros de consulta, usando a classe URL para garantir a formatação correta, e adicionando os parâmetros fornecidos como query string.
        // Exemplo: se path for '/me/projects_users' e params for { 'filter[cursus_id]': '21' }, isso resultará em uma URL como https://api.intra.42.fr/v2/me/projects_users?filter[cursus_id]=21
        const url: URL = new URL(`${BASE_URL}${path}`)

        if (params) {
            // Object.entries(params) é uma função JavaScript que retorna um array de pares [chave, valor] para cada propriedade enumerável de um objeto, 
            // permitindo iterar sobre os parâmetros fornecidos e adicioná-los à URL como query string usando url.searchParams.set(k, v).
            // Exemplo: se params for { 'filter[cursus_id]': '21' }, isso resultará em uma URL como https://api.intra.42.fr/v2/me/projects_users?filter[cursus_id]=21
            Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
        }

        const res = await fetch(url.toString(), {
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            },
            next: { revalidate: 900 },  // cache 15 min
        })

        if (!res.ok) {
            throw new Error(`Intra API error: ${res.status} ${res.statusText} on ${path}`)
        }

        return res.json() as Promise<T>
    }

    // ── Utilizador autenticado ──────────────────────────────────────────────

    async getMe(): Promise<IntraUser> {
        return this.get<IntraUser>('/me')
    }

    async getMyCursus(): Promise<IntraCursusUser[]> {
        return this.get<IntraCursusUser[]>('/me/cursus_users')
    }

    async getMyProjects(): Promise<IntraProject[]> {
        return this.get<IntraProject[]>('/me/projects_users', {
            'filter[cursus_id]': '21',  // cursus_id 21 = 42cursus
        })
    }

    // getMyScaleTeams() é um método que busca as equipes de avaliação (scale teams) do usuário autenticado, filtrando os resultados para incluir apenas aqueles criados nos últimos 30 dias, usando a função get para fazer a requisição à API da 42 Intra com os parâmetros de filtro apropriados.
    async getMyScaleTeams(): Promise<IntraScaleTeam[]> {
        const since = new Date()
        since.setDate(since.getDate() - 30) // Filtra para os últimos 30 dias, ajustando a data actual para 30 dias atrás, garantindo que apenas as equipes de avaliação criadas nesse período sejam retornadas pela API da 42 Intra.
        return this.get<IntraScaleTeam[]>('/me/scale_teams', {
            'filter[future]': 'false',
            'range[created_at]': `${since.toISOString()},${new Date().toISOString()}`,
        })
    }

    async getMyCoalitions(): Promise<IntraCoalition[]> {
        return this.get<IntraCoalition[]>('/me/coalitions')
    }

    // ── Campus ─────────────────────────────────────────────────────────────

    // getCampusEvents() é um método que busca os eventos do campus especificado, filtrando os resultados para incluir apenas aqueles que ocorrerão nos próximos 7 dias, usando a função get para fazer a requisição à API da 42 Intra com os parâmetros de filtro apropriados.
    async getCampusEvents(campusId: string): Promise<IntraEvent[]> {
        const now = new Date()
        const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 dias no futuro, calculando a data actual e adicionando 7 dias para definir o intervalo de tempo para os eventos futuros, garantindo que apenas os eventos que ocorrerão nesse período sejam retornados pela API da 42 Intra.
        return this.get<IntraEvent[]>(`/campus/${campusId}/events`, {
            'range[begin_at]': `${now.toISOString()},${future.toISOString()}`,
        })
    }

    // getCampusExams() é um método que busca os exames do campus especificado, usando a função get para fazer a requisição à API da 42 Intra sem parâmetros de filtro, retornando todos os exames associados ao campus.
    async getCampusExams(campusId: string): Promise<IntraExam[]> {
        return this.get<IntraExam[]>(`/campus/${campusId}/exams`)
    }
}

// ── Helper para criar cliente a partir da sessão NextAuth ─────────────────

export function createIntraClient(accessToken: string): IntraClient {
    return new IntraClient(accessToken)
}