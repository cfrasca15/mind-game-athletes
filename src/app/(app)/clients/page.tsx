import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CLIENT_STATUS_LABEL, age, fmtDate } from "@/lib/format";
import { Empty, PageHeader, Pill } from "@/components/ui";
import { packagesRemaining } from "@/lib/packages";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status = "ACTIVE" } = await searchParams;
  const where = {
    ...(status !== "ALL" ? { status: status as "ACTIVE" | "PAUSED" | "FORMER" } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { team: { name: { contains: q } } },
            { guardians: { some: { name: { contains: q } } } },
          ],
        }
      : {}),
  };
  const clients = await prisma.client.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      team: true,
      clientPackages: { where: { status: "ACTIVE" }, include: { _count: { select: { sessions: { where: { status: "COMPLETED" } } } } } },
      sessions: { where: { status: "SCHEDULED", startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 1 },
    },
  });

  return (
    <>
      <PageHeader
        title="Players"
        subtitle={`${clients.length} shown`}
        actions={<Link href="/clients/new" className="btn-primary">+ New player</Link>}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, team, parent…" className="input max-w-xs" />
        <select name="status" defaultValue={status} className="input w-auto">
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="FORMER">Former</option>
          <option value="ALL">All</option>
        </select>
        <button className="btn">Filter</button>
      </form>
      {clients.length === 0 ? (
        <Empty>No players match. Add one with the button above.</Empty>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Age</th>
                <th>Team</th>
                <th>Sessions left</th>
                <th>Next session</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const remaining = packagesRemaining(c.clientPackages);
                return (
                  <tr key={c.id} className="hover:bg-stone-50">
                    <td>
                      <Link href={`/clients/${c.id}`} className="font-medium text-stone-900 hover:underline">
                        {c.lastName}, {c.firstName}
                      </Link>
                    </td>
                    <td>{age(c.dateOfBirth) ?? "—"}</td>
                    <td>{c.team ? <Link href={`/teams/${c.team.id}`} className="hover:underline">{c.team.name}</Link> : "—"}</td>
                    <td>
                      {c.clientPackages.length === 0 ? (
                        <span className="text-stone-400">No active pack</span>
                      ) : (
                        <span className={remaining <= 1 ? "font-medium text-amber-700" : ""}>{remaining}</span>
                      )}
                    </td>
                    <td>{c.sessions[0] ? fmtDate(c.sessions[0].startsAt) : "—"}</td>
                    <td><Pill status={c.status} label={CLIENT_STATUS_LABEL[c.status]} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
