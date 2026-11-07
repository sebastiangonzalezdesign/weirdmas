import { useMemo, useRef, useState } from 'react';
import { Calendar } from './components/Calendar';
import { Gallery, type Drawing } from './components/Gallery';
import { Icon } from './components/Icon';
import { MobileBottomNav, type MobileTab } from './components/MobileBottomNav';
import { ParticipantPicker } from './components/ParticipantPicker';
import { PromptCard } from './components/PromptCard';
import { SketchbookPage } from './components/SketchbookPage';
import { UploadCard } from './components/UploadCard';
import { participants } from './data/participants';
import { isDayUnlocked } from './lib/challenge';

export default function App() {
  const [participantId, setParticipantId] = useState(participants[0].id);
  const [selectedDay, setSelectedDay] = useState(1);
  const [started, setStarted] = useState(false);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [showBook, setShowBook] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('today');
  const [revealedKeys, setRevealedKeys] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('weirdmas:revealed-prompts') ?? '[]') as string[]; }
    catch { return []; }
  });
  const fileInput = useRef<HTMLInputElement>(null);
  const participant = participants.find((person) => person.id === participantId) ?? participants[0];
  const selectMobileTab = (tab: MobileTab) => {
    setMobileTab(tab);
    setShowBook(tab === 'sketchbook');
  };
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
  const resetTestData = () => {
    if (!window.confirm('Reset all test data? This will remove session drawings and clear discovered prompts.')) return;
    drawings.forEach((drawing) => URL.revokeObjectURL(drawing.url));
    localStorage.removeItem('weirdmas:revealed-prompts');
    setDrawings([]);
    setRevealedKeys([]);
    setSelectedDay(1);
    setParticipantId(participants[0].id);
    setShowBook(false);
    setMobileTab('today');
    setStarted(false);
  };

  if (!started) return <main className="welcome-screen"><div className="welcome-orb welcome-orb--one"/><div className="welcome-orb welcome-orb--two"/><div className="welcome-content">
    <div className="welcome-brand"><img className="welcome-mascot" src="/assets/illustrations/cover.png" alt="" /><div className="brand-wordmark-row"><img className="brand-decoration brand-decoration--left" src="/assets/illustrations/decoration-left.svg" alt="" /><a className="wordmark" href="#top" aria-label="Weirdmas home">Weirdmas<span>®</span></a><img className="brand-decoration brand-decoration--right" src="/assets/illustrations/decoration-right.svg" alt="" /></div><span className="brand-caption welcome-brand-caption">DRAWING CHALLENGE</span></div>
    <span className="eyebrow welcome-kicker">A DECEMBER DRAWING RITUAL</span>
    <h1 className="welcome-title">Select your avatar</h1><p className="welcome-description">Thirty-one days. One small prompt. A sketchbook that gets stranger together.</p>
    <div className="glass-panel welcome-picker"><div className="section-heading"><div><span className="eyebrow">WHO’S DRAWING?</span><h2>Choose your profile</h2></div><Icon name="spark" className="welcome-spark"/></div><ParticipantPicker participants={participants} selectedId={participantId} onSelect={setParticipantId}/><button className="button button--primary welcome-button" onClick={() => setStarted(true)}>Continue <Icon name="arrow"/></button></div>
    <p className="welcome-footnote"><Icon name="lock"/> Local demo · drawings stay in this browser session.</p>
  </div><div className="welcome-side-note" aria-hidden="true">31 DAYS OF<br/>ODD LITTLE IDEAS</div></main>;

  if (showBook) return <>
    <SketchbookPage drawings={drawings} participants={participants} onBack={() => selectMobileTab('today')} />
    <MobileBottomNav activeTab="sketchbook" onSelect={selectMobileTab} />
  </>;

  return <>
  <main className="app-shell" id="top">
    <header className="topbar"><a className="wordmark wordmark--small" href="#top">Weirdmas<span>®</span></a><div className="topbar-center"><span className="topbar-spark">✳</span> DECEMBER 2026 <span className="topbar-spark">✳</span></div><div className="topbar-profile"><span className="topbar-greeting">Drawing as</span><select aria-label="Active profile" value={participantId} onChange={(event) => setParticipantId(event.target.value)}>{participants.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select><span className="tiny-avatar" aria-hidden="true"><span className="avatar-fallback">{participant.name[0]}</span><img src={participant.avatarPath} alt="" onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.parentElement?.classList.add('has-avatar-fallback'); }}/></span></div><button className="button button--secondary dashboard-reset" type="button" onClick={resetTestData} aria-label="Reset all test data" title="Reset all test data">Reset all</button></header>
    <div className={`dashboard dashboard--${mobileTab}`}><section className="dashboard-intro"><div className="profile-day"><span className="profile-day-avatar" aria-hidden="true"><span className="avatar-fallback">{participant.name[0]}</span><img src={participant.avatarPath} alt="" onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.parentElement?.classList.add('has-avatar-fallback'); }}/></span><div><span className="profile-date">A DRAWING CHALLENGE · DECEMBER 2026</span><h1>Day {selectedDay} <em>Hi {participant.name}</em></h1></div></div><div className="dashboard-brand"><span className="brand-spark brand-spark--one">✳</span><span className="brand-spark brand-spark--two">✳</span><img className="dashboard-mascot" src="/assets/illustrations/cover.png" alt="" /><div className="brand-wordmark-row"><img className="brand-decoration brand-decoration--left" src="/assets/illustrations/decoration-left.svg" alt="" /><span className="wordmark">Weirdmas</span><img className="brand-decoration brand-decoration--right" src="/assets/illustrations/decoration-right.svg" alt="" /></div><span className="brand-caption">DRAWING CHALLENGE</span></div></section>
      <div className="dashboard-grid"><div className="dashboard-column dashboard-column--left"><Calendar selectedDay={selectedDay} onSelectDay={(day) => { setSelectedDay(day); selectMobileTab('today'); }} participant={participant} completedDays={completedDays}/><Gallery drawings={drawings} participants={participants} activeDay={selectedDay} onOpen={() => selectMobileTab('sketchbook')}/></div><div className="dashboard-column dashboard-column--right"><PromptCard day={selectedDay} participant={participant} revealed={revealedKeys.includes(promptKey)} uploaded={completedDays.includes(selectedDay)} onReveal={revealPrompt}/><UploadCard onUpload={uploadDrawing} disabled={!isDayUnlocked(selectedDay)}/></div></div>
      <footer className="footer-note"><span>LOCAL DEMO · DRAWINGS STAY IN THIS BROWSER SESSION</span><span>31 prompts <i/> {participants.length} artists <i/> all kinds of weird</span></footer>
    </div>
    <input ref={fileInput} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { handleFile(event.target.files?.[0]); event.currentTarget.value = ''; }}/>
  </main>
  <MobileBottomNav activeTab={mobileTab} onSelect={selectMobileTab} />
  </>;
}
