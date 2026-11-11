import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SetupForm } from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if ((await prisma.user.count()) > 0) redirect("/login");
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-stone-900">Welcome</h1>
        <p className="mt-1 text-sm text-stone-500">
          Create your login for Mind Game Athletes. This only happens once.
        </p>
        <SetupForm />
      </div>
    </main>
  );
}
