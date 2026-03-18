// lib/auth.ts
import NextAuth from "next-auth";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";
import { Role } from "@prisma/client";

// Configuração do NextAuth para autenticação com a 42 Intra, usando o adaptador Prisma para integração com a nossa base de dados,
// e callbacks para sincronizar os dados do usuário e enriquecer a sessão com informações adicionais do banco de dados,
// como papel, elegibilidade e status de bloqueio. Também definimos páginas personalizadas para login e erros de autenticação.
export const { handlers, auth, signIn, signOut } = NextAuth({
  debug: true,
  ...authConfig, // Importa as regras do configuração, incluindo callbacks e páginas personalizadas
  providers: [
    {
      id: "42-school", // Identificador único para o provedor de autenticação da 42 Intra
      name: "42 Intra", // Nome do provedor de autenticação, exibido na interface de login
      type: "oauth", // Tipo de autenticação, neste caso OAuth para integração com a API da 42 Intra
      clientId: process.env.FORTY_TWO_CLIENT_ID,
      clientSecret: process.env.FORTY_TWO_CLIENT_SECRET,
      authorization: "https://api.intra.42.fr/oauth/authorize?scope=public",
      // URLs para obtenção do token de acesso e informações do usuário, conforme a API da 42 Intra
      token: "https://api.intra.42.fr/oauth/token",
      userinfo: "https://api.intra.42.fr/v2/me",
      profile(profile) {
        // Função de perfil para mapear os dados retornados pela API da 42 Intra para o formato esperado pelo NextAuth,
        // incluindo campos como id, login, nome, email e imagem do usuário
        return {
          id: String(profile.id),
          intraId: profile.id,
          login: profile.login,
          name: profile.displayname || profile.login,
          email: profile.email,
          image: profile.image?.link || null,
          // Adiciona os campos obrigatórios com valores padrão
          role: "CADETE", // Ou o valor padrão que definiste no Prisma
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
    async signIn({ user, account, profile }) {
      if (!profile || !account) return false;

      try {
        // Criar ou actualizar o utilizador na nossa DB
        await prisma.user.upsert({
          where: { intraId: Number(profile.id) }, // Usar intraId como chave única para identificar o usuário, garantindo que cada usuário da 42 Intra corresponda a um registro único na nossa base de dados
          update: {
            displayName: profile.displayname as string,
            email: profile.email as string,
            avatarUrl: (profile.image as any)?.link,
            intraLevel: (profile.cursus_users as any)?.[0]?.level || 0,
            lastSyncAt: new Date(),
          },
          create: {
            intraId: Number(profile.id),
            login: profile.login as string,
            displayName: profile.displayname as string,
            email: profile.email as string,
            avatarUrl: (profile.image as any)?.link,
            role: "CADETE",
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
     * O callback jwt só roda em momentos específicos (quando o token é criado ou atualizado).
     * Onde ele vive? No cookie criptografado que fica no navegador do usuário.
     * Por que salvar aqui? Porque o Middleware (proxy.ts) só consegue ler o que está dentro do token. 
     * Se você não salvar o role no token, o Middleware nunca saberá que você é um "STAFF" e não conseguirá proteger as rotas sem consultar o banco de dados toda hora.
     */

    // jwt recebe esse 'user' (visitante temporário) apenas no momento da criação do token.
    // user fica undefined depois disso, então é importante salvar tudo o que você precisa no token nesse momento, porque o Middleware só tem acesso ao token e não ao banco de dados.
    
    // user: Vem da função profile() do seu Provider (dados da 42).
    // dbUser: Vem do seu banco de dados (Supabase via Prisma).
    // token: É o resultado final que será encriptado no Cookie.

    async jwt({ token, user }) {
      if (user) {
        // Na primeira vez que o JWT é criado, buscamos os dados reais do banco
        const dbUser = await prisma.user.findFirst({
          where: { email: token.email! }
        });
        token.id = dbUser?.id || user.id;
        token.role = dbUser?.role || user.role;
        token.login = dbUser?.login || user.login;
        token.isEligible = dbUser?.isEligible || user.isEligible;
        token.isBlocked = dbUser?.isBlocked || user.isBlocked;
      }
      return token;
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
        session.user.role = token.role as Role;
        session.user.login = token.login as string;
        session.user.isEligible = token.isEligible as boolean;
        session.user.isBlocked = token.isBlocked as boolean;
      }
      return session;
    },
  },
});

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
