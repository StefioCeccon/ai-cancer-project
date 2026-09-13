export async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data.error === "string" && data.error) return data.error;
    if (data.error && typeof data.error === "object") {
      const details = Object.entries(data.error as Record<string, unknown>)
        .map(([key, value]) => {
          if (Array.isArray(value)) return `${key}: ${value.join(", ")}`;
          if (value != null) return `${key}: ${String(value)}`;
          return null;
        })
        .filter(Boolean)
        .join("; ");
      if (details) return `${fallback}: ${details}`;
    }
  } catch {
    // Response body wasn't JSON — use fallback.
  }
  return fallback;
}
