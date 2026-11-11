import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mind Game Athletes",
  description: "Client and session tracking for Mind Game Athletes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
