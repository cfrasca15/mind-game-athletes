"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/clients", label: "Players" },
  { href: "/teams", label: "Teams" },
  { href: "/calendar", label: "Calendar" },
  { href: "/payments", label: "Payments" },
  { href: "/settings", label: "Settings" },
];

export function Nav({ userName }: { userName: string }) {
  const pathname = usePathname();
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="mr-2 text-base font-semibold text-emerald-800">
          Mind Game Athletes
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
                  active ? "bg-emerald-50 text-emerald-800" : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction} className="flex items-center gap-3">
          <span className="hidden text-sm text-stone-500 sm:inline">{userName}</span>
          <button className="text-sm text-stone-500 hover:text-stone-900">Sign out</button>
        </form>
      </div>
    </header>
  );
}
