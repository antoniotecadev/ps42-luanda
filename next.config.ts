import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * O `serverExternalPackages` é uma configuração do Next.js que permite especificar quais pacotes devem ser tratados como externos no ambiente de servidor, ou seja, não serão incluídos no bundle do servidor. 
   * Isso é especialmente útil para pacotes que são grandes ou que possuem dependências nativas, como o Prisma Client, que pode causar problemas de desempenho ou compatibilidade se for incluído diretamente no bundle do servidor.
   * 
   * No nosso caso, estamos incluindo '@prisma/client' e './lib/generated/prisma' como pacotes externos para garantir que o Prisma Client seja carregado corretamente no ambiente de servidor, sem causar problemas de desempenho ou compatibilidade. 
   * Isso é importante para garantir que a nossa aplicação funcione de maneira eficiente e estável, especialmente durante o desenvolvimento, onde múltiplas instâncias do Prisma podem ser criadas.
   */
  serverExternalPackages: [
    '@prisma/client',
    './lib/generated/prisma',        // ← o teu cliente gerado localmente
  ],
};

export default nextConfig;
