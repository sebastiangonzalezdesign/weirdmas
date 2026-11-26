export const challengeYear = 2026;
export const unlockHour = 6;

export function currentChallengeDay(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  return month === 12 && year === challengeYear ? day : 0;
}

export function isDayUnlockedByDate(day: number, now = new Date()): boolean {
  const dayStart = new Date(challengeYear, 11, day, unlockHour, 0, 0, 0);
  return now >= dayStart;
}

export function formatChallengeDate(day: number): string {
  return new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(challengeYear, 11, day));
}
