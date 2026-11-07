export const challengeYear = 2026;
export const unlockHour = 6;

export function isDayUnlockedByDate(day: number, now = new Date()): boolean {
  const dayStart = new Date(challengeYear, 11, day, unlockHour, 0, 0, 0);
  return now >= dayStart;
}

export function formatChallengeDate(day: number): string {
  return new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(challengeYear, 11, day));
}
