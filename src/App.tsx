import { useMemo, useRef, useState } from 'react';
import { Calendar } from './components/Calendar';
import { Gallery, type Drawing } from './components/Gallery';
import { Icon } from './components/Icon';
import { ParticipantPicker } from './components/ParticipantPicker';
import { PromptCard } from './components/PromptCard';
import { UploadCard } from './components/UploadCard';
import { participants } from './data/participants';
import { isDayUnlocked } from './lib/challenge';

export default function App() {
  const [participantId, setParticipantId] = useState(participants[0].id);
  const [selectedDay, setSelectedDay] = useState(1);
  const [started, setStarted] = useState(false);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [showBook, setShowBook] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('weirdmas:revealed-prompts') ?? '[]') as string[]; }
    catch { return []; }
  });
  const fileInput = useRef<HTMLInputElement>(null);
  const participant = participants.find((person) => person.id === participantId) ?? participants[0];
  const completedDays = useMemo(() => drawings.filter((drawing) => drawing.participantId === participantId).map((drawing) => drawing.day), [drawings, participantId]);
  const promptKey = `${participantId}:2026-12-${String(selectedDay).padStart(2, '0')}`;
  const revealPrompt = () => setRevealedKeys((current) => {
    if (current.includes(promptKey)) return current;
    const next = [...current, promptKey];
    localStorage.setItem('weirdmas:revealed-prompts', JSON.stringify(next));
    return next;
  });
  const uploadDrawing = () => fileInput.current?.click();

  const handleFile = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setDrawings((existing) => [...existing, { id: `${Date.now()}-${Math.random()}`, name: file.name.replace(/\.[^.]+$/, ''), participantId, day: selectedDay, url }]);
  };

  if (!started) return <main className="welcome-screen"><div className="welcome-orb welcome-orb--one"/><div className="welcome-orb welcome-orb--two"/><div className="welcome-content">
    <a className="wordmark" href="#top" aria-label="Weirdmas home">Weirdmas<span>®</span></a><span className="eyebrow welcome-kicker">A DECEMBER DRAWING RITUAL</span>
    <h1>Make something<br/><em>a little weird.</em></h1><p className="welcome-description">Thirty-one days. One small prompt. A sketchbook that gets stranger together.</p>
    <div className="glass-panel welcome-picker"><div className="section-heading"><div><span className="eyebrow">WHO’S DRAWING?</span><h2>Choose your profile</h2></div><Icon name="spark" className="welcome-spark"/></div><ParticipantPicker participants={participants} selectedId={participantId} onSelect={setParticipantId}/><button className="button button--primary welcome-button" onClick={() => setStarted(true)}>Enter the sketchbook <Icon name="arrow"/></button></div>
    <p className="welcome-footnote"><Icon name="lock"/> Your little corner of the challenge starts here.</p>
  </div><div className="welcome-side-note" aria-hidden="true">31 DAYS OF<br/>ODD LITTLE IDEAS</div></main>;

  return <main className="app-shell" id="top">
    <header className="topbar"><a className="wordmark wordmark--small" href="#top">Weirdmas<span>®</span></a><div className="topbar-center"><span className="topbar-spark">✳</span> DECEMBER 2026 <span className="topbar-spark">✳</span></div><div className="topbar-profile"><span className="topbar-greeting">Drawing as</span><select aria-label="Active profile" value={participantId} onChange={(event) => setParticipantId(event.target.value)}>{participants.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select><span className="tiny-avatar" aria-hidden="true">{participant.name[0]}</span></div></header>
    <div className="dashboard"><section className="dashboard-intro"><div className="profile-day"><span className="profile-day-avatar" aria-hidden="true">{participant.name[0]}</span><div><span className="profile-date">A DRAWING CHALLENGE · DECEMBER 2026</span><h1>Day {selectedDay} <em>Hi {participant.name}</em></h1></div></div><div className="dashboard-brand"><span className="brand-spark brand-spark--one">✳</span><span className="brand-spark brand-spark--two">✳</span><span className="wordmark">Weirdmas</span><span className="brand-caption">DRAWING CHALLENGE</span></div></section>
      <div className="dashboard-grid"><div className="dashboard-column dashboard-column--left"><Calendar selectedDay={selectedDay} onSelectDay={setSelectedDay} participant={participant} completedDays={completedDays}/><Gallery drawings={drawings} participants={participants} activeDay={selectedDay} onOpen={() => setShowBook(true)}/></div><div className="dashboard-column dashboard-column--right"><PromptCard day={selectedDay} participant={participant} revealed={revealedKeys.includes(promptKey)} onReveal={revealPrompt}/><UploadCard onUpload={uploadDrawing} disabled={!isDayUnlocked(selectedDay)}/></div></div>
      <footer className="footer-note"><span>MADE FOR THE MAGIC BETWEEN THE LINES</span><span>31 prompts <i/> 2 artists <i/> all kinds of weird</span></footer>
    </div>
    {showBook && <div className="book-overlay" role="dialog" aria-modal="true" aria-labelledby="book-title"><section className="book-modal glass-panel"><div className="section-heading"><div><span className="eyebrow">THE DIGITAL SKETCHBOOK</span><h2 id="book-title">All the weird so far</h2></div><button className="text-button" onClick={() => setShowBook(false)}>Close <span aria-hidden="true">×</span></button></div>{drawings.length === 0 ? <div className="book-empty"><Icon name="book"/><h3>First page, still blank.</h3><p>When drawings are added, they’ll collect here in the challenge book.</p></div> : <div className="drawing-grid book-grid">{drawings.map((drawing) => <figure className="drawing-card" key={drawing.id}><img src={drawing.url} alt={drawing.name}/><figcaption><span>{participants.find((person) => person.id === drawing.participantId)?.name ?? 'Artist'} · Day {drawing.day}</span><strong>{drawing.name}</strong></figcaption></figure>)}</div>}</section></div>}
    <input ref={fileInput} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { handleFile(event.target.files?.[0]); event.currentTarget.value = ''; }}/>
  </main>;
}
