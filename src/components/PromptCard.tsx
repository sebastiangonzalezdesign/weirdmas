import { Icon } from './Icon';
import { formatChallengeDate } from '../lib/challenge';
import type { Participant } from '../data/participants';

interface Props { day: number; participant: Participant; promptTitle?: string; unlocked: boolean; uploaded: boolean; onReveal: () => void; isRevealing?: boolean }

export function PromptCard({ day, participant, promptTitle, unlocked, uploaded, onReveal, isRevealing = false }: Props) {
  const revealed = Boolean(promptTitle);
  return <section className="prompt-card" aria-labelledby="prompt-title">
    <div className="prompt-card__glow" aria-hidden="true" />
    <div className="prompt-meta"><span className="eyebrow">{revealed ? 'YOUR PROMPT FOR THIS DAY' : unlocked ? 'YOUR WORD FOR TODAY IS' : 'THE CHALLENGE OPENS SOON'}</span><span className="prompt-date">{formatChallengeDate(day)}</span></div>
    {revealed ? <div className="prompt-revealed"><h2 id="prompt-title">{promptTitle}</h2><span>Day {day} · {participant.name}</span><p className="prompt-followup">{uploaded ? 'Day complete! Your drawing is saved in your private sketchbook.' : 'To complete the day, upload your drawing when you’re done.'}</p></div> : <div className="prompt-copy"><span className="prompt-spark"><Icon name={unlocked ? 'spark' : 'lock'} /></span><h2 id="prompt-title">{unlocked ? 'Ready to find out?' : 'A little weird is on its way.'}</h2><p>{unlocked ? 'Take a breath, then discover your drawing prompt.' : 'Your next prompt unlocks at 6:00 am Bogotá time.'}</p><div className="prompt-placeholder" aria-hidden="true" /></div>}
    <button className="button button--discover" onClick={onReveal} disabled={!unlocked || revealed || isRevealing}>
      <Icon name={revealed ? 'check' : unlocked ? 'spark' : 'lock'} />{revealed ? 'Prompt discovered' : isRevealing ? 'Revealing…' : unlocked ? 'Discover prompt' : 'Locked until 6:00 am'}
    </button>
    <div className="prompt-number"><span>DAY</span><strong>{String(day).padStart(2, '0')}</strong><span>/ 31</span></div>
  </section>;
}
