export type InstallPlatform = "ios" | "android" | "desktop" | "mac" | "other";

export function getInstallPlatform(
  userAgent: string,
  maxTouchPoints: number,
): InstallPlatform {
  if (
    /iPhone|iPad|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
  ) {
    return "ios";
  }
  if (/Android/.test(userAgent)) return "android";
  if (
    /Macintosh/.test(userAgent) &&
    /Safari/.test(userAgent) &&
    !/Chrome|Edg/.test(userAgent)
  ) {
    return "mac";
  }
  if (/Chrome|Edg/.test(userAgent)) return "desktop";
  return "other";
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export const LAST_PAGE_KEY = "tolo:pwa:last-page";

/** Only restore public page paths on this origin, never protocol-relative URLs. */
export function getRestorePath(value: string | null): string | null {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\s?#]/.test(value)
  ) {
    return null;
  }
  const path = new URL(value, "https://tolo.invalid").pathname;
  if (
    path === "/" ||
    path.startsWith("//") ||
    /^\/(?:tenant|api|rpc|_next)(?:\/|$)/.test(path)
  ) {
    return null;
  }
  return path;
}
