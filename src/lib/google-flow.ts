import { NextResponse } from "next/server";

/**
 * Shared by the two Google sign-in routes (/api/google/connect and
 * /api/google/callback) and the Settings page that shows the outcome.
 */

/** Ties the trip to Google to the browser that started it. */
export const STATE_COOKIE = "g_state";
/** Carries the reason when connecting failed, for Settings to show once. */
export const NOTICE_COOKIE = "g_notice";

export const flowCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.COOKIE_SECURE === "true",
};

export type GoogleOutcome = "connected" | "cancelled" | "expired" | "nopermission" | "notset" | "failed";

/** What Settings says for each way the sign-in can end. */
export const OUTCOME_TEXT: Record<GoogleOutcome, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Google Calendar is connected." },
  cancelled: { ok: false, text: "The Google sign-in was cancelled. Nothing was changed." },
  expired: { ok: false, text: "The sign-in took too long or was started in another tab. Please try again." },
  nopermission: { ok: false, text: "Google was not given permission to add events. Try again and leave the calendar box ticked on Google's screen." },
  notset: { ok: false, text: "Google sign-in has not been switched on for this server yet." },
  failed: { ok: false, text: "Could not connect to Google. Please try again." },
};

/**
 * A redirect with the address written as given. Paths inside the app stay
 * relative on purpose: behind Docker the app sees itself as localhost, so an
 * address built from the request would send the browser to a dead link.
 */
export function goTo(location: string) {
  return new NextResponse(null, { status: 307, headers: { Location: location } });
}

export function backToSettings(outcome: GoogleOutcome, message?: string) {
  const res = goTo(`/settings?google=${outcome}`);
  // The reason travels in a short-lived cookie, not the address bar.
  if (message) res.cookies.set(NOTICE_COOKIE, message, { ...flowCookie, path: "/settings", maxAge: 60 });
  return res;
}
