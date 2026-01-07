import dayjs from "dayjs";

export const DATE_FORMAT_BR = "DD/MM/YYYY";

export function formatDateBR(dateInput, fmt = DATE_FORMAT_BR) {
  if (!dateInput) return "N/A";
  const d = dayjs(dateInput);
  return d.isValid() ? d.format(fmt) : "N/A";
}

export function startOfDay(dateInput) {
  return dayjs(dateInput).startOf("day");
}

export function endOfDay(dateInput) {
  return dayjs(dateInput).endOf("day");
}

export function getDateRangePreset(preset) {
  const now = dayjs();
  switch (preset) {
    case "7d":
      return { start: now.subtract(7, "day").startOf("day"), end: now.endOf("day") };
    case "30d":
      return { start: now.subtract(30, "day").startOf("day"), end: now.endOf("day") };
    case "90d":
      return { start: now.subtract(90, "day").startOf("day"), end: now.endOf("day") };
    case "month":
      return { start: now.startOf("month"), end: now.endOf("month") };
    case "all":
    default:
      return { start: null, end: null };
  }
}

export function isWithinRange(dateInput, range) {
  if (!dateInput) return false;
  if (!range?.start || !range?.end) return true;
  const d = dayjs(dateInput);
  if (!d.isValid()) return false;
  return d.isAfter(range.start) || d.isSame(range.start) ? (d.isBefore(range.end) || d.isSame(range.end)) : false;
}


