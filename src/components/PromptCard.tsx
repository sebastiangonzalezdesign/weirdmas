import { Icon } from './Icon';
import { formatChallengeDate, isDayUnlocked, promptFor } from '../lib/challenge';
import type { Participant } from '../data/participants';

interface Props { day: number; participant: Participant; revealed: boolean; onReveal: () => void }

export function PromptCard({ day, participant, revealed, onReveal }: Props) {
  const unlocked = isDayUnlocked(day);
  const prompt = promptFor(day, participant.id);
  return <section className="prompt-card" aria-labelledby="prompt-title">
    <div className="prompt-card__glow" aria-hidden="true" />
    <div className="prompt-meta"><span className="eyebrow">{unlocked ? 'YOUR WORD FOR TODAY IS' : 'THE CHALLENGE OPENS SOON'}</span><span className="prompt-date">{formatChallengeDate(day)}</span></div>
    {revealed ? <div className="prompt-revealed"><h2 id="prompt-title">{prompt.title}</h2><span>Day {day} · {participant.name}</span></div> : <div className="prompt-copy"><span className="prompt-spark"><Icon name={unlocked ? 'spark' : 'lock'} /></span><h2 id="prompt-title">{unlocked ? 'Ready to find out?' : 'A little weird is on its way.'}</h2><p>{unlocked ? 'Take a breath, then discover your drawing prompt.' : 'The next prompt unlocks at 6:00 am on its December day.'}</p><div className="prompt-placeholder" aria-hidden="true" /></div>}
    <button className="button button--discover" onClick={onReveal} disabled={!unlocked || revealed}>
      <Icon name={revealed ? 'check' : unlocked ? 'spark' : 'lock'} />{revealed ? 'Prompt discovered' : unlocked ? 'Discover prompt' : 'Locked until 6:00 am'}
    </button>
    <div className="prompt-number"><span>DAY</span><strong>{String(day).padStart(2, '0')}</strong><span>/ 31</span></div>
  </section>;
}
