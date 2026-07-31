const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function calculateStageWeeks(startDate, endDate) {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (!start || !end || end <= start) {
    return "";
  }

  const dayCount =
    Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;

  return String(Math.ceil(dayCount / 7));
}

function parseDateOnly(value) {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}
