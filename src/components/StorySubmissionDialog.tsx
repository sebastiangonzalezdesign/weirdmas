import { useEffect, useRef, useState } from 'react';
import { submitStory } from '../lib/supabaseApi';

interface Props { initialContent: string; onClose: () => void; onSubmitted: () => void; }

export function StorySubmissionDialog({ initialContent, onClose, onSubmitted }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [content, setContent] = useState(initialContent);
  const [cover, setCover] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const dialog = ref.current; if (dialog && !dialog.open) dialog.showModal(); return () => { if (dialog?.open) dialog.close(); }; }, []);
  const loadText = async (file?: File) => { if (!file) return; if (file.size > 2 * 1024 * 1024) { setError('Text files must be 2 MB or smaller.'); return; } setContent(await file.text()); setError(''); };
  const upload = async () => {
    setBusy(true); setError('');
    try { await submitStory(content.trim(), cover); onSubmitted(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The story could not be uploaded.'); }
    finally { setBusy(false); }
  };
  return <dialog ref={ref} className="sketchbook-export-dialog" aria-labelledby="story-submit-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="sketchbook-export-dialog__inner">
      <div className="sketchbook-export-dialog__header"><div><span className="eyebrow">YOUR FINISHED STORY</span><h2 id="story-submit-title">Upload the written story</h2></div><button className="sketchbook-export-dialog__close" type="button" onClick={onClose} disabled={busy} aria-label="Close">×</button></div>
      <p className="sketchbook-export-dialog__description">Bring your daily pages together here. Add a cover image if you like, then upload the story privately to your sketchbook.</p>
      <label className="story-file-label">Load a text file (.txt or .md)<input type="file" accept="text/plain,.txt,.md,text/markdown" onChange={(event) => { void loadText(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} /></label>
      <textarea className="story-submit-text" aria-label="Story text" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Paste or write your story here…" />
      <label className="story-file-label">Optional cover image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setCover(event.currentTarget.files?.[0])} /></label>
      {cover && <small className="story-cover-name">{cover.name}</small>}
      {error && <p className="sketchbook-export-error" role="alert">{error}</p>}
      <div className="sketchbook-export-actions"><button className="button button--primary" type="button" disabled={busy || !content.trim()} onClick={() => { void upload(); }}>{busy ? 'Uploading…' : 'Upload story'}</button><button className="text-button" type="button" disabled={busy} onClick={onClose}>Cancel</button></div>
    </div>
  </dialog>;
}
