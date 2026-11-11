import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { googleSignInUrl, oauthSettings } from "@/lib/google";
import { backToSettings, flowCookie, goTo, STATE_COOKIE } from "@/lib/google-flow";

/** Settings, "Connect Google Calendar": sends the browser to Google to sign in. */
export async function GET(request: NextRequest) {
  if (!(await getSession())) return goTo("/login");
  const oauth = oauthSettings();
  if (!oauth) return backToSettings("notset");

  // Google sends the browser back to one fixed address. Her login only counts
  // on the address she signed in to the CRM with, so the two have to match.
  const home = new URL(oauth.redirectUri);
  if (request.headers.get("host") !== home.host) {
    return backToSettings("failed", `To connect Google, open the CRM at ${home.origin} and try again from there.`);
  }

  const state = randomBytes(24).toString("base64url");
  const res = goTo(googleSignInUrl(state));
  res.cookies.set(STATE_COOKIE, state, { ...flowCookie, path: "/api/google", maxAge: 600 });
  return res;
}
