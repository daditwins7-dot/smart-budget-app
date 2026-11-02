export const PENDING_COMMERCIAL_KEY = "smart-budget-pending-commercial";

// The bearer key belongs to the buyer's link, never to public application code.
export function readCommercialToken(location, storage, history) {
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ""));
  const supplied = fragment.get("commercial");
  if (supplied !== null) {
    fragment.delete("commercial");
    const rest = fragment.toString();
    history.replaceState({}, "", location.pathname + location.search + (rest ? `#${rest}` : ""));
    if (/^[0-9a-f]{64}$/.test(supplied)) {
      try { storage.setItem(PENDING_COMMERCIAL_KEY, supplied); } catch { /* Current-tab activation still works. */ }
      return supplied;
    }
    clearCommercialToken(storage);
    return "";
  }
  try {
    const pending = storage.getItem(PENDING_COMMERCIAL_KEY) || "";
    return /^[0-9a-f]{64}$/.test(pending) ? pending : "";
  } catch { return ""; }
}

export function clearCommercialToken(storage) {
  try { storage.removeItem(PENDING_COMMERCIAL_KEY); } catch { /* Storage is optional. */ }
}

export function normalizeAccessStatus(value) {
  if (!value || typeof value.allowed !== "boolean" || typeof value.reason !== "string") {
    throw new Error("Invalid access response");
  }
  if (value.allowed && !["DEMO", "COMMERCIAL"].includes(value.access_type)) {
    throw new Error("Missing access type");
  }
  if (value.allowed && value.expires_at !== null &&
      (typeof value.remaining_seconds !== "number" || !Number.isFinite(value.remaining_seconds) || value.remaining_seconds <= 0)) {
    throw new Error("Invalid expiration response");
  }
  if (value.allowed && value.access_type === "DEMO" && !value.expires_at) {
    throw new Error("DEMO requires a server expiration");
  }
  return value;
}

export function accessDeadline(status, monotonicNow, elapsedMs = 0) {
  return status.allowed && status.expires_at !== null
    ? monotonicNow + Math.max(0, status.remaining_seconds * 1000 - elapsedMs)
    : Infinity;
}
