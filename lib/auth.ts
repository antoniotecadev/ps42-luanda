import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

// Configuração do NextAuth para autenticação com a 42 Intra, usando o adaptador Prisma para integração com a nossa base de dados,
// e callbacks para sincronizar os dados do usuário e enriquecer a sessão com informações adicionais do banco de dados,
// como papel, elegibilidade e status de bloqueio. Também definimos páginas personalizadas para login e erros de autenticação.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma) as any, // Usamos "as any" para contornar problemas de tipagem com o adaptador Prisma, garantindo que a integração funcione corretamente mesmo que haja discrepâncias nos tipos esperados pelo NextAuth

  providers: [
    {
      id: "42-school", // Identificador único para o provedor de autenticação da 42 Intra
      name: "42 Intra", // Nome do provedor de autenticação, exibido na interface de login
      type: "oauth", // Tipo de autenticação, neste caso OAuth para integração com a API da 42 Intra
      clientId: process.env.FORTY_TWO_CLIENT_ID,
      clientSecret: process.env.FORTY_TWO_CLIENT_SECRET,
      authorization: {
        // Configurações de autorização para o fluxo OAuth, incluindo a URL de autorização e os parâmetros necessários, como o escopo de acesso
        url: "https://api.intra.42.fr/oauth/authorize",
        params: { scope: "public" },
      },
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
    async signIn({ user, account, profile }) {
      if (!profile || !account) return false;

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

      return true;
    },

    // Callback de session para enriquecer a sessão do usuário com informações adicionais do banco de dados,
    // como id, papel, login, elegibilidade e status de bloqueio,
    async session({ session, token }) {
      if (session.user) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email! },
          select: {
            id: true,
            role: true,
            login: true,
            isEligible: true,
            isBlocked: true,
          },
        });
        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.role = dbUser.role;
          session.user.login = dbUser.login;
          session.user.isEligible = dbUser.isEligible;
          session.user.isBlocked = dbUser.isBlocked;
        }
      }
      return session;
    },
  },

  // Configurações de páginas personalizadas para o NextAuth,
  // definindo a rota de login e a página de erro para redirecionar os usuários
  // em caso de falhas de autenticação ou quando tentarem acessar áreas restritas sem permissão
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
