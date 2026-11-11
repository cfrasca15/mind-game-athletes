import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { finishGoogleSignIn, oauthSettings } from "@/lib/google";
import { connectSignedIn } from "@/lib/google-sync";
import { backToSettings, flowCookie, goTo, STATE_COOKIE, type GoogleOutcome } from "@/lib/google-flow";

/** Where Google sends the browser back after sign-in. */
export async function GET(request: NextRequest) {
  if (!(await getSession())) return goTo("/login");

  const finish = (outcome: GoogleOutcome, message?: string) => {
    const res = backToSettings(outcome, message);
    res.cookies.set(STATE_COOKIE, "", { ...flowCookie, path: "/api/google", maxAge: 0 });
    return res;
  };

  const q = request.nextUrl.searchParams;
  const problem = q.get("error");
  if (problem) return finish(problem === "access_denied" ? "cancelled" : "failed");

  // Only finish a sign-in this browser started.
  const code = q.get("code");
  const state = q.get("state");
  const expected = request.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected) return finish("expired");

  try {
    const { creds, email, canEditEvents } = await finishGoogleSignIn(code);
    if (!canEditEvents) return finish("nopermission");
    // The link back in each event uses the address Google just reached us on.
    const appUrl = new URL(oauthSettings()!.redirectUri).origin;
    await connectSignedIn(creds, email, appUrl);
    revalidatePath("/settings");
    return finish("connected");
  } catch (e) {
    return finish("failed", e instanceof Error ? e.message : undefined);
  }
}
