import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "ghost";
};

export function Button({ tone = "primary", className = "", ...props }: Props) {
  const toneClass =
    tone === "primary"
      ? "bg-copper text-paper hover:brightness-95 disabled:bg-muted disabled:text-paper"
      : "bg-transparent text-ink border border-line hover:bg-paper";
  return (
    <button
      className={`inline-flex max-w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${toneClass} ${className}`}
      {...props}
    />
  );
}
