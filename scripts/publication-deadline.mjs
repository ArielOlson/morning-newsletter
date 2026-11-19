import {DateTime} from 'luxon';
export function publicationDeadline(now = new Date()) {
  const local = DateTime.fromJSDate(now, {zone: 'America/New_York'});
  if (!local.isValid) throw Error('Invalid publication clock');
  return {day: local.toISODate(), timezone: 'America/New_York', deadlineAt: local.set({hour:5,minute:0,second:0,millisecond:0}).toUTC().toISO()};
}
export function deadlineResult(deadlineAt, completedAt) {
  const deadline = Date.parse(deadlineAt), completed = Date.parse(completedAt);
  if (!Number.isFinite(deadline) || !Number.isFinite(completed)) throw Error('Invalid publication deadline or completion time');
  return {publishedBeforeDeadline: completed < deadline, lateSeconds: Math.max(0, (completed - deadline) / 1000)};
}
