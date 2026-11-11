import Link from "next/link";
import { Pill } from "@/components/ui";
import { SESSION_STATUS_LABEL, SESSION_TYPE_LABEL, fmtDateTime } from "@/lib/format";

export type SessionRow = {
  id: string;
  startsAt: Date;
  durationMin: number;
  type: string;
  status: string;
  title: string | null;
  notes: string | null;
  nextFocus: string | null;
  prepNotes: string | null;
  clientPackage: { name: string } | null;
  client?: { id: string; firstName: string; lastName: string } | null;
  team?: { id: string; name: string } | null;
};

export function SessionList({ sessions, showWho = false }: { sessions: SessionRow[]; showWho?: boolean }) {
  if (sessions.length === 0) return <p className="text-sm text-stone-500">No sessions.</p>;
  return (
    <ul className="divide-y divide-stone-100">
      {sessions.map((s) => (
        <li key={s.id} className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={`/sessions/${s.id}`} className="font-medium text-stone-900 hover:underline">
              {fmtDateTime(s.startsAt)}
              {showWho && (s.client ? ` · ${s.client.firstName} ${s.client.lastName}` : s.team ? ` · ${s.team.name} (team)` : "")}
              {s.title && <span className="font-normal text-stone-500"> · {s.title}</span>}
            </Link>
            <span className="flex items-center gap-2 text-xs text-stone-500">
              {SESSION_TYPE_LABEL[s.type]} · {s.durationMin} min
              {s.clientPackage ? ` · ${s.clientPackage.name}` : " · single"}
              <Pill status={s.status} label={SESSION_STATUS_LABEL[s.status]} />
            </span>
          </div>
          {s.status === "COMPLETED" && s.notes && (
            <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-stone-600">{s.notes}</p>
          )}
          {s.status === "COMPLETED" && s.nextFocus && (
            <p className="mt-1 text-xs text-emerald-800"><span className="font-medium">Next:</span> {s.nextFocus}</p>
          )}
          {s.status === "SCHEDULED" && s.prepNotes && (
            <p className="mt-1 line-clamp-2 text-sm text-stone-500"><span className="font-medium">Plan:</span> {s.prepNotes}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
