export function normalizeAccessStatus(value) {
  if (!value || typeof value.allowed !== "boolean" || typeof value.reason !== "string") {
    throw new Error("Invalid access response");
  }
  if (value.allowed && !["DEMO", "COMMERCIAL"].includes(value.access_type)) {
    throw new Error("Missing access type");
  }
  if (value.allowed && value.access_type === "COMMERCIAL" && value.expires_at !== null) {
    throw new Error("COMMERCIAL access must be Lifetime");
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
