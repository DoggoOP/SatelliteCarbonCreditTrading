/**
 * Base path of the mounted marketplace, derived from the current URL so links
 * work whether the host mounts it at `/marketplace` or somewhere else.
 */
export function marketplaceBase(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length >= 2 && parts[parts.length - 2] === "listing") {
    parts.splice(-2, 2);
  } else if (parts.length >= 1 && (parts[parts.length - 1] === "list" || parts[parts.length - 1] === "portfolio")) {
    parts.pop();
  }
  if (parts.length === 0) return "/";
  return `/${parts.join("/")}`;
}

export function marketplaceHref(base: string, leaf: "" | "list" | "portfolio" | `listing/${string}`): string {
  const root = base === "/" ? "" : base.replace(/\/$/, "");
  if (!leaf) return root || "/";
  return `${root}/${leaf}`;
}
