export const PERIODS = [
  { id: 'today', key: 'periodToday' },
  { id: 'last7', key: 'periodLast7' },
  { id: 'last30', key: 'periodLast30' },
  { id: 'last3Months', key: 'periodLast3Months' },
  { id: 'custom', key: 'periodCustom' },
];

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getPeriodRange = (period, customStartDate, customEndDate, now = new Date()) => {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  let start = startOfDay(now);

  if (period === 'last7') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  } else if (period === 'last30') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  } else if (period === 'last3Months') {
    start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  } else if (period === 'custom') {
    start = startOfDay(customStartDate);
    const customEnd = startOfDay(customEndDate);
    return customEnd < start
      ? { start: customEnd, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1) }
      : { start, end: new Date(customEnd.getFullYear(), customEnd.getMonth(), customEnd.getDate() + 1) };
  }

  return { start, end };
};

export const filterLogsByPeriod = (logs, period, customStartDate, customEndDate) => {
  const { start, end } = getPeriodRange(period, customStartDate, customEndDate);
  const startTime = start.getTime();
  const endTime = end.getTime();

  return (logs || []).filter((log) => {
    const timestamp = new Date(log.timestamp).getTime();
    return !Number.isNaN(timestamp) && timestamp >= startTime && timestamp < endTime;
  });
};
