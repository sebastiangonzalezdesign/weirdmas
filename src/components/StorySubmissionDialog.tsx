import { useEffect, useMemo, useRef, useState } from 'react';
import { submitStory } from '../lib/supabaseApi';
import { paginateStoryText, createStoryPdf } from '../lib/storyPdf';

interface Props { initialContent: string; initialCover?: File | null; onClose: () => void; onSubmitted: (content: string, cover: File | null) => void; }
type ViewMode = 'write' | 'preview';

function serializePages(pages: string[]): string {
  return pages.join('\f');
}

function downloadPdf(file: Blob): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'weirdmas-story.pdf';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function StorySubmissionDialog({ initialContent, initialCover = null, onClose, onSubmitted }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const initialContentRef = useRef(initialContent);
  const [pages, setPages] = useState<string[]>(['']);
  const [cover, setCover] = useState<File | null>(initialCover);
  const [mode, setMode] = useState<ViewMode>('write');
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [layoutBusy, setLayoutBusy] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const coverUrl = useMemo(() => cover ? URL.createObjectURL(cover) : '', [cover]);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    let active = true;
    void paginateStoryText(initialContentRef.current).then((nextPages) => {
      if (active) setPages(nextPages);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'The story pages could not be prepared.');
    }).finally(() => { if (active) setLayoutBusy(false); });
    return () => {
      active = false;
      if (dialog?.open) dialog.close();
    };
  }, []);

  useEffect(() => () => { if (coverUrl) URL.revokeObjectURL(coverUrl); }, [coverUrl]);

  const replacePage = (index: number, value: string) => {
    setPages((current) => current.map((page, pageIndex) => pageIndex === index ? value : page));
    setSaved(false);
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    setLayoutBusy(true);
    setError('');
    try {
      let text: string;
      if (/\.docx$/i.test(file.name) || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const { readStoryFile } = await import('../lib/storyImport');
        text = await readStoryFile(file);
      } else {
        if (!/\.(txt|md)$/i.test(file.name) || file.size > 2 * 1024 * 1024) throw new Error('Choose a .txt, .md, or .docx file. Text files must be 2 MB or smaller.');
        text = await file.text();
      }
      const nextPages = await paginateStoryText(text);
      setPages(nextPages);
      setMode('write');
      setSaved(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That story file could not be read.');
    } finally {
      setLayoutBusy(false);
    }
  };

  const reflowPage = async (index: number) => {
    setLayoutBusy(true);
    setError('');
    try {
      const replacement = await paginateStoryText(pages[index] ?? '');
      setPages((current) => [...current.slice(0, index), ...replacement, ...current.slice(index + 1)]);
      setSaved(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This page could not be laid out.');
    } finally { setLayoutBusy(false); }
  };

  const preparePreview = async () => {
    setLayoutBusy(true);
    setError('');
    try {
      setPages(await paginateStoryText(serializePages(pages)));
      setMode('preview');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The story preview could not be prepared.');
    } finally { setLayoutBusy(false); }
  };

  const saveDraft = async () => {
    const content = serializePages(pages).trim();
    if (!content) return;
    setBusy(true);
    setError('');
    try {
      await submitStory(content, cover ?? undefined);
      setSaved(true);
      onSubmitted(content, cover);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The story draft could not be saved.');
    } finally { setBusy(false); }
  };

  const createPdf = async () => {
    setPdfBusy(true);
    setError('');
    try {
      const laidOutPages = await paginateStoryText(serializePages(pages));
      setPages(laidOutPages);
      downloadPdf(await createStoryPdf(laidOutPages, cover));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The story PDF could not be created.');
    } finally { setPdfBusy(false); }
  };

  const movePage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= pages.length) return;
    setPages((current) => {
      const result = [...current];
      [result[index], result[target]] = [result[target], result[index]];
      return result;
    });
    setSaved(false);
  };

  const deletePage = (index: number) => {
    setPages((current) => current.length === 1 ? [''] : current.filter((_, pageIndex) => pageIndex !== index));
    setSaved(false);
  };

  const addPage = () => {
    setPages((current) => [...current, '']);
    setMode('write');
    setSaved(false);
  };

  const pageCount = pages.length + (cover ? 1 : 0);
  let printedPage = cover ? 1 : 0;

  return <dialog ref={ref} className="sketchbook-export-dialog story-dialog" aria-labelledby="story-submit-title" onCancel={(event) => { event.preventDefault(); if (!busy && !pdfBusy && !layoutBusy) onClose(); }} onClick={(event) => { if (event.target === event.currentTarget && !busy && !pdfBusy && !layoutBusy) onClose(); }}>
    <div className="sketchbook-export-dialog__inner">
      <div className="sketchbook-export-dialog__header"><div><span className="eyebrow">YOUR STORY DRAFT</span><h2 id="story-submit-title">Edit pages and make a PDF</h2></div><button className="sketchbook-export-dialog__close" type="button" onClick={onClose} disabled={busy || pdfBusy || layoutBusy} aria-label="Close">×</button></div>
      <p className="sketchbook-export-dialog__description">Import a text or Word file, edit and reorder pages, then preview the PDF. Word and Google Docs explicit page breaks are kept when available; automatic page flow is rebuilt to fit this PDF. Export Google Docs as .docx first.</p>

      <div className="story-editor-toolbar">
        <label className="story-file-label">Import .txt, .md, or .docx<input type="file" accept=".txt,.md,text/plain,text/markdown,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { void importFile(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} /></label>
        <label className="story-file-label">Optional cover image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { setCover(event.currentTarget.files?.[0] ?? null); setSaved(false); }} /></label>
        {cover && <div className="story-cover-selection"><small className="story-cover-name">{cover.name}</small><button className="text-button" type="button" onClick={() => { setCover(null); setSaved(false); }}>Remove cover</button></div>}
      </div>

      <div className="story-view-tabs" role="tablist" aria-label="Story view">
        <button type="button" role="tab" aria-selected={mode === 'write'} onClick={() => setMode('write')}>Edit pages</button>
        <button type="button" role="tab" aria-selected={mode === 'preview'} disabled={layoutBusy} onClick={() => { void preparePreview(); }}>Preview PDF</button>
        <span>{pageCount} {pageCount === 1 ? 'page' : 'pages'}</span>
      </div>

      {layoutBusy && <p className="sketchbook-export-status" role="status">Preparing pages…</p>}
      {!layoutBusy && mode === 'write' && <div className="story-page-list">
        {pages.map((page, index) => <section className="story-page-edit" key={index}>
          <div className="story-page-edit__header"><strong>Page {index + 1}</strong><div className="story-page-controls">
            <button type="button" onClick={() => movePage(index, -1)} disabled={index === 0} aria-label={`Move page ${index + 1} up`}>↑</button>
            <button type="button" onClick={() => movePage(index, 1)} disabled={index === pages.length - 1} aria-label={`Move page ${index + 1} down`}>↓</button>
            <button type="button" onClick={() => { void reflowPage(index); }} disabled={layoutBusy}>Split to fit</button>
            <button type="button" onClick={() => deletePage(index)} aria-label={`Delete page ${index + 1}`}>Delete</button>
          </div></div>
          <textarea className="story-submit-text" aria-label={`Edit story page ${index + 1}`} value={page} onChange={(event) => replacePage(index, event.target.value)} placeholder="Write this page…" maxLength={100000} />
        </section>)}
        <button className="button button--secondary story-add-page" type="button" onClick={addPage}>Add page</button>
      </div>}

      {!layoutBusy && mode === 'preview' && <div className="story-preview-list">
        {coverUrl && <article className="story-paper story-paper--cover"><strong>WEIRDMAS</strong><img src={coverUrl} alt="Story cover preview" /><span>COVER · 01 / {String(pageCount).padStart(2, '0')}</span></article>}
        {pages.map((page, index) => {
          printedPage += 1;
          return <article className="story-paper" key={index}>
            <header><strong>WEIRDMAS</strong><span>{index === 0 ? 'THE STORY' : 'THE STORY · CONTINUED'}</span></header>
            <div className="story-paper__body">{page.split('\n').map((line, lineIndex) => <div key={lineIndex}>{line || <br />}</div>)}</div>
            <footer>PAGE {String(printedPage).padStart(2, '0')} / {String(pageCount).padStart(2, '0')}</footer>
            <div className="story-paper__controls"><button type="button" onClick={() => movePage(index, -1)} disabled={index === 0} aria-label={`Move page ${index + 1} up`}>Move up</button><button type="button" onClick={() => movePage(index, 1)} disabled={index === pages.length - 1} aria-label={`Move page ${index + 1} down`}>Move down</button><button type="button" onClick={() => { setMode('write'); }}>Edit page</button></div>
          </article>;
        })}
        <button className="button button--secondary story-add-page" type="button" onClick={addPage}>Add page</button>
      </div>}

      {saved && <p className="sketchbook-export-status" role="status">Story draft saved. You can replace it any time.</p>}
      {error && <p className="sketchbook-export-error" role="alert">{error}</p>}
      <div className="sketchbook-export-actions"><button className="button button--primary" type="button" disabled={busy || layoutBusy || !pages.some((page) => page.trim())} onClick={() => { void saveDraft(); }}>{busy ? 'Saving…' : 'Save story draft'}</button><button className="button button--secondary" type="button" disabled={pdfBusy || layoutBusy || !pages.some((page) => page.trim())} onClick={() => { void createPdf(); }}>{pdfBusy ? 'Creating PDF…' : 'Download story PDF'}</button><button className="text-button" type="button" disabled={busy || pdfBusy || layoutBusy} onClick={onClose}>Close</button></div>
    </div>
  </dialog>;
}
