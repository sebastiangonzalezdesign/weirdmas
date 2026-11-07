export interface Participant {
  id: string;
  name: string;
  avatarPath: string;
  accent: string;
}

// Add participants here; assignment and profile selection are data-driven.
export const participants: Participant[] = [
  { id: 'lu', name: 'Lu', avatarPath: '/assets/avatars/lu.png', accent: '#D8413F' },
  { id: 'sebastian', name: 'Sebastian', avatarPath: '/assets/avatars/sebastian.png', accent: '#7DA6DA' },
];
