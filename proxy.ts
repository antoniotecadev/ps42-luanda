// proxy.ts
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

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