import { Icon } from './Icon';
import { formatChallengeDate, isDayUnlocked, promptFor } from '../lib/challenge';
import type { Participant } from '../data/participants';

interface Props { day: number; participant: Participant; completed: boolean; onUpload: () => void }

export function PromptCard({ day, participant, completed, onUpload }: Props) {
  const unlocked = isDayUnlocked(day);
  const prompt = promptFor(day, participant.id);
  return <section className="prompt-card" aria-labelledby="prompt-title">
    <div className="prompt-card__glow" aria-hidden="true" />
    <div className="prompt-meta"><span className="eyebrow">{unlocked ? 'TODAY’S PROMPT' : 'UP NEXT'}</span><span className="prompt-date">{formatChallengeDate(day)}</span></div>
    <div className="prompt-copy"><span className="prompt-spark"><Icon name={unlocked ? 'spark' : 'lock'} /></span><h2 id="prompt-title">{unlocked ? prompt.title : 'The strange begins soon'}</h2><p>{unlocked ? 'Make it yours. Follow the idea wherever it takes you.' : 'Your first prompt arrives December 1 at 6:00 am.'}</p></div>
    <button className="button button--primary prompt-action" onClick={onUpload} disabled={!unlocked}>
      <Icon name={completed ? 'check' : 'upload'} />{completed ? 'Drawing added' : unlocked ? 'Upload your drawing' : 'Waiting for the first prompt'}
    </button>
    <div className="prompt-number"><span>DAY</span><strong>{String(day).padStart(2, '0')}</strong><span>/ 31</span></div>
  </section>;
}
