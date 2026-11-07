import { Icon } from './Icon';
import { formatChallengeDate } from '../lib/challenge';

interface Props { selectedDay: number; onSelectDay: (day: number) => void; completedDays: number[]; activeDay: number | null; availableDays: number[] }
const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function Calendar({ selectedDay, onSelectDay, completedDays, activeDay, availableDays }: Props) {
  return <section className="glass-panel calendar-panel" aria-labelledby="calendar-title">
    <div className="section-heading"><div><span className="eyebrow">THE CHALLENGE</span><h2 id="calendar-title">December <span>2026</span></h2></div><span className="calendar-icon"><Icon name="calendar" /></span></div>
    <p className="panel-copy">A new prompt unlocks every day at 6:00 am.</p>
    <div className="calendar-grid calendar-grid--week" aria-hidden="true">{weekdays.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
    <div className="calendar-grid" role="group" aria-label="December 2026 challenge days">
      {Array.from({ length: 31 }, (_, index) => {
        const day = index + 1;
        const completed = completedDays.includes(day);
        const available = availableDays.includes(day);
        const visuallyLocked = !available;
        const selected = selectedDay === day;
        const title = completed ? `${formatChallengeDate(day)}, drawing complete` : day === activeDay ? `${formatChallengeDate(day)}, current prompt` : `${formatChallengeDate(day)}, locked`;
        return <button key={day} className={`day-cell ${visuallyLocked ? 'day-cell--locked' : 'day-cell--open'} ${completed ? 'day-cell--complete' : ''} ${selected ? 'is-current' : ''}`} onClick={() => available && onSelectDay(day)} disabled={!available} aria-label={title} aria-pressed={selected}>
          {completed ? <Icon name="check" /> : <span>{day}</span>}
        </button>;
      })}
    </div>
    <div className="calendar-legend"><span><i className="legend-dot legend-dot--open"/>Available</span>{!import.meta.env.DEV && <span><i className="legend-dot legend-dot--locked"/>Locked</span>}<span><i className="legend-dot legend-dot--complete"/>Created</span></div>
  </section>;
}
