import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CLIENT_STATUS_LABEL, fmtDate } from "@/lib/format";
import { Empty, PageHeader, Pill } from "@/components/ui";

export default async function TeamsPage() {
  const teams = await prisma.team.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { clients: true } },
      sessions: { where: { status: "SCHEDULED", startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 1 },
    },
  });
  return (
    <>
      <PageHeader title="Teams" actions={<Link href="/teams/new" className="btn-primary">+ New team</Link>} />
      {teams.length === 0 ? (
        <Empty>No teams yet. Teams let you group players and book team sessions.</Empty>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead><tr><th>Team</th><th>Club</th><th>Coach</th><th>Players</th><th>Next session</th><th>Status</th></tr></thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id} className="hover:bg-stone-50">
                  <td><Link href={`/teams/${t.id}`} className="font-medium hover:underline">{t.name}</Link>{t.ageGroup && <span className="text-stone-500"> · {t.ageGroup}</span>}</td>
                  <td>{t.club ?? "—"}</td>
                  <td>{t.coachName ?? "—"}</td>
                  <td>{t._count.clients}</td>
                  <td>{t.sessions[0] ? fmtDate(t.sessions[0].startsAt) : "—"}</td>
                  <td><Pill status={t.status} label={CLIENT_STATUS_LABEL[t.status]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
