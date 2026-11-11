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
  { href: "/library", label: "Library" },
  { href: "/settings", label: "Settings" },
];

/** A simple line-drawn soccer ball. */
function BallIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 8.4 15.42 10.89 14.12 14.91H9.88L8.58 10.89Z" fill="currentColor" />
      <path d="M12 8.4V5.4M8.44 3.19 12 5.4l3.56-2.21M15.42 10.89l2.86-.93M19.28 5.89l-1 4.07 3.2 2.7M14.12 14.91l1.76 2.43M20.06 17.03l-4.18.31-1.58 3.88M9.88 14.91l-1.76 2.43M9.7 21.22l-1.58-3.88-4.18-.31M8.58 10.89l-2.86-.93M2.52 12.66l3.2-2.7-1-4.07" />
    </svg>
  );
}

export function Nav({ userName }: { userName: string }) {
  const pathname = usePathname();
  return (
    <header className="border-b border-stone-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-3">
        <Link href="/" className="mr-1 flex items-center gap-2 whitespace-nowrap">
          <BallIcon className="h-6 w-6 text-brand-600" />
          <span className="wordmark text-xl">Mind Game Athletes</span>
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition ${
                  active ? "bg-brand-700 text-white shadow-xs" : "text-stone-600 hover:bg-brand-50 hover:text-brand-800"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction} className="flex items-center gap-3">
          <span className="hidden text-sm text-stone-500 sm:inline">{userName}</span>
          <button className="text-sm font-medium text-stone-500 hover:text-brand-800">Sign out</button>
        </form>
      </div>
    </header>
  );
}
