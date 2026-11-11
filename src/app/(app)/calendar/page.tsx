import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { fmtTime } from "@/lib/format";

const STATUS_CLS: Record<string, string> = {
  SCHEDULED: "bg-sky-50 text-sky-800 border-sky-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  NO_SHOW: "bg-red-50 text-red-800 border-red-200",
  CANCELLED: "bg-stone-100 text-stone-500 border-stone-200 line-through",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const today = new Date();
  const [y, mo] = m && /^\d{4}-\d{2}$/.test(m) ? m.split("-").map(Number) : [today.getFullYear(), today.getMonth() + 1];
  const first = new Date(y, mo - 1, 1);
  const last = new Date(y, mo, 0);
  // Grid starts on the Sunday on/before the 1st and ends on the Saturday on/after the last day.
  const gridStart = new Date(first); gridStart.setDate(first.getDate() - first.getDay());
  const gridEnd = new Date(last); gridEnd.setDate(last.getDate() + (6 - last.getDay()) + 1);

  const sessions = await prisma.session.findMany({
    where: { startsAt: { gte: gridStart, lt: gridEnd } },
    orderBy: { startsAt: "asc" },
    include: { client: { select: { firstName: true, lastName: true } }, team: { select: { name: true } } },
  });
  const byDay = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const k = dayKey(s.startsAt);
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }

  const days: Date[] = [];
  for (let d = new Date(gridStart); d < gridEnd; d.setDate(d.getDate() + 1)) days.push(new Date(d));
  const prev = `${mo === 1 ? y - 1 : y}-${String(mo === 1 ? 12 : mo - 1).padStart(2, "0")}`;
  const next = `${mo === 12 ? y + 1 : y}-${String(mo === 12 ? 1 : mo + 1).padStart(2, "0")}`;
  const todayKey = dayKey(today);

  return (
    <>
      <PageHeader
        title={first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        actions={
          <>
            <Link href={`/calendar?m=${prev}`} className="btn">← Prev</Link>
            <Link href="/calendar" className="btn">Today</Link>
            <Link href={`/calendar?m=${next}`} className="btn">Next →</Link>
            <Link href="/sessions/new" className="btn-primary">+ Schedule</Link>
          </>
        }
      />
      <div className="card overflow-x-auto p-0">
        <div className="grid min-w-[700px] grid-cols-7 border-b border-stone-200 text-center text-xs font-medium uppercase tracking-wide text-stone-500">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid min-w-[700px] grid-cols-7">
          {days.map((d) => {
            const k = dayKey(d);
            const inMonth = d.getMonth() === mo - 1;
            const list = byDay.get(k) ?? [];
            return (
              <div key={k} className={`min-h-28 border-b border-r border-stone-100 p-1.5 ${inMonth ? "" : "bg-stone-50/60"}`}>
                <div className="mb-1 flex items-center justify-between">
                  <span className={`text-xs ${k === todayKey ? "rounded-full bg-emerald-700 px-1.5 py-0.5 font-semibold text-white" : inMonth ? "text-stone-700" : "text-stone-400"}`}>{d.getDate()}</span>
                  <Link href={`/sessions/new?date=${k}`} className="text-xs text-stone-300 hover:text-emerald-700" title="Schedule">+</Link>
                </div>
                <ul className="space-y-1">
                  {list.map((s) => (
                    <li key={s.id}>
                      <Link href={`/sessions/${s.id}`} className={`block truncate rounded border px-1 py-0.5 text-xs ${STATUS_CLS[s.status]}`}>
                        {fmtTime(s.startsAt)} {s.client ? `${s.client.firstName} ${s.client.lastName[0]}.` : s.team?.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function dayKey(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
