import type { Participant } from '../data/participants';
import { Icon } from './Icon';

export interface Drawing { id: string; name: string; participantId: string; day: number; url: string }
interface Props { drawings: Drawing[]; participants: Participant[]; activeDay: number; onOpen: () => void }

export function Gallery({ drawings, participants, activeDay, onOpen }: Props) {
  const dayDrawings = drawings.filter((drawing) => drawing.day === activeDay);
  return <section className="glass-panel gallery-panel" aria-labelledby="gallery-title">
    <div className="section-heading section-heading--gallery"><div><span className="eyebrow">YOUR SAVED DRAWS</span><h2 id="gallery-title">Sketchbook <span className="count-pill">{dayDrawings.length}</span></h2></div><button className="text-button" onClick={onOpen}>See your book <Icon name="arrow" /></button></div>
    {dayDrawings.length === 0 ? <div className="gallery-empty"><div className="empty-art" aria-hidden="true"><img src="/assets/illustrations/Book.svg" alt="" /></div><div><h3>A page waiting for a little weird</h3><p>Your drawings will gather here as the challenge unfolds.</p></div></div> : <div className="drawing-grid">{dayDrawings.map((drawing) => {
      const maker = participants.find((participant) => participant.id === drawing.participantId);
      return <figure className="drawing-card" key={drawing.id}><img src={drawing.url} alt={drawing.name}/><figcaption><span>{maker?.name ?? 'Artist'} · Day {drawing.day}</span><strong>{drawing.name}</strong></figcaption></figure>;
    })}</div>}
  </section>;
}
