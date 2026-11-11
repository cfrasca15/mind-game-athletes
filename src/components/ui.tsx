import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
      {children}
    </p>
  );
}

const STATUS_PILL: Record<string, string> = {
  ACTIVE: "bg-brand-50 text-brand-700",
  PAUSED: "bg-amber-50 text-amber-700",
  FORMER: "bg-stone-100 text-stone-600",
  SCHEDULED: "bg-violet-50 text-violet-700",
  COMPLETED: "bg-brand-50 text-brand-700",
  NO_SHOW: "bg-red-50 text-red-700",
  CANCELLED: "bg-stone-100 text-stone-600",
  EXHAUSTED: "bg-stone-100 text-stone-600",
  EXPIRED: "bg-amber-50 text-amber-700",
  ACHIEVED: "bg-brand-50 text-brand-700",
  DROPPED: "bg-stone-100 text-stone-600",
};

export function Pill({ status, label }: { status: string; label?: string }) {
  const cls = STATUS_PILL[status] ?? "bg-stone-100 text-stone-600";
  return <span className={`pill ${cls}`}>{label ?? status}</span>;
}

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-3 inline-block text-sm text-stone-500 hover:text-stone-900">
      ← {children}
    </Link>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card">
      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-stone-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-stone-500">{hint}</div>}
    </div>
  );
}
