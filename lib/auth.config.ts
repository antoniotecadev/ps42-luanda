// lib/auth.config.ts
import type { NextAuthConfig } from "next-auth";
import { Role } from "@prisma/client";

export const authConfig = {
    session: { strategy: "jwt" }, // Usamos JWT para armazenar as informações do usuário na sessão, permitindo que os dados sejam persistidos e acessíveis em toda a aplicação sem a necessidade de consultas constantes ao banco de dados, o que melhora a performance e escalabilidade da autenticação.
    pages: {
        signIn: "/login", // Especifica a rota personalizada para a página de login, garantindo que os usuários sejam redirecionados para a interface de autenticação personalizada quando tentarem acessar áreas protegidas sem estar autenticados, melhorando a experiência do usuário e mantendo a consistência visual da aplicação.
        error: "/login", // Redireciona para a página de login em caso de erros de autenticação, permitindo que os usuários vejam mensagens de erro relevantes e possam tentar novamente, melhorando a usabilidade e a experiência geral do processo de login.
    },
    callbacks: {

        // 1. ADICIONA ESTE CALLBACK JWT AQUI (Para o Middleware ler o role do Cookie)
        async jwt({ token, user }) {
            if (user) {
                // No primeiro login, o 'user' vem do profile() do Provider
                token.role = user.role;
            }
            return token;
        },

        // 2. ADICIONA ESTE CALLBACK SESSION AQUI (Para o 'auth' no Middleware ver o role)
        async session({ session, token }) {
            if (token && session.user) {
                session.user.role = token.role as Role;
            }
            return session;
        },

        // É aqui que o Middleware decide se pode passar ou não
        authorized({ auth: session, request: { nextUrl } }) {
            const isLoggedIn = !!session?.user;
            const isPublicRoute = ['/', '/login'].includes(nextUrl.pathname);
            const isApiAuthRoute = nextUrl.pathname.startsWith('/api/auth');
            const isStaffRoute = nextUrl.pathname.startsWith('/staff');

            // console.log('Middleware Session:', session);
            // console.log('Requested URL:', nextUrl.pathname) // Log para debug

            /**
             * Lógica de autorização:
             * 1. Permitir acesso a rotas públicas (home e login) e rotas de autenticação da API sem restrições.
             * 2. Para outras rotas, verificar se o usuário está logado. Se não estiver, negar acesso (o NextAuth redirecionará para login).
             * 3. Para rotas que começam com /staff, verificar se o usuário tem a role STAFF ou ADMIN. Se não tiver, redirecionar para o dashboard.
             * 4. Para todas as outras rotas protegidas, permitir acesso apenas se o usuário estiver logado.
             * 
             * Isso garante que apenas usuários autenticados possam acessar áreas protegidas da aplicação, e que apenas usuários com as permissões adequadas possam acessar áreas específicas como as rotas de staff.
             * O uso do NextResponse.redirect permite redirecionar usuários não autorizados para páginas apropriadas, melhorando a segurança e a experiência do usuário.
             * O Middleware é executado em todas as requisições, garantindo que a autorização seja verificada de forma consistente em toda a aplicação.
             */

            if (isApiAuthRoute || isPublicRoute) return true; // Permite acesso a rotas públicas e de autenticação da API sem restrições

            if (!isLoggedIn) return false; // Redireciona para login automaticamente

            // const isBlocked = session?.user?.isBlocked; // Dado vindo do JWT

            // if (isBlocked && nextUrl.pathname !== "/blocked") {
            //     return Response.redirect(new URL("/blocked", nextUrl));
            // }

            // const role = session?.user?.role;

            // if (nextUrl.pathname.startsWith("/staff") && role !== "STAFF") {
            //     // Se for um STUDENT tentando entrar no painel staff, manda de volta
            //     return Response.redirect(new URL("/dashboard", nextUrl));
            // }

            if (isStaffRoute) {
                const role = session?.user?.role;
                if (role !== 'STAFF' && role !== 'ADMIN') {
                    // Redireciona student tentando ser staff
                    return Response.redirect(new URL('/dashboard', nextUrl));
                }
            }
            return true;
        },
    },
    providers: [], // Fica vazio, o auth.ts preenche
} satisfies NextAuthConfig;

/*
 * NextAuth Callbacks Reference
 * 
 * | Callback   | Quando executa?                                      | Frequência                        |
 * |------------|------------------------------------------------------|-----------------------------------|
 * | signIn     | Apenas no momento do login.                          | Uma vez por login.                |
 * | jwt        | Quando o token é criado ou o cookie é lido/atualizado. | Frequentemente, mas com cache.  |
 * | session    | Sempre que você chama useSession() ou auth().        | Sempre que a UI precisa de dados. |
 * | authorized | Em cada requisição de rota (Middleware).             | Constantemente (em cada clique).  |
 */