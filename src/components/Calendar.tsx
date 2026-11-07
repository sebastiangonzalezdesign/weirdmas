import { Icon } from './Icon';
import { formatChallengeDate, isDayUnlocked, promptFor } from '../lib/challenge';
import type { Participant } from '../data/participants';

interface Props { selectedDay: number; onSelectDay: (day: number) => void; participant: Participant; completedDays: number[] }
const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function Calendar({ selectedDay, onSelectDay, participant, completedDays }: Props) {
  return <section className="glass-panel calendar-panel" aria-labelledby="calendar-title">
    <div className="section-heading"><div><span className="eyebrow">THE CHALLENGE</span><h2 id="calendar-title">December <span>2026</span></h2></div><span className="calendar-icon"><Icon name="calendar" /></span></div>
    <p className="panel-copy">A new prompt unlocks every day at 6:00 am.</p>
    <div className="calendar-grid calendar-grid--week" aria-hidden="true">{weekdays.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
    <div className="calendar-grid" role="group" aria-label="December 2026 challenge days">
      {Array.from({ length: 31 }, (_, index) => {
        const day = index + 1;
        const unlocked = isDayUnlocked(day);
        const completed = completedDays.includes(day);
        const selected = selectedDay === day;
        const title = unlocked ? `${formatChallengeDate(day)}: ${promptFor(day, participant.id).title}${completed ? ', drawing uploaded' : ''}` : `${formatChallengeDate(day)}, locked until 6 am`;
        return <button key={day} className={`day-cell ${unlocked ? 'day-cell--open' : 'day-cell--locked'} ${completed ? 'day-cell--complete' : ''} ${selected ? 'is-current' : ''}`} onClick={() => unlocked && onSelectDay(day)} disabled={!unlocked} aria-label={title} aria-pressed={selected}>
          {completed ? <Icon name="check" /> : unlocked ? day : <><span>{day}</span><Icon name="lock" /></>}
        </button>;
      })}
    </div>
    <div className="calendar-legend"><span><i className="legend-dot legend-dot--open"/>Available</span><span><i className="legend-dot legend-dot--locked"/>Locked</span><span><i className="legend-dot legend-dot--complete"/>Created</span></div>
  </section>;
}
