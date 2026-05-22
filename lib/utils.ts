import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Always produce UTC midnight for a "YYYY-MM-DD" string so MySQL DATE
 * comparisons are consistent regardless of server timezone. Reports are
 * persisted with this exact value, so all reads must use the same helper.
 */
export function utcDate(str: string): Date {
  return new Date(str + "T00:00:00.000Z");
}
