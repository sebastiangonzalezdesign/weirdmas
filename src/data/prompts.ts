export interface Prompt { id: number; title: string }

export const prompts: Prompt[] = [
  'Frozen', 'Dead trees', 'Winter walk', 'Dark Nights', 'Long shadows', 'Moon & stars', 'Snowed in', 'Empty nest', 'Kicles', 'Reindeer', 'Storybook', 'Childhood', 'Wolves', 'Fuegos Fatuos', 'Fireside', 'Sweet Treat', 'Wreath', 'Ribbon', 'Angels', 'Gift', 'Toys', 'Heat', 'Snow', 'Nightmare', 'Eyes', 'Tea cup', 'Hypnotized', 'Peony', 'Dark Academia', 'Blood Bath', 'Scarf',
].map((title, index) => ({ id: index + 1, title }));
