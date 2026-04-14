export interface DateBounds {
  from: string;
  to: string;
}

export type DateRangePreset = 'thisMonth';

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toLocalDateString(year: number, month: number, day: number): string {
  return formatLocalDate(new Date(year, month, day));
}

export function getThisMonthDateRange(baseDate: Date = new Date()): DateBounds {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();

  return {
    from: toLocalDateString(year, month, 1),
    to: toLocalDateString(year, month + 1, 0),
  };
}
