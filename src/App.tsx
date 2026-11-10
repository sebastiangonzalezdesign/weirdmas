import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Calendar } from './components/Calendar';
import { Gallery, type Drawing } from './components/Gallery';
import { Icon } from './components/Icon';
import { MobileBottomNav, type MobileTab } from './components/MobileBottomNav';
import { ParticipantPicker } from './components/ParticipantPicker';
import { PromptCard } from './components/PromptCard';
import { SketchbookPage } from './components/SketchbookPage';
import { UploadCard, type UploadFeedback } from './components/UploadCard';
import { participants as initialParticipants } from './data/participants';
import type { Participant } from './data/participants';
import { supabase, supabaseConfigurationError } from './lib/supabase';
import {
  bindParticipant,
  describeBackendError,
  loadChallengeState,
  loadDrawings,
  loadParticipants,
  loadPromptAssignments,
  revealPrompt as requestPromptReveal,
  resetTestChallenge,
  saveDrawing,
  type ChallengeState,
  type PromptAssignment,
} from './lib/supabaseApi';

const noCompletedDays: number[] = [];

export default function App() {
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants);
  const [participantId, setParticipantId] = useState(initialParticipants[0].id);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [challengeLoaded, setChallengeLoaded] = useState(false);
  const [challengeState, setChallengeState] = useState<ChallengeState | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [promptAssignments, setPromptAssignments] = useState<PromptAssignment[]>([]);
  const [authStage, setAuthStage] = useState<'profile' | 'email' | 'otp' | 'claim-code'>('profile');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [claimCode, setClaimCode] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [uploadFeedback, setUploadFeedback] = useState<UploadFeedback | null>(null);
  const [showBook, setShowBook] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('today');
  const fileInput = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    const scrollToTop = () => window.scrollTo(0, 0);
    scrollToTop();
    window.addEventListener('pageshow', scrollToTop);
    return () => window.removeEventListener('pageshow', scrollToTop);
  }, []);

  const refreshChallenge = useCallback(async (showLoading = true) => {
    if (showLoading) setDashboardLoading(true);
    try {
      const state = await loadChallengeState();
      if (!state) {
        setChallengeState(null);
        setDrawings([]);
        setPromptAssignments([]);
        setChallengeLoaded(true);
        return;
      }

      const [nextDrawings, nextAssignments] = await Promise.all([
        loadDrawings(),
        loadPromptAssignments(),
      ]);
      setChallengeState(state);
      setParticipantId(state.participantId);
      setDrawings(nextDrawings);
      setPromptAssignments(nextAssignments);
      setSelectedDay((current) => state.activeDay ?? (state.completedDays.includes(current) ? current : state.completedDays.at(-1) ?? 1));
      setChallengeLoaded(true);
      setErrorMessage('');
    } finally {
      if (showLoading) setDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });

    void (async () => {
      try {
        const [loadedParticipants, { data, error }] = await Promise.all([
          loadParticipants(),
          supabase.auth.getSession(),
        ]);
        if (error) throw error;
        if (!active) return;
        setParticipants(loadedParticipants);
        setParticipantId((current) => loadedParticipants.some((participant) => participant.id === current) ? current : loadedParticipants[0].id);
        setSession(data.session);
        if (data.session) await refreshChallenge(false);
      } catch (error: unknown) {
        if (active) setErrorMessage(describeBackendError(error));
      } finally {
        if (active) {
          setAuthReady(true);
          setDashboardLoading(false);
        }
      }
    })();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [refreshChallenge]);

  const participant = participants.find((person) => person.id === participantId) ?? participants[0];
  const completedDays = challengeState?.completedDays ?? noCompletedDays;
  const activeDay = challengeState?.activeDay ?? null;
  const promptTitle = promptAssignments.find((assignment) => assignment.day === selectedDay)?.title;
  const canEditSelectedDay = Boolean(challengeState && !challengeState.sharedReveal && (selectedDay === activeDay || completedDays.includes(selectedDay)));
  const availableDays = useMemo(() => activeDay === null ? completedDays : [...completedDays, activeDay], [activeDay, completedDays]);

  const selectMobileTab = (tab: MobileTab) => {
    setMobileTab(tab);
    setShowBook(tab === 'sketchbook');
    window.requestAnimationFrame(() => window.scrollTo(0, 0));
  };

  const continueFromProfile = async () => {
    setErrorMessage('');
    setNotice('');
    setUploadFeedback(null);
    if (!participant) return;
    if (!session) {
      setAuthStage('email');
      return;
    }

    setAuthLoading(true);
    try {
      const state = await loadChallengeState();
      if (state) {
        setParticipantId(state.participantId);
        await refreshChallenge();
      } else {
        setAuthStage('claim-code');
      }
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const sendOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setAuthLoading(true);
    setErrorMessage('');
    setNotice('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setAuthStage('otp');
      setNotice('A sign-in code is on its way. Check your email, including spam.');
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const verifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setAuthLoading(true);
    setErrorMessage('');
    setNotice('');
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: 'email',
      });
      if (error) throw error;
      if (!data.session) throw new Error('Email verification completed without an authenticated session.');
      setSession(data.session);
      const state = await loadChallengeState();
      if (state) {
        setParticipantId(state.participantId);
        await refreshChallenge();
      } else {
        setChallengeState(null);
        setDrawings([]);
        setPromptAssignments([]);
        setChallengeLoaded(true);
        setAuthStage('claim-code');
        setNotice('Email verified. Enter your one-time profile code to finish setup.');
      }
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const claimProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) return;
    setAuthLoading(true);
    setErrorMessage('');
    setNotice('');
    try {
      await bindParticipant(participantId, claimCode.trim());
      await refreshChallenge();
      setClaimCode('');
      setAuthStage('profile');
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    setErrorMessage('');
    const { error } = await supabase.auth.signOut();
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setSession(null);
    setChallengeState(null);
    setChallengeLoaded(false);
    setDrawings([]);
    setPromptAssignments([]);
    setSelectedDay(1);
    setShowBook(false);
    setMobileTab('today');
    setAuthStage('profile');
    setOtp('');
    setClaimCode('');
    setNotice('');
    setUploadFeedback(null);
  };

  const revealSelectedPrompt = async () => {
    setIsRevealing(true);
    setErrorMessage('');
    setNotice('');
    try {
      const title = await requestPromptReveal(selectedDay);
      setPromptAssignments((current) => [...current.filter((assignment) => assignment.day !== selectedDay), { day: selectedDay, title }]);
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setIsRevealing(false);
    }
  };

  const resetTestProgress = async () => {
    if (!challengeState?.testMode || participantId !== 'sebastian') return;
    if (!window.confirm('Reset both test sketchbooks? All test drawings and revealed prompts will be deleted. Profile bindings and claim codes will stay.')) return;

    setIsResetting(true);
    setErrorMessage('');
    setNotice('');
    try {
      await resetTestChallenge();
      await refreshChallenge();
      setSelectedDay(1);
      setShowBook(false);
      setMobileTab('today');
      setNotice('Both test sketchbooks were reset.');
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setIsResetting(false);
    }
  };

  const uploadDrawing = () => fileInput.current?.click();

  const handleFiles = async (files: File[]) => {
    if (files.length === 0 || !challengeState || !canEditSelectedDay) return;
    const uploadDay = selectedDay;
    const uploadParticipantId = participantId;
    setIsSaving(true);
    setErrorMessage('');
    setNotice('');
    setUploadFeedback(null);
    let savedCount = 0;
    const failures: string[] = [];
    try {
      for (const file of files) {
        try {
          await saveDrawing(file, uploadParticipantId, uploadDay);
          savedCount += 1;
        } catch (error: unknown) {
          failures.push(`${file.name}: ${describeBackendError(error)}`);
        }
      }

      let refreshError = '';
      if (savedCount > 0) {
        try {
          await refreshChallenge(false);
        } catch (error: unknown) {
          refreshError = describeBackendError(error);
        }
      }

      if (failures.length === 0 && !refreshError) {
        const label = savedCount === 1 ? 'drawing' : 'drawings';
        setUploadFeedback({
          kind: 'success',
          message: `${savedCount} ${label} saved to Day ${uploadDay}. You can add more by selecting that day in the calendar.`,
        });
      } else {
        const summary = savedCount > 0
          ? `${savedCount} of ${files.length} drawings saved to Day ${uploadDay}.`
          : 'No drawings were saved.';
        const details = [...failures, refreshError ? `Could not refresh the sketchbook: ${refreshError}` : ''].filter(Boolean).join(' ');
        setUploadFeedback({ kind: 'error', message: `${summary} ${details}`.trim() });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const signInScreen = () => {
    if (session && !challengeLoaded) {
      return <div className="glass-panel welcome-picker">
        <h2>Connecting your sketchbook</h2>
        {errorMessage && <p className="form-message form-message--error" role="alert">{errorMessage}</p>}
        <button className="button button--primary welcome-button" type="button" onClick={() => { setErrorMessage(''); void refreshChallenge().catch((error: unknown) => setErrorMessage(describeBackendError(error))); }}>Try again</button>
        <button className="text-button auth-back" type="button" onClick={() => { void signOut(); }}>Sign out</button>
      </div>;
    }

    if (authStage === 'email') {
      return <form className="glass-panel welcome-picker auth-form" onSubmit={(event) => { void sendOtp(event); }}>
        <div className="section-heading"><div><span className="eyebrow">YOUR EMAIL</span><h2>Where should we send your code?</h2></div><Icon name="lock" className="welcome-spark"/></div>
        <label className="auth-label" htmlFor="participant-email">Email address</label>
        <input id="participant-email" className="auth-input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <button className="button button--primary welcome-button" type="submit" disabled={authLoading}>{authLoading ? 'Sending code…' : 'Send sign-in code'} <Icon name="arrow"/></button>
        <button className="text-button auth-back" type="button" onClick={() => setAuthStage('profile')}>Back to profile</button>
      </form>;
    }

    if (authStage === 'otp') {
      return <form className="glass-panel welcome-picker auth-form" onSubmit={(event) => { void verifyOtp(event); }}>
        <div className="section-heading"><div><span className="eyebrow">CHECK YOUR EMAIL</span><h2>Enter your sign-in code</h2></div><Icon name="lock" className="welcome-spark"/></div>
        <p className="panel-copy">We sent a code to {email.trim()}.</p>
        <label className="auth-label" htmlFor="email-otp">One-time code</label>
        <input id="email-otp" className="auth-input auth-input--otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} required value={otp} onChange={(event) => setOtp(event.target.value)} />
        <button className="button button--primary welcome-button" type="submit" disabled={authLoading}>{authLoading ? 'Verifying…' : 'Verify email'} <Icon name="arrow"/></button>
        <button className="text-button auth-back" type="button" onClick={() => { setAuthStage('email'); setOtp(''); }}>Use a different email</button>
      </form>;
    }

    if (authStage === 'claim-code') {
      return <form className="glass-panel welcome-picker auth-form" onSubmit={(event) => { void claimProfile(event); }}>
        <div className="section-heading"><div><span className="eyebrow">CLAIM YOUR PROFILE</span><h2>Enter your private code</h2></div><Icon name="lock" className="welcome-spark"/></div>
        <p className="panel-copy">Enter the one-time code shared with you for {participant.name}. It links this email account to this profile.</p>
        <label className="auth-label" htmlFor="profile-claim-code">Profile code</label>
        <input id="profile-claim-code" className="auth-input auth-input--claim-code" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={36} required value={claimCode} onChange={(event) => setClaimCode(event.target.value)} />
        <button className="button button--primary welcome-button" type="submit" disabled={authLoading}>{authLoading ? 'Claiming profile…' : 'Claim profile'} <Icon name="arrow"/></button>
        <button className="text-button auth-back" type="button" onClick={() => { setClaimCode(''); setAuthStage('profile'); }}>Choose a different profile</button>
        <button className="text-button auth-back" type="button" onClick={() => { setClaimCode(''); setEmail(''); void signOut(); }}>Use a different email</button>
      </form>;
    }

    return <div className="glass-panel welcome-picker">
      <div className="section-heading"><div><span className="eyebrow">WHO’S DRAWING?</span><h2>Choose your profile</h2></div><Icon name="spark" className="welcome-spark"/></div>
      {session && <p className="panel-copy">This email account isn’t linked to a profile yet. Choose yours and enter its one-time profile code.</p>}
      <ParticipantPicker participants={participants} selectedId={participantId} onSelect={(id) => { setParticipantId(id); setClaimCode(''); setErrorMessage(''); }} />
      <button className="button button--primary welcome-button" type="button" onClick={() => { void continueFromProfile(); }} disabled={authLoading || Boolean(supabaseConfigurationError)}>
        {authLoading ? 'Connecting…' : session ? 'Open my sketchbook' : 'Continue with email'} <Icon name="arrow"/>
      </button>
    </div>;
  };

  if (!authReady) return <main className="welcome-screen"><div className="welcome-content"><p className="welcome-description">Connecting to your private sketchbook…</p></div></main>;
  if (showBook && challengeState) return <>
    <SketchbookPage drawings={drawings} participants={participants} participant={participant} prompts={promptAssignments} currentDay={selectedDay} sharedReveal={challengeState.sharedReveal} onBack={() => selectMobileTab('today')} />
    <MobileBottomNav activeTab="sketchbook" onSelect={selectMobileTab} />
  </>;

  if (!session || !challengeState) return <main className="welcome-screen">
    <div className="welcome-orb welcome-orb--one"/><div className="welcome-orb welcome-orb--two"/>
    <div className="welcome-content">
      <div className="welcome-brand"><img className="welcome-mascot" src="/assets/illustrations/cover.png" alt="" /><div className="brand-wordmark-row"><img className="brand-decoration brand-decoration--left" src="/assets/illustrations/decoration-left.svg" alt="" /><a className="wordmark" href="#top" aria-label="Weirdmas home">Weirdmas<span>®</span></a><img className="brand-decoration brand-decoration--right" src="/assets/illustrations/decoration-right.svg" alt="" /></div></div>
      <span className="eyebrow welcome-kicker">A DECEMBER DRAWING RITUAL</span>
      <h1 className="welcome-title">{session ? authStage === 'claim-code' ? 'Claim your profile' : 'Choose your profile' : authStage === 'email' ? 'Your sketchbook awaits' : authStage === 'otp' ? 'One small step' : 'Select your avatar'}</h1>
      <p className="welcome-description">Thirty-one days. One small prompt. A sketchbook that gets stranger together.</p>
      {supabaseConfigurationError && <p className="form-message form-message--error" role="alert">{supabaseConfigurationError}</p>}
      {errorMessage && !(session && !challengeLoaded) && <p className="form-message form-message--error" role="alert">{errorMessage}</p>}
      {notice && <p className="form-message form-message--success" role="status">{notice}</p>}
      {signInScreen()}
      <p className="welcome-footnote"><Icon name="lock"/> Private accounts · drawings shared after both sketchbooks are complete.</p>
    </div>
    <div className="welcome-side-note" aria-hidden="true">31 DAYS OF<br/>ODD LITTLE IDEAS</div>
  </main>;

  return <>
    <main className="app-shell" id="top">
      <header className="topbar">
        <a className="wordmark wordmark--small" href="#top">Weirdmas<span>®</span></a>
        <div className="topbar-center"><span className="topbar-spark">✳</span> DECEMBER 2026 <span className="topbar-spark">✳</span></div>
        <div className="topbar-profile"><span className="topbar-greeting">Drawing as</span><strong>{participant.name}</strong><span className="tiny-avatar" aria-hidden="true"><span className="avatar-fallback">{participant.name[0]}</span><img src={participant.avatarPath} alt="" onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.parentElement?.classList.add('has-avatar-fallback'); }}/></span></div>
        <button className="button button--secondary dashboard-reset" type="button" onClick={() => { void signOut(); }}>Sign out</button>
      </header>
      <div className={`dashboard dashboard--${mobileTab}`}>
        {challengeState.testMode && <aside className="test-mode-banner">
          <div className="test-mode-banner__copy"><strong>TEST MODE</strong><span>Dates are bypassed; prompts still unlock one day at a time.</span></div>
          {participantId === 'sebastian' && <button className="button button--secondary test-mode-reset" type="button" disabled={isResetting} onClick={() => { void resetTestProgress(); }}>{isResetting ? 'Resetting…' : 'Reset both test sketchbooks'}</button>}
        </aside>}
        <section className="dashboard-intro">
          <div className="profile-day"><span className="profile-day-avatar" aria-hidden="true"><span className="avatar-fallback">{participant.name[0]}</span><img src={participant.avatarPath} alt="" onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.parentElement?.classList.add('has-avatar-fallback'); }}/></span><div><span className="profile-date">{participant.role}</span><h1>Day {selectedDay} <em>Hi {participant.name}</em></h1></div></div>
          <div className="dashboard-brand"><img className="dashboard-mascot" src="/assets/illustrations/cover.png" alt="" /><div className="brand-wordmark-row"><img className="brand-decoration brand-decoration--left" src="/assets/illustrations/decoration-left.svg" alt="" /><span className="wordmark">Weirdmas</span><img className="brand-decoration brand-decoration--right" src="/assets/illustrations/decoration-right.svg" alt="" /></div><span className="brand-caption">DRAWING CHALLENGE</span></div>
        </section>
        {errorMessage && <p className="form-message form-message--error dashboard-message" role="alert">{errorMessage}</p>}
        {notice && <p className="form-message form-message--success dashboard-message" role="status">{notice}</p>}
        {dashboardLoading && <p className="panel-copy dashboard-message" role="status">Refreshing your sketchbook…</p>}
        {challengeState.sharedReveal && <p className="form-message form-message--success dashboard-message" role="status">Both sketchbooks are complete. Shared drawings are now open.</p>}
        <div className="dashboard-grid">
          <div className="dashboard-column dashboard-column--left">
            <Calendar selectedDay={selectedDay} onSelectDay={(day) => { setSelectedDay(day); setErrorMessage(''); setNotice(''); setUploadFeedback(null); selectMobileTab('today'); }} completedDays={completedDays} activeDay={activeDay} availableDays={availableDays}/>
            <Gallery drawings={drawings} participants={participants} activeDay={selectedDay} sharedReveal={challengeState.sharedReveal} onOpen={() => selectMobileTab('sketchbook')}/>
          </div>
          <div className="dashboard-column dashboard-column--right">
            <PromptCard day={selectedDay} participant={participant} promptTitle={promptTitle} unlocked={selectedDay === activeDay} uploaded={completedDays.includes(selectedDay)} onReveal={() => { void revealSelectedPrompt(); }} isRevealing={isRevealing}/>
            <UploadCard onUpload={uploadDrawing} disabled={!canEditSelectedDay || isSaving || dashboardLoading} saving={isSaving} feedback={uploadFeedback}/>
          </div>
        </div>
        <footer className="footer-note"><span>PRIVATE DRAWINGS · SHARED AFTER BOTH FINISH</span><span>6:00 am Bogotá time <i/> {participants.length} artists <i/> all kinds of weird</span></footer>
      </div>
      <input ref={fileInput} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple disabled={!canEditSelectedDay || isSaving} onChange={(event) => { void handleFiles(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ''; }}/>
    </main>
    <MobileBottomNav activeTab={mobileTab} onSelect={selectMobileTab} />
  </>;
}
