export function formatDate(date: string | Date, locale = "en"): string {
  return new Date(date).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateShort(date: string | Date, locale = "en"): string {
  return new Date(date).toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function ageFromDOB(dob: string): number {
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

export function daysBetween(a: string | Date, b: string | Date): number {
  return Math.abs(
    Math.floor(
      (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)
    )
  );
}
