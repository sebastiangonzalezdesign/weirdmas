import { requireSupabase } from './supabase';
import type { Drawing } from '../components/Gallery';
import type { Participant } from '../data/participants';

const bucketName = 'weirdmas-drawings';
const maxUploadBytes = 10 * 1024 * 1024;
const allowedImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export interface ChallengeState {
  participantId: string;
  activeDay: number | null;
  completedDays: number[];
  sharedReveal: boolean;
}

export interface PromptAssignment {
  day: number;
  title: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function loadParticipants(): Promise<Participant[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('participants')
    .select('id,name,role,avatar_path')
    .eq('is_active', true)
    .order('name');
  if (error) throw new Error(error.message);
  const rows: unknown = data;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('No active challenge participants are configured.');

  return rows.map((row: unknown) => {
    if (!isRecord(row) || typeof row.id !== 'string' || typeof row.name !== 'string') {
      throw new Error('A participant record is missing required information.');
    }
    return {
      id: row.id,
      name: row.name,
      role: typeof row.role === 'string' ? row.role : '',
      avatarPath: typeof row.avatar_path === 'string' ? row.avatar_path : '',
      accent: '#7DA6DA',
    };
  });
}

export async function bindParticipant(participantId: string, claimCode: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('bind_participant', {
    requested_participant_id: participantId,
    requested_claim_code: claimCode,
  });
  if (error) throw new Error(error.message);
}

export async function loadChallengeState(): Promise<ChallengeState | null> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('my_challenge_state');
  if (error) throw new Error(error.message);
  const first: unknown = Array.isArray(data) ? data[0] : data;
  if (!isRecord(first) || typeof first.participant_id !== 'string') return null;

  const activeDay = typeof first.active_day === 'number' ? first.active_day : null;
  const completedDays = Array.isArray(first.completed_days)
    ? first.completed_days.filter((day): day is number => typeof day === 'number')
    : [];
  return {
    participantId: first.participant_id,
    activeDay,
    completedDays,
    sharedReveal: first.shared_reveal === true,
  };
}

export async function loadPromptAssignments(): Promise<PromptAssignment[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('daily_assignments')
    .select('day,prompts(title)')
    .order('day');
  if (error) throw new Error(error.message);
  const rows: unknown = data;
  if (!Array.isArray(rows)) throw new Error('The prompt assignment response was not a list.');

  return rows.flatMap((row: unknown) => {
    if (!isRecord(row) || typeof row.day !== 'number' || !isRecord(row.prompts) || typeof row.prompts.title !== 'string') return [];
    return [{ day: row.day, title: row.prompts.title }];
  });
}

export async function loadDrawings(): Promise<Drawing[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('drawings')
    .select('id,participant_id,day,name,storage_path')
    .order('day');
  if (error) throw new Error(error.message);
  const rows: unknown = data;
  if (!Array.isArray(rows)) throw new Error('The drawing response was not a list.');
  const records = rows.filter((row): row is Record<string, unknown> => isRecord(row));

  if (records.length === 0) return [];
  const paths = records.map((row) => row.storage_path);
  if (paths.some((path) => typeof path !== 'string')) throw new Error('A saved drawing has an invalid storage path.');
  const validPaths = paths.filter((path): path is string => typeof path === 'string');
  const { data: signedUrls, error: signingError } = await client.storage
    .from(bucketName)
    .createSignedUrls(validPaths, 3600);
  if (signingError) throw new Error(signingError.message);
  if (!signedUrls || signedUrls.length !== records.length) throw new Error('Could not create secure links for every drawing.');

  return records.map((row, index) => {
    const signedUrl = signedUrls[index]?.signedUrl;
    if (!signedUrl || typeof row.id !== 'string' || typeof row.participant_id !== 'string' || typeof row.day !== 'number' || typeof row.name !== 'string' || typeof row.storage_path !== 'string') {
      throw new Error('A saved drawing is missing required information or a secure link.');
    }
    return {
      id: row.id,
      participantId: row.participant_id,
      day: row.day,
      name: row.name,
      url: signedUrl,
      storagePath: row.storage_path,
    };
  });
}

export async function revealPrompt(day: number): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('reveal_prompt', { requested_day: day });
  if (error) throw new Error(error.message);
  if (typeof data !== 'string') throw new Error('The prompt service returned an invalid response.');
  return data;
}

export async function saveDrawing(file: File, participantId: string, day: number, previousPath?: string): Promise<string | null> {
  if (!allowedImageTypes.has(file.type)) throw new Error('Choose a PNG, JPEG, WebP, or GIF image.');
  if (file.size > maxUploadBytes) throw new Error('Drawings must be 10 MB or smaller.');

  const client = requireSupabase();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-120) || 'drawing';
  const path = `${participantId}/${day}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await client.storage.from(bucketName).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  const name = file.name.replace(/\.[^.]+$/, '') || 'Untitled drawing';
  const { error: saveError } = await client.from('drawings').upsert({
    participant_id: participantId,
    day,
    name,
    storage_path: path,
  }, { onConflict: 'participant_id,day' });

  if (saveError) {
    const { error: cleanupError } = await client.storage.from(bucketName).remove([path]);
    const cleanupNote = cleanupError ? ` The uploaded file could not be cleaned up: ${cleanupError.message}` : '';
    throw new Error(`${saveError.message}${cleanupNote}`);
  }

  if (!previousPath || previousPath === path) return null;
  const { error: removeError } = await client.storage.from(bucketName).remove([previousPath]);
  return removeError ? `Drawing saved, but the replaced file could not be removed: ${removeError.message}` : null;
}

export function describeBackendError(error: unknown): string {
  return readError(error, 'An unexpected Supabase error occurred.');
}
