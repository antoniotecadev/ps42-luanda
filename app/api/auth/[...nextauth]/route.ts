// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth"
export const { GET, POST } = handlers

/**
 * Este arquivo é o ponto de entrada para as rotas de autenticação do NextAuth.
 * Ele importa os handlers gerados pela configuração do NextAuth (definida em lib/auth.ts)
 * e os exporta como métodos GET e POST, permitindo que o NextAuth gerencie as requisições de login, logout, callback de autenticação e outras operações relacionadas à autenticação.
 */

// /api/auth/callback/42-school?code=talão 
// O usuário é redirecionado para esta rota após autenticar com a 42 Intra, 
// e o NextAuth processa o código de autorização para obter o token de acesso 
// e as informações do usuário, seguindo a configuração definida em lib/auth.ts.

// GET / POST /api/auth/signin -> Quando o usuário clica no botão de login, ele é redirecionado para esta rota, que inicia o processo de autenticação com a 42 Intra, seguindo a configuração do NextAuth e os callbacks definidos em lib/auth.ts para criar ou atualizar o usuário na base de dados e estabelecer a sessão do usuário.
// POST /api/auth/signout -> Quando o usuário clica no botão de logout, ele é redirecionado para esta rota, que encerra a sessão do usuário e redireciona para a página inicial ou de login, conforme definido na configuração do NextAuth em lib/auth.config.ts.
// GET /api/auth/session -> Retorna as informações da sessão do usuário, se estiver autenticado.
// GET /api/auth/providers -> Retorna a lista de provedores de autenticação disponíveis.
// GET /api/auth/csrf -> Retorna o token CSRF para proteção contra ataques de CSRF.
// GET / POST /api/auth/callback/42-school -> Rota de callback para autenticação com a 42 Intra.