"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  clearSessionCookie,
  hashPassword,
  requireUser,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";

export async function loginAction(_prev: string | null, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return "Wrong email or password.";
  }
  await setSessionCookie(user.id);
  redirect("/");
}

export async function setupAction(_prev: string | null, formData: FormData) {
  if ((await prisma.user.count()) > 0) return "Already set up.";
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || !email || password.length < 8) {
    return "Name, email and a password of at least 8 characters are required.";
  }
  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password) },
  });
  await setSessionCookie(user.id);
  redirect("/");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

export async function changePasswordAction(_prev: string | null, formData: FormData) {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!(await verifyPassword(current, user.passwordHash))) return "Current password is wrong.";
  if (next.length < 8) return "New password must be at least 8 characters.";
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next) },
  });
  return "Password updated.";
}

export async function updateProfileAction(_prev: string | null, formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!name || !email) return "Name and email are required.";
  await prisma.user.update({ where: { id: user.id }, data: { name, email } });
  return "Profile saved.";
}
