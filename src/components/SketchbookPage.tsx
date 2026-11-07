import { useCallback, useEffect, useState } from 'react';
import type { Participant } from '../data/participants';
import type { Drawing } from './Gallery';

interface Props {
  drawings: Drawing[];
  participants: Participant[];
  onBack: () => void;
}

export function SketchbookPage({ drawings, participants, onBack }: Props) {
  const [zoomedDrawingIndex, setZoomedDrawingIndex] = useState<number | null>(null);
  const zoomedDrawing = zoomedDrawingIndex === null ? null : drawings[zoomedDrawingIndex];
  const moveDrawing = useCallback((offset: number) => {
    setZoomedDrawingIndex((index) => index === null ? null : Math.max(0, Math.min(drawings.length - 1, index + offset)));
  }, [drawings.length]);

  useEffect(() => {
    if (zoomedDrawingIndex === null) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setZoomedDrawingIndex(null);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveDrawing(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveDrawing(1);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [zoomedDrawingIndex, moveDrawing]);

  const artistName = (drawing: Drawing) => participants.find((person) => person.id === drawing.participantId)?.name ?? 'Artist';

  return <main className="app-shell sketchbook-page">
    <div className="sketchbook-page__inner">
      <div className="sketchbook-page__toolbar">
        <button className="text-button sketchbook-back" type="button" onClick={onBack}><span aria-hidden="true">←</span> Back to dashboard</button>
      </div>
      <header className="sketchbook-page__header">
        <span className="eyebrow">THE DIGITAL SKETCHBOOK</span>
        <h1>All the weird so far</h1>
        <p>Drawings are saved in this browser session only.</p>
      </header>
      {drawings.length === 0
        ? <section className="glass-panel book-empty sketchbook-empty">
          <img src="/assets/illustrations/Book.svg" alt="" />
          <h2>First page, still blank.</h2>
          <p>When drawings are added, they’ll collect here in the challenge book.</p>
        </section>
        : <div className="drawing-grid book-grid sketchbook-grid">
          {drawings.map((drawing, index) => <figure className="drawing-card" key={drawing.id}>
            <button className="drawing-card__preview" type="button" onClick={() => setZoomedDrawingIndex(index)} aria-label={`Enlarge ${drawing.name}`}>
              <img src={drawing.url} alt="" />
              <span className="drawing-card__zoom">Tap to enlarge</span>
            </button>
            <figcaption><span>{artistName(drawing)} · Day {drawing.day}</span><strong>{drawing.name}</strong></figcaption>
          </figure>)}
        </div>}
    </div>
    {zoomedDrawing && zoomedDrawingIndex !== null && <div className="drawing-lightbox" role="dialog" aria-modal="true" aria-labelledby="drawing-lightbox-title" onClick={(event) => { if (event.target === event.currentTarget) setZoomedDrawingIndex(null); }}>
      <button className="drawing-lightbox__close" type="button" onClick={() => setZoomedDrawingIndex(null)}>Close <span aria-hidden="true">×</span></button>
      <div className="drawing-lightbox__stage">
        {drawings.length > 1 && <button className="drawing-lightbox__nav drawing-lightbox__nav--previous" type="button" onClick={() => moveDrawing(-1)} disabled={zoomedDrawingIndex === 0} aria-label="Previous drawing">←</button>}
        <img src={zoomedDrawing.url} alt={zoomedDrawing.name} />
        {drawings.length > 1 && <button className="drawing-lightbox__nav drawing-lightbox__nav--next" type="button" onClick={() => moveDrawing(1)} disabled={zoomedDrawingIndex === drawings.length - 1} aria-label="Next drawing">→</button>}
      </div>
      <p id="drawing-lightbox-title">{artistName(zoomedDrawing)} · Day {zoomedDrawing.day} · {zoomedDrawing.name}</p>
    </div>}
  </main>;
}
