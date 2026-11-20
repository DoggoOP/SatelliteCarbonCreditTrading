import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "ghost";
};

export function Button({ tone = "primary", className = "", ...props }: Props) {
  const toneClass =
    tone === "primary"
      ? "bg-canopy text-paper shadow-sm hover:bg-ink disabled:bg-muted disabled:text-paper disabled:shadow-none"
      : "bg-paper text-ink border border-line hover:bg-canvas";
  return (
    <button
      className={`inline-flex max-w-full items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${toneClass} ${className}`}
      {...props}
    />
  );
}
