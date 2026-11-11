import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";

// Downloaded at build time and served from this app, so nothing loads from Google at runtime.
const body = DM_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const heading = Playfair_Display({ subsets: ["latin"], variable: "--font-heading", display: "swap" });

export const metadata: Metadata = {
  title: "Mind Game Athletes",
  description: "Client and session tracking for Mind Game Athletes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${heading.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
