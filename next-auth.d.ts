import { DefaultSession, DefaultUser } from "next-auth";
import { Role } from "@prisma/client";

// Estende o User básico do NextAuth
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      intraId: number;
      role: Role;
      login: string;
      isEligible: boolean;
      isBlocked: boolean;
      accessToken: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: Role;
    login: string;
    isEligible: boolean;
    isBlocked: boolean;
    intraId?: number;
  }
}

// Estende também o tipo usado internamente pelos Adapters
declare module "next-auth/adapters" {
  interface AdapterUser extends DefaultUser {
    role: Role;
    login: string;
    isEligible: boolean;
    isBlocked: boolean;
    intraId?: number;
  }
}
