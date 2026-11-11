import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SetupForm } from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if ((await prisma.user.count()) > 0) redirect("/login");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-xl shadow-stone-300/40">
        <p className="wordmark text-xl">Mind Game Athletes</p>
        <h1 className="mt-3 text-2xl font-semibold text-stone-900">Welcome</h1>
        <p className="mt-1 text-sm text-stone-500">
          Create your login for Mind Game Athletes. This only happens once.
        </p>
        <SetupForm />
      </div>
    </main>
  );
}
