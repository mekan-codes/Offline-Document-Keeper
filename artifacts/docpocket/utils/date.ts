const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function buildLocalDate(year: number, month: number, day: number): Date | null {
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

export function parseStoredDate(value: string | undefined): Date | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(trimmed);
  if (dateOnlyMatch) {
    return buildLocalDate(
      Number(dateOnlyMatch[1]),
      Number(dateOnlyMatch[2]),
      Number(dateOnlyMatch[3]),
    );
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatStoredDate(value: string | undefined): string | null {
  const parsed = parseStoredDate(value);
  return parsed ? parsed.toLocaleDateString() : null;
}

export function diffCalendarDaysFromToday(value: string | undefined): number | null {
  const parsed = parseStoredDate(value);
  if (!parsed) return null;

  const today = new Date();
  const targetUtc = Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((targetUtc - todayUtc) / MS_PER_DAY);
}
