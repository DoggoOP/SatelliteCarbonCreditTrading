import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "ghost";
};

export function Button({ tone = "primary", className = "", ...props }: Props) {
  const toneClass =
    tone === "primary"
      ? "bg-canopy text-white hover:bg-[#0f5a36] disabled:bg-muted"
      : "bg-transparent text-ink border border-line hover:bg-white";
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${toneClass} ${className}`}
      {...props}
    />
  );
}
