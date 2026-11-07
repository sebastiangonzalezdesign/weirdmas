export interface Participant {
  id: string;
  name: string;
  role: string;
  avatarPath: string;
  accent: string;
}

// Add participants here; assignment and profile selection are data-driven.
export const participants: Participant[] = [
  { id: 'lu', name: 'Lu', role: 'Anime Expert', avatarPath: '/assets/avatars/Lu.svg', accent: '#D8413F' },
  { id: 'sebastian', name: 'Sebastian', role: 'Time Travel Fan', avatarPath: '/assets/avatars/Sebastian.svg', accent: '#7DA6DA' },
];
