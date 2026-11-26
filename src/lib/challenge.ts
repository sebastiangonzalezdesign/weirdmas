export const challengeYear = 2026;
export const unlockHour = 6;
export const challengeStartsAt = new Date('2026-12-01T06:00:00-05:00');

export function isChallengeLaunched(now = new Date()): boolean {
  return now >= challengeStartsAt;
}

export function currentChallengeDay(now = new Date()): number {
  if (!isChallengeLaunched(now)) return 0;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hourCycle: 'h23' }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  if (month !== 12 || year !== challengeYear) return 0;
  return hour >= unlockHour ? day : Math.max(0, day - 1);
}

export function isDayUnlockedByDate(day: number, now = new Date()): boolean {
  const dayStart = new Date(challengeYear, 11, day, unlockHour, 0, 0, 0);
  return now >= dayStart;
}

export function formatChallengeDate(day: number): string {
  return new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(challengeYear, 11, day));
}
