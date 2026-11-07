import { participants } from '../data/participants';
import { prompts, type Prompt } from '../data/prompts';

export const challengeYear = 2026;
export const unlockHour = 6;

export function isDayUnlockedByDate(day: number, now = new Date()): boolean {
  const dayStart = new Date(challengeYear, 11, day, unlockHour, 0, 0, 0);
  return now >= dayStart;
}

export function isDayUnlocked(day: number, now = new Date()): boolean {
  return import.meta.env.DEV || isDayUnlockedByDate(day, now);
}

function hash(value: string): number {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}

/** Stable local demo assignment: each participant gets a different prompt on a given day. */
export function promptFor(day: number, participantId: string): Prompt {
  const ordered = [...prompts].sort((a, b) => hash(`${challengeYear}-12-${day}:${a.id}`) - hash(`${challengeYear}-12-${day}:${b.id}`));
  const participantIndex = Math.max(0, participants.findIndex((participant) => participant.id === participantId));
  return ordered[participantIndex % ordered.length];
}

export function formatChallengeDate(day: number): string {
  return new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(challengeYear, 11, day));
}
