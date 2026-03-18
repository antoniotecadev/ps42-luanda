// action/auth-actions.ts
"use server"

import { signIn, signOut } from "@/lib/auth"

export async function signInWith42() {
  await signIn("42-school", { redirectTo: "/dashboard" })
}

export async function signOutUser() {
  await signOut({ redirectTo: "/" })
}