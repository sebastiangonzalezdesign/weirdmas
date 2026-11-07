import { useMemo, useRef, useState } from 'react';
import { Calendar } from './components/Calendar';
import { Gallery, type Drawing } from './components/Gallery';
import { Icon } from './components/Icon';
import { ParticipantPicker } from './components/ParticipantPicker';
import { PromptCard } from './components/PromptCard';
import { participants } from './data/participants';

export default function App() {
  const [participantId, setParticipantId] = useState(participants[0].id);
  const [selectedDay, setSelectedDay] = useState(1);
  const [started, setStarted] = useState(false);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const participant = participants.find((person) => person.id === participantId) ?? participants[0];
  const completedDays = useMemo(() => drawings.filter((drawing) => drawing.participantId === participantId).map((drawing) => drawing.day), [drawings, participantId]);
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
    <div className="dashboard"><section className="dashboard-intro"><div><span className="eyebrow">HELLO, {participant.name.toUpperCase()}</span><h1>Make room for <em>the unusual.</em></h1></div><p>One prompt, one drawing, one day at a time.<br/>Let’s fill these pages with something unexpected.</p></section>
      <div className="dashboard-grid"><div className="dashboard-main"><PromptCard day={selectedDay} participant={participant} completed={completedDays.includes(selectedDay)} onUpload={uploadDrawing}/><Gallery drawings={drawings} participants={participants} activeDay={selectedDay} onUpload={uploadDrawing}/></div><Calendar selectedDay={selectedDay} onSelectDay={setSelectedDay} participant={participant} completedDays={completedDays}/></div>
      <footer className="footer-note"><span>MADE FOR THE MAGIC BETWEEN THE LINES</span><span>31 prompts <i/> 2 artists <i/> all kinds of weird</span></footer>
    </div>
    <input ref={fileInput} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { handleFile(event.target.files?.[0]); event.currentTarget.value = ''; }}/>
  </main>;
}
