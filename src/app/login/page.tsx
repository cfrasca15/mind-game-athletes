import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if ((await prisma.user.count()) === 0) redirect("/setup");
  if (await getSession()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-xl shadow-stone-300/40">
        <h1 className="wordmark text-3xl">Mind Game Athletes</h1>
        <p className="mt-1 text-sm text-stone-500">Sign in to continue.</p>
        <LoginForm />
      </div>
    </main>
  );
}
