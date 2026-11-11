import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

const secretKey = new TextEncoder().encode(process.env.SESSION_SECRET!);

const PUBLIC_PATHS = ["/login", "/setup"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("session")?.value;
  let valid = false;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secretKey);
      // The login must still exist, so deleting a user signs them out.
      valid =
        typeof payload.userId === "string" &&
        (await prisma.user.count({ where: { id: payload.userId } })) > 0;
    } catch {
      valid = false;
    }
  }

  if (!valid) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    if (token) res.cookies.delete("session");
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)"],
};
