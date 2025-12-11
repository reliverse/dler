// ============================================================================
// DateTime Library - Comprehensive date and time utilities
// ============================================================================

export interface FormatOptions {
  locale?: string;
  timeZone?: string;
  dateStyle?: "full" | "long" | "medium" | "short";
  timeStyle?: "full" | "long" | "medium" | "short";
  year?: "numeric" | "2-digit";
  month?: "numeric" | "2-digit" | "long" | "short" | "narrow";
  day?: "numeric" | "2-digit";
  hour?: "numeric" | "2-digit";
  minute?: "numeric" | "2-digit";
  second?: "numeric" | "2-digit";
  hour12?: boolean;
}

export interface Duration {
  years?: number;
  months?: number;
  weeks?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
}

export interface RelativeTimeOptions {
  numeric?: "always" | "auto";
  style?: "long" | "short" | "narrow";
  locale?: string;
}

// ============================================================================
// Formatting Functions
// ============================================================================

// Cache for Intl.DateTimeFormat instances to avoid recreating them
const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateFormatter(
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  // Create cache key from locale and options
  const cacheKey = `${locale ?? "default"}|${JSON.stringify(options)}`;
  let formatter = dateFormatterCache.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatterCache.set(cacheKey, formatter);
  }
  return formatter;
}

/**
 * Format a date using Intl.DateTimeFormat with custom options
 */
export function formatDate(
  date: Date | number | string,
  options: FormatOptions = {},
): string {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;

  const formatOptions: Intl.DateTimeFormatOptions = {};

  if (options.dateStyle) {
    formatOptions.dateStyle = options.dateStyle;
  }
  if (options.timeStyle) {
    formatOptions.timeStyle = options.timeStyle;
  }
  if (options.year) {
    formatOptions.year = options.year;
  }
  if (options.month) {
    formatOptions.month = options.month;
  }
  if (options.day) {
    formatOptions.day = options.day;
  }
  if (options.hour !== undefined) {
    formatOptions.hour = options.hour;
  }
  if (options.minute !== undefined) {
    formatOptions.minute = options.minute;
  }
  if (options.second !== undefined) {
    formatOptions.second = options.second;
  }
  if (options.hour12 !== undefined) {
    formatOptions.hour12 = options.hour12;
  }

  const formatterOptions = {
    ...formatOptions,
    timeZone: options.timeZone,
  };

  return getDateFormatter(options.locale, formatterOptions).format(dateObj);
}

/**
 * Format date in ISO 8601 format
 */
export function formatISO(date: Date | number | string): string {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;
  return dateObj.toISOString();
}

/**
 * Format date in RFC 2822 format
 */
export function formatRFC2822(date: Date | number | string): string {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;
  return dateObj.toUTCString();
}

// Pre-compiled regex patterns for formatCustom (compiled once, reused many times)
const FORMAT_PATTERNS = {
  YYYY: /YYYY/g,
  YY: /YY/g,
  MM: /MM/g,
  M: /\bM\b/g,
  DD: /DD/g,
  D: /\bD\b/g,
  HH: /HH/g,
  H: /\bH\b/g,
  hh: /hh/g,
  h: /\bh\b/g,
  mm: /mm/g,
  m: /\bm\b/g,
  ss: /ss/g,
  s: /\bs\b/g,
  SSS: /SSS/g,
  SS: /SS\b/g,
  S: /\bS\b/g,
  AMPM: /AM|PM/g,
  ampm: /am|pm/g,
} as const;

/**
 * Format date using a custom format string
 * Supports: YYYY, MM, DD, HH, mm, ss, SSS, AM/PM
 */
export function formatCustom(
  date: Date | number | string,
  format: string,
): string {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;

  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();
  const hours = dateObj.getHours();
  const minutes = dateObj.getMinutes();
  const seconds = dateObj.getSeconds();
  const milliseconds = dateObj.getMilliseconds();
  const ampm = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;

  // Use pre-compiled regex patterns for better performance
  return format
    .replace(FORMAT_PATTERNS.YYYY, String(year))
    .replace(FORMAT_PATTERNS.YY, String(year).slice(-2))
    .replace(FORMAT_PATTERNS.MM, String(month).padStart(2, "0"))
    .replace(FORMAT_PATTERNS.M, String(month))
    .replace(FORMAT_PATTERNS.DD, String(day).padStart(2, "0"))
    .replace(FORMAT_PATTERNS.D, String(day))
    .replace(FORMAT_PATTERNS.HH, String(hours).padStart(2, "0"))
    .replace(FORMAT_PATTERNS.H, String(hours))
    .replace(FORMAT_PATTERNS.hh, String(hours12).padStart(2, "0"))
    .replace(FORMAT_PATTERNS.h, String(hours12))
    .replace(FORMAT_PATTERNS.mm, String(minutes).padStart(2, "0"))
    .replace(FORMAT_PATTERNS.m, String(minutes))
    .replace(FORMAT_PATTERNS.ss, String(seconds).padStart(2, "0"))
    .replace(FORMAT_PATTERNS.s, String(seconds))
    .replace(FORMAT_PATTERNS.SSS, String(milliseconds).padStart(3, "0"))
    .replace(
      FORMAT_PATTERNS.SS,
      String(Math.floor(milliseconds / 10)).padStart(2, "0"),
    )
    .replace(FORMAT_PATTERNS.S, String(Math.floor(milliseconds / 100)))
    .replace(FORMAT_PATTERNS.AMPM, ampm)
    .replace(FORMAT_PATTERNS.ampm, ampm.toLowerCase());
}

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse a date string into a Date object
 */
export function parseDate(input: string | number | Date): Date {
  if (input instanceof Date) {
    return input;
  }
  if (typeof input === "number") {
    return new Date(input);
  }
  return new Date(input);
}

/**
 * Parse ISO 8601 date string
 */
export function parseISO(isoString: string): Date {
  return new Date(isoString);
}

/**
 * Check if a date string is valid
 */
export function isValidDate(input: string | number | Date): boolean {
  try {
    const date = parseDate(input);
    return !Number.isNaN(date.getTime());
  } catch {
    return false;
  }
}

// ============================================================================
// Timezone Functions
// ============================================================================

// Cache for timezone formatters
const timezoneFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getTimezoneFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = timezoneFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    timezoneFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * Convert date to a specific timezone
 */
export function toTimezone(
  date: Date | number | string,
  timeZone: string,
): Date {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;

  const formatter = getTimezoneFormatter(timeZone);
  const parts = formatter.formatToParts(dateObj);
  const year = Number.parseInt(
    parts.find((p) => p.type === "year")?.value ?? "0",
    10,
  );
  const month =
    Number.parseInt(parts.find((p) => p.type === "month")?.value ?? "0", 10) -
    1;
  const day = Number.parseInt(
    parts.find((p) => p.type === "day")?.value ?? "0",
    10,
  );
  const hour = Number.parseInt(
    parts.find((p) => p.type === "hour")?.value ?? "0",
    10,
  );
  const minute = Number.parseInt(
    parts.find((p) => p.type === "minute")?.value ?? "0",
    10,
  );
  const second = Number.parseInt(
    parts.find((p) => p.type === "second")?.value ?? "0",
    10,
  );

  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

/**
 * Get timezone offset in minutes
 */
export function getTimezoneOffset(
  date: Date | number | string,
  timeZone: string,
): number {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;

  const utcDate = new Date(
    dateObj.toLocaleString("en-US", { timeZone: "UTC" }),
  );
  const tzDate = new Date(dateObj.toLocaleString("en-US", { timeZone }));
  return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60);
}

/**
 * List all available timezones
 */
export function getAvailableTimezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    // Fallback for older environments
    return [
      "UTC",
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Paris",
      "Asia/Tokyo",
      "Asia/Shanghai",
      "Australia/Sydney",
    ];
  }
}

// ============================================================================
// Relative Time Functions
// ============================================================================

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(
  date: Date | number | string,
  baseDate: Date | number | string = new Date(),
  options: RelativeTimeOptions = {},
): string {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;
  const baseObj =
    typeof baseDate === "string" || typeof baseDate === "number"
      ? new Date(baseDate)
      : baseDate;

  const diffMs = dateObj.getTime() - baseObj.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  const rtf = new Intl.RelativeTimeFormat(options.locale, {
    numeric: options.numeric ?? "auto",
    style: options.style ?? "long",
  });

  if (Math.abs(diffYears) >= 1) {
    return rtf.format(diffYears, "year");
  }
  if (Math.abs(diffMonths) >= 1) {
    return rtf.format(diffMonths, "month");
  }
  if (Math.abs(diffWeeks) >= 1) {
    return rtf.format(diffWeeks, "week");
  }
  if (Math.abs(diffDays) >= 1) {
    return rtf.format(diffDays, "day");
  }
  if (Math.abs(diffHours) >= 1) {
    return rtf.format(diffHours, "hour");
  }
  if (Math.abs(diffMinutes) >= 1) {
    return rtf.format(diffMinutes, "minute");
  }
  return rtf.format(diffSeconds, "second");
}

// ============================================================================
// Duration Functions
// ============================================================================

/**
 * Calculate duration between two dates
 */
export function getDuration(
  start: Date | number | string,
  end: Date | number | string,
): Duration {
  const startObj =
    typeof start === "string" || typeof start === "number"
      ? new Date(start)
      : start;
  const endObj =
    typeof end === "string" || typeof end === "number" ? new Date(end) : end;

  const diffMs = Math.abs(endObj.getTime() - startObj.getTime());

  const milliseconds = diffMs % 1000;
  const totalSeconds = Math.floor(diffMs / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const totalDays = Math.floor(totalHours / 24);
  const days = totalDays % 7;
  const weeks = Math.floor(totalDays / 7);
  const months = Math.floor(totalDays / 30);
  const years = Math.floor(totalDays / 365);

  return {
    years: years > 0 ? years : undefined,
    months: months > 0 ? months : undefined,
    weeks: weeks > 0 ? weeks : undefined,
    days: days > 0 ? days : undefined,
    hours: hours > 0 ? hours : undefined,
    minutes: minutes > 0 ? minutes : undefined,
    seconds: seconds > 0 ? seconds : undefined,
    milliseconds: milliseconds > 0 ? milliseconds : undefined,
  };
}

/**
 * Format duration as a human-readable string
 */
export function formatDuration(duration: Duration): string {
  const parts: string[] = [];

  if (duration.years) {
    parts.push(`${duration.years} ${duration.years === 1 ? "year" : "years"}`);
  }
  if (duration.months) {
    parts.push(
      `${duration.months} ${duration.months === 1 ? "month" : "months"}`,
    );
  }
  if (duration.weeks) {
    parts.push(`${duration.weeks} ${duration.weeks === 1 ? "week" : "weeks"}`);
  }
  if (duration.days) {
    parts.push(`${duration.days} ${duration.days === 1 ? "day" : "days"}`);
  }
  if (duration.hours) {
    parts.push(`${duration.hours} ${duration.hours === 1 ? "hour" : "hours"}`);
  }
  if (duration.minutes) {
    parts.push(
      `${duration.minutes} ${duration.minutes === 1 ? "minute" : "minutes"}`,
    );
  }
  if (duration.seconds) {
    parts.push(
      `${duration.seconds} ${duration.seconds === 1 ? "second" : "seconds"}`,
    );
  }
  if (duration.milliseconds) {
    parts.push(
      `${duration.milliseconds} ${duration.milliseconds === 1 ? "millisecond" : "milliseconds"}`,
    );
  }

  if (parts.length === 0) {
    return "0 seconds";
  }

  if (parts.length === 1) {
    const first = parts[0];
    if (first === undefined) {
      return "0 seconds";
    }
    return first;
  }

  if (parts.length === 2) {
    return `${parts[0]} and ${parts[1]}`;
  }

  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/**
 * Add duration to a date
 */
export function addDuration(
  date: Date | number | string,
  duration: Duration,
): Date {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;

  const result = new Date(dateObj);

  if (duration.years) {
    result.setFullYear(result.getFullYear() + duration.years);
  }
  if (duration.months) {
    result.setMonth(result.getMonth() + duration.months);
  }
  if (duration.weeks) {
    result.setDate(result.getDate() + duration.weeks * 7);
  }
  if (duration.days) {
    result.setDate(result.getDate() + duration.days);
  }
  if (duration.hours) {
    result.setHours(result.getHours() + duration.hours);
  }
  if (duration.minutes) {
    result.setMinutes(result.getMinutes() + duration.minutes);
  }
  if (duration.seconds) {
    result.setSeconds(result.getSeconds() + duration.seconds);
  }
  if (duration.milliseconds) {
    result.setMilliseconds(result.getMilliseconds() + duration.milliseconds);
  }

  return result;
}

/**
 * Subtract duration from a date
 */
export function subtractDuration(
  date: Date | number | string,
  duration: Duration,
): Date {
  const negatedDuration: Duration = {};
  if (duration.years) negatedDuration.years = -duration.years;
  if (duration.months) negatedDuration.months = -duration.months;
  if (duration.weeks) negatedDuration.weeks = -duration.weeks;
  if (duration.days) negatedDuration.days = -duration.days;
  if (duration.hours) negatedDuration.hours = -duration.hours;
  if (duration.minutes) negatedDuration.minutes = -duration.minutes;
  if (duration.seconds) negatedDuration.seconds = -duration.seconds;
  if (duration.milliseconds) {
    negatedDuration.milliseconds = -duration.milliseconds;
  }
  return addDuration(date, negatedDuration);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get start of day
 */
export function startOfDay(date: Date | number | string): Date {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;
  const result = new Date(dateObj);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day
 */
export function endOfDay(date: Date | number | string): Date {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;
  const result = new Date(dateObj);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Get start of week
 */
export function startOfWeek(
  date: Date | number | string,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0,
): Date {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;
  const result = new Date(dateObj);
  const day = result.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  result.setDate(result.getDate() - diff);
  return startOfDay(result);
}

/**
 * Get end of week
 */
export function endOfWeek(
  date: Date | number | string,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0,
): Date {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;
  const start = startOfWeek(dateObj, weekStartsOn);
  const result = new Date(start);
  result.setDate(result.getDate() + 6);
  return endOfDay(result);
}

/**
 * Get start of month
 */
export function startOfMonth(date: Date | number | string): Date {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;
  const result = new Date(dateObj);
  result.setDate(1);
  return startOfDay(result);
}

/**
 * Get end of month
 */
export function endOfMonth(date: Date | number | string): Date {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;
  const result = new Date(dateObj);
  result.setMonth(result.getMonth() + 1, 0);
  return endOfDay(result);
}

/**
 * Get start of year
 */
export function startOfYear(date: Date | number | string): Date {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;
  const result = new Date(dateObj);
  result.setMonth(0, 1);
  return startOfDay(result);
}

/**
 * Get end of year
 */
export function endOfYear(date: Date | number | string): Date {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;
  const result = new Date(dateObj);
  result.setMonth(11, 31);
  return endOfDay(result);
}

/**
 * Check if date is today
 */
export function isToday(date: Date | number | string): boolean {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;
  const today = startOfDay(new Date());
  const checkDate = startOfDay(dateObj);
  return today.getTime() === checkDate.getTime();
}

/**
 * Check if date is in the past
 */
export function isPast(date: Date | number | string): boolean {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;
  return dateObj.getTime() < Date.now();
}

/**
 * Check if date is in the future
 */
export function isFuture(date: Date | number | string): boolean {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;
  return dateObj.getTime() > Date.now();
}

/**
 * Check if date is between two dates (inclusive)
 */
export function isBetween(
  date: Date | number | string,
  start: Date | number | string,
  end: Date | number | string,
): boolean {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;
  const startObj =
    typeof start === "string" || typeof start === "number"
      ? new Date(start)
      : start;
  const endObj =
    typeof end === "string" || typeof end === "number" ? new Date(end) : end;

  const time = dateObj.getTime();
  const startTime = startObj.getTime();
  const endTime = endObj.getTime();

  return time >= startTime && time <= endTime;
}

/**
 * Get difference in milliseconds between two dates
 */
export function diffInMilliseconds(
  start: Date | number | string,
  end: Date | number | string,
): number {
  const startObj =
    typeof start === "string" || typeof start === "number"
      ? new Date(start)
      : start;
  const endObj =
    typeof end === "string" || typeof end === "number" ? new Date(end) : end;
  return endObj.getTime() - startObj.getTime();
}

/**
 * Get difference in seconds between two dates
 */
export function diffInSeconds(
  start: Date | number | string,
  end: Date | number | string,
): number {
  return Math.floor(diffInMilliseconds(start, end) / 1000);
}

/**
 * Get difference in minutes between two dates
 */
export function diffInMinutes(
  start: Date | number | string,
  end: Date | number | string,
): number {
  return Math.floor(diffInSeconds(start, end) / 60);
}

/**
 * Get difference in hours between two dates
 */
export function diffInHours(
  start: Date | number | string,
  end: Date | number | string,
): number {
  return Math.floor(diffInMinutes(start, end) / 60);
}

/**
 * Get difference in days between two dates
 */
export function diffInDays(
  start: Date | number | string,
  end: Date | number | string,
): number {
  return Math.floor(diffInHours(start, end) / 24);
}

/**
 * Get difference in weeks between two dates
 */
export function diffInWeeks(
  start: Date | number | string,
  end: Date | number | string,
): number {
  return Math.floor(diffInDays(start, end) / 7);
}

/**
 * Get difference in months between two dates
 */
export function diffInMonths(
  start: Date | number | string,
  end: Date | number | string,
): number {
  const startObj =
    typeof start === "string" || typeof start === "number"
      ? new Date(start)
      : start;
  const endObj =
    typeof end === "string" || typeof end === "number" ? new Date(end) : end;

  const years = endObj.getFullYear() - startObj.getFullYear();
  const months = endObj.getMonth() - startObj.getMonth();
  return years * 12 + months;
}

/**
 * Get difference in years between two dates
 */
export function diffInYears(
  start: Date | number | string,
  end: Date | number | string,
): number {
  const startObj =
    typeof start === "string" || typeof start === "number"
      ? new Date(start)
      : start;
  const endObj =
    typeof end === "string" || typeof end === "number" ? new Date(end) : end;
  return endObj.getFullYear() - startObj.getFullYear();
}
