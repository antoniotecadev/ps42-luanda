// lib/auth.ts
import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";
import { Role } from "@prisma/client";

interface FortyTwoProfile {
  id: number;
  login: string;
  displayname?: string | null;
  email?: string | null;
  image?: { link?: string | null } | null;
  cursus_users?: Array<{ level?: number | null }>;
  "staff?"?: boolean;
}

type AuthToken = JWT & {
  id?: string;
  intraId?: number;
  role?: Role;
  login?: string;
  isEligible?: boolean;
  isBlocked?: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  error?: string;
};

// Configuração do NextAuth para autenticação com a 42 Intra, usando o adaptador Prisma para integração com a nossa base de dados,
// e callbacks para sincronizar os dados do usuário e enriquecer a sessão com informações adicionais do banco de dados,
// como papel, elegibilidade e status de bloqueio. Também definimos páginas personalizadas para login e erros de autenticação.
export const { handlers, auth, signIn, signOut } = NextAuth({
  debug: process.env.NODE_ENV === "development",
  ...authConfig, // Importa as regras do configuração, incluindo callbacks e páginas personalizadas
  providers: [
    {
      id: "42-school", // Identificador único para o provedor de autenticação da 42 Intra
      name: "42 Intra", // Nome do provedor de autenticação, exibido na interface de login
      type: "oauth", // Tipo de autenticação, neste caso OAuth para integração com a API da 42 Intra
      clientId: process.env.FORTY_TWO_CLIENT_ID,
      clientSecret: process.env.FORTY_TWO_CLIENT_SECRET,
      authorization: {
        url: "https://api.intra.42.fr/oauth/authorize", // URL de autorização da 42 Intra, incluindo os escopos necessários para acessar as informações do usuário e seus projectos, grupos e eventos
        params: { scope: "public profile projects", prompt: "consent" }, // rompt: "consent" força o usuário a conceder permissão toda vez, garantindo que tenhamos os dados mais recentes da 42 Intra a cada login
      },
      // URLs para obtenção do token de acesso e informações do usuário, conforme a API da 42 Intra
      token: "https://api.intra.42.fr/oauth/token",
      userinfo: "https://api.intra.42.fr/v2/me",
      profile(profile) {
        const p = profile as FortyTwoProfile;
        // Função de perfil para mapear os dados retornados pela API da 42 Intra para o formato esperado pelo NextAuth,
        // incluindo campos como id, login, nome, email e imagem do usuário
        return {
          id: String(p.id),
          intraId: p.id,
          login: p.login,
          name: p.displayname || p.login,
          email: p.email,
          image: p.image?.link || null,
          // Adiciona os campos obrigatórios com valores padrão
          role: p["staff?"] ? "STAFF" : "STUDENT", // Ou o valor padrão que definiste no Prisma
          isEligible: false, // Valor inicial padrão
          isBlocked: false, // Valor inicial padrão
        };
      },
    },
  ],
  // Callbacks para personalizar o comportamento do NextAuth durante o processo de autenticação e gerenciamento de sessões,
  callbacks: {
    // Callback de signIn para criar ou actualizar o usuário na base de dados após a autenticação bem-sucedida,
    // garantindo que as informações do perfil estejam sincronizadas com a 42 Intra, e retornando true para permitir o login

    // O authorized já vem do ...authConfig, mas deixamos aqui para referência de como o Middleware decide se pode passar ou não

    // user: Vem da função profile() do seu Provider (dados da 42 Intra).
    // account: Contém informações sobre a conta de autenticação, como o tipo de provedor e tokens de acesso.
    // profile: Recebe os dados do usuário retornados pela API da 42 Intra após a autenticação,
    // e é responsável por mapear esses dados para o formato esperado pelo NextAuth,
    // incluindo campos personalizados como role, isEligible e isBlocked, que são usados posteriormente no processo de autorização e gerenciamento de sessões.
    async signIn({ account, profile }) {
      if (!profile || !account) return false;

      const p = profile as unknown as FortyTwoProfile;

      const intraId = p.id;

      if (!intraId) {
        console.error("Profile ID não encontrado:", profile);
        return false; // Bloqueia o login se não houver ID
      }

      try {
        // Criar ou actualizar o utilizador na nossa DB
        const avatarUrl = p.image?.link ?? null;
        const intraLevel = p.cursus_users?.[0]?.level ?? 0;
        const displayName = p.displayname ?? p.login;
        const email = p.email ?? `${p.login}@42.local`;

        await prisma.user.upsert({
          where: { intraId: p.id }, // Usar intraId como chave única para identificar o usuário, garantindo que cada usuário da 42 Intra corresponda a um registro único na nossa base de dados
          update: {
            displayName,
            email,
            avatarUrl,
            intraLevel,
            lastSyncAt: new Date(),
          },
          create: {
            intraId: p.id,
            login: p.login,
            displayName,
            email,
            avatarUrl,
            intraLevel,
            role: p["staff?"] ? "STAFF" : "STUDENT",
            isEligible: false,
            isBlocked: false,
            lastSyncAt: new Date(),
          },
        });
      } catch (error) {
        console.error("Erro no upsert do Prisma:", error);
        return false;
      }
      return true;
    },

    /**
     * jwt() é o "Escritor" (Lado do Servidor)
     * O callback jwt só roda em momentos específicos (quando o token é criado ou actualizado).
     * Onde ele vive? No cookie criptografado que fica no navegador do usuário.
     * Por que salvar aqui? Porque o Middleware (proxy.ts) só consegue ler o que está dentro do token.
     * Se você não salvar o role no token, o Middleware nunca saberá que você é um "STAFF" e não conseguirá proteger as rotas sem consultar o banco de dados toda hora.
     */

    // jwt recebe esse 'user' (visitante temporário) apenas no momento da criação do token.
    // user fica undefined depois disso, então é importante salvar tudo o que você precisa no token nesse momento, porque o Middleware só tem acesso ao token e não ao banco de dados.

    // token: É o resultado final que será encriptado no Cookie.
    // user: Vem da função profile() do seu Provider (dados da 42).
    // dbUser: Vem do seu banco de dados (Supabase via Prisma).
    // account: Contém informações sobre a conta de autenticação, como o tipo de provedor e tokens de acesso.

    async jwt({ token, account, user }) {
      const authToken = token as AuthToken;
      if (user) {
        // Na primeira vez que o JWT é criado, buscamos os dados reais do banco
        const dbUser = await prisma.user.findFirst({
          where: { email: authToken.email! },
        });
        authToken.id = dbUser?.id || user.id;
        authToken.intraId = dbUser?.intraId || user.intraId;
        authToken.role = dbUser?.role || user.role;
        authToken.login = dbUser?.login || user.login;
        authToken.isEligible = dbUser?.isEligible || user.isEligible;
        authToken.isBlocked = dbUser?.isBlocked || user.isBlocked;
      }

      if (account?.access_token) {
        authToken.accessToken = account.access_token;
      }

      if (account && user) {
        return {
          ...authToken,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at ? account.expires_at * 1000 : 0, // Converter para ms
        };
      }

      // Se o token ainda não expirou, apenas retorna o token atual
      if (
        typeof authToken.expiresAt === "number" &&
        Date.now() < authToken.expiresAt
      ) {
        return authToken;
      }

      if (!authToken.refreshToken) {
        return {
          ...authToken,
          error: "ReauthRequired",
        };
      }

      // SE CHEGOU AQUI, O TOKEN DA INTRA EXPIROU!
      // Precisamos de pedir um novo à 42 usando o refreshToken
      return refreshAccessToken(authToken);
    },
    /**
     * O session() é o "Tradutor" (Interface do Usuário)
     * O callback session decide o que o seu código (Client Components ou Server Components) vai enxergar quando você chama useSession() ou auth().
     * Onde ele vive? Na memória da aplicação durante a requisição.
     * Por que extrair do token? Por padrão, o objeto session do NextAuth é muito magro (só traz nome, e-mail e imagem).
     * Se você quer que o seu componente Navbar.tsx saiba o seu login da 42 ou o seu role, você precisa "injetar" esses dados que estavam escondidos no token para dentro do objeto de sessão.
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.intraId = token.intraId as number;
        session.user.role = token.role as Role;
        session.user.login = token.login as string;
        session.user.isEligible = token.isEligible as boolean;
        session.user.isBlocked = token.isBlocked as boolean;
        session.user.accessToken = token.accessToken as string;
      }
      return session;
    },
  },
});

async function refreshAccessToken(token: AuthToken): Promise<AuthToken> {
  if (!token.refreshToken) {
    return { ...token, error: "ReauthRequired" };
  }

  try {
    const response = await fetch("https://api.intra.42.fr/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.FORTY_TWO_CLIENT_ID!,
        client_secret: process.env.FORTY_TWO_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      } as Record<string, string>),
    });

    const refreshedTokens = (await response.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    if (!response.ok) throw refreshedTokens;

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      expiresAt: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // A 42 pode ou não enviar um novo refresh_token
    };
  } catch (error) {
    console.error("Erro ao renovar token da Intra:", error);
    return {
      ...token,
      refreshToken: undefined,
      error: "RefreshAccessTokenError",
    };
  }
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
