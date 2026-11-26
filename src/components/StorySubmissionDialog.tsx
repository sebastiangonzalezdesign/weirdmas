import { useEffect, useRef, useState } from 'react';
import { submitStory } from '../lib/supabaseApi';
import { createStoryPdf } from '../lib/storyPdf';

interface Props { initialContent: string; initialCover?: File | null; onClose: () => void; onSubmitted: (content: string, cover: File | null) => void; }

export function StorySubmissionDialog({ initialContent, initialCover = null, onClose, onSubmitted }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [content, setContent] = useState(initialContent);
  const [cover, setCover] = useState<File | null>(initialCover);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const dialog = ref.current; if (dialog && !dialog.open) dialog.showModal(); return () => { if (dialog?.open) dialog.close(); }; }, []);
  const loadText = async (file?: File) => { if (!file) return; if (file.size > 2 * 1024 * 1024) { setError('Text files must be 2 MB or smaller.'); return; } setContent(await file.text()); setSaved(false); setError(''); };
  const upload = async () => {
    setBusy(true); setError('');
    try { await submitStory(content.trim(), cover ?? undefined); setSaved(true); onSubmitted(content.trim(), cover); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The story could not be uploaded.'); }
    finally { setBusy(false); }
  };
  const downloadPdf = async () => {
    setPdfBusy(true); setError('');
    try {
      const blob = await createStoryPdf(content, cover);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'weirdmas-story.pdf';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The story PDF could not be created.');
    } finally { setPdfBusy(false); }
  };
  return <dialog ref={ref} className="sketchbook-export-dialog" aria-labelledby="story-submit-title" onCancel={(event) => { event.preventDefault(); if (!busy && !pdfBusy) onClose(); }} onClick={(event) => { if (event.target === event.currentTarget && !busy && !pdfBusy) onClose(); }}>
    <div className="sketchbook-export-dialog__inner">
      <div className="sketchbook-export-dialog__header"><div><span className="eyebrow">YOUR STORY DRAFT</span><h2 id="story-submit-title">Save your story and PDF</h2></div><button className="sketchbook-export-dialog__close" type="button" onClick={onClose} disabled={busy || pdfBusy} aria-label="Close">×</button></div>
      <p className="sketchbook-export-dialog__description">Save one complete story draft and replace it whenever you like. Add an optional cover, then download the story as a PDF.</p>
      <label className="story-file-label">Load a text file (.txt or .md)<input type="file" accept="text/plain,.txt,.md,text/markdown" onChange={(event) => { void loadText(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} /></label>
      <textarea className="story-submit-text" aria-label="Story text" value={content} onChange={(event) => { setContent(event.target.value); setSaved(false); }} placeholder="Paste or write your story here…" />
      <label className="story-file-label">Optional cover image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { setCover(event.currentTarget.files?.[0] ?? null); setSaved(false); }} /></label>
      {cover && <div className="story-cover-selection"><small className="story-cover-name">{cover.name}</small><button className="text-button" type="button" onClick={() => { setCover(null); setSaved(false); }}>Remove cover</button></div>}
      {saved && <p className="sketchbook-export-status" role="status">Story draft saved. You can replace it any time.</p>}
      {error && <p className="sketchbook-export-error" role="alert">{error}</p>}
      <div className="sketchbook-export-actions"><button className="button button--primary" type="button" disabled={busy || !content.trim()} onClick={() => { void upload(); }}>{busy ? 'Saving…' : 'Save story draft'}</button><button className="button button--secondary" type="button" disabled={pdfBusy || !content.trim()} onClick={() => { void downloadPdf(); }}>{pdfBusy ? 'Creating PDF…' : 'Download story PDF'}</button><button className="text-button" type="button" disabled={busy || pdfBusy} onClick={onClose}>Close</button></div>
    </div>
  </dialog>;
}
