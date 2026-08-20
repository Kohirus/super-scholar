const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function sanitizeDirectoryName(value: string, maxLength = 80): string {
  const sanitized = value
    .replace(/[\\/]/g, "_")
    .replace(/\*/g, "_")
    .replace(/[<>:"|?]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  const fallback = sanitized || "Untitled Paper";
  const safe = RESERVED_WINDOWS_NAMES.test(fallback) ? `${fallback}_paper` : fallback;
  return safe.length > maxLength ? safe.slice(0, maxLength).trim() : safe;
}
