import { deleteGoalAction, saveGoalAction, setGoalStatusAction } from "@/lib/actions/clients";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Field, Pill } from "@/components/ui";
import type { Goal } from "@/generated/prisma/client";

export function GoalSection({ clientId, goals }: { clientId: string; goals: Goal[] }) {
  const active = goals.filter((g) => g.status === "ACTIVE");
  const done = goals.filter((g) => g.status !== "ACTIVE");
  return (
    <section className="card">
      <h2 className="mb-3 font-semibold text-stone-900">Goals</h2>
      {goals.length === 0 && <p className="text-sm text-stone-500">No goals yet. What are you working on together?</p>}
      <ul className="divide-y divide-stone-100">
        {[...active, ...done].map((g) => (
          <li key={g.id} className="flex items-start justify-between gap-3 py-2 text-sm">
            <div className={g.status !== "ACTIVE" ? "text-stone-400" : ""}>
              <div className="font-medium">{g.title} {g.status !== "ACTIVE" && <Pill status={g.status} label={g.status.toLowerCase()} />}</div>
              {g.detail && <div className="whitespace-pre-line text-stone-600">{g.detail}</div>}
            </div>
            <div className="flex shrink-0 gap-2 text-xs">
              {g.status === "ACTIVE" ? (
                <>
                  <ConfirmButton className="text-brand-700 hover:underline" action={setGoalStatusAction.bind(null, g.id, clientId, "ACHIEVED")} message="Mark this goal achieved?">Achieved</ConfirmButton>
                  <ConfirmButton className="text-stone-500 hover:underline" action={setGoalStatusAction.bind(null, g.id, clientId, "DROPPED")} message="Drop this goal?">Drop</ConfirmButton>
                </>
              ) : (
                <ConfirmButton className="text-stone-500 hover:underline" action={setGoalStatusAction.bind(null, g.id, clientId, "ACTIVE")} message="Reopen this goal?">Reopen</ConfirmButton>
              )}
              <ConfirmButton className="text-red-600 hover:underline" action={deleteGoalAction.bind(null, g.id, clientId)} message="Delete this goal?">Delete</ConfirmButton>
            </div>
          </li>
        ))}
      </ul>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-brand-800">+ Add goal</summary>
        <form action={saveGoalAction} className="mt-3 space-y-3">
          <input type="hidden" name="clientId" value={clientId} />
          <Field label="Goal"><input name="title" required className="input" placeholder="Stay composed after a mistake" /></Field>
          <Field label="Detail"><textarea name="detail" className="input" /></Field>
          <button className="btn-primary">Add goal</button>
        </form>
      </details>
    </section>
  );
}
