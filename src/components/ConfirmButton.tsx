"use client";

import { useTransition } from "react";

/** A button that confirms, then runs a server action. */
export function ConfirmButton({
  action,
  message,
  children,
  className = "btn-danger",
}: {
  action: () => Promise<void>;
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() => {
        if (confirm(message)) start(() => action());
      }}
    >
      {pending ? "…" : children}
    </button>
  );
}
