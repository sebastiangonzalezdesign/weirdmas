import { useEffect, useMemo, useRef, useState } from 'react';
import type { Drawing } from './Gallery';
import type { Participant } from '../data/participants';
import { createSketchbookPdf } from '../lib/sketchbookPdf';
import type { PromptAssignment } from '../lib/supabaseApi';

type ExportScope = 'all' | 'current-day' | 'selected-days';

interface Props {
  drawings: Drawing[];
  participant: Participant;
  prompts: PromptAssignment[];
  currentDay: number;
  onClose: () => void;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'The PDF could not be created.';
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function supportsFileSharing(file: File): boolean {
  return typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [file] });
}

export function SketchbookExportDialog({ drawings, participant, prompts, currentDay, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const drawingsByDay = useMemo(() => {
    const result = new Map<number, Drawing[]>();
    for (const drawing of drawings) {
      const current = result.get(drawing.day) ?? [];
      current.push(drawing);
      result.set(drawing.day, current);
    }
    return result;
  }, [drawings]);
  const days = useMemo(() => [...drawingsByDay.keys()].sort((first, second) => first - second), [drawingsByDay]);
  const [scope, setScope] = useState<ExportScope>('all');
  const [selectedDays, setSelectedDays] = useState<number[]>(() => days.includes(currentDay) ? [currentDay] : days.slice(0, 1));
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const selectedDrawings = useMemo(() => {
    const selected = drawings.filter((drawing) => {
      if (scope === 'current-day') return drawing.day === currentDay;
      if (scope === 'selected-days') return selectedDays.includes(drawing.day);
      return true;
    });
    return selected.sort((first, second) => first.day - second.day);
  }, [currentDay, drawings, scope, selectedDays]);

  const updateScope = (nextScope: ExportScope) => {
    setScope(nextScope);
    setPdfFile(null);
    setErrorMessage('');
    setStatusMessage('');
  };

  const toggleDay = (day: number) => {
    setSelectedDays((current) => current.includes(day)
      ? current.filter((value) => value !== day)
      : [...current, day].sort((first, second) => first - second));
    setPdfFile(null);
    setErrorMessage('');
    setStatusMessage('');
  };

  const createPdf = async () => {
    if (selectedDrawings.length === 0) return;
    setIsCreating(true);
    setErrorMessage('');
    setStatusMessage('');
    setProgress('Preparing your pages…');
    try {
      const blob = await createSketchbookPdf(selectedDrawings, participant, prompts, (current, total) => {
        setProgress(`Preparing image ${current} of ${total}…`);
      });
      const participantSlug = participant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'artist';
      const file = new File([blob], `weirdmas-${participantSlug}-sketchbook.pdf`, { type: 'application/pdf' });
      setPdfFile(file);
      setStatusMessage(`PDF ready with ${selectedDrawings.length} ${selectedDrawings.length === 1 ? 'image' : 'images'}.`);
      setProgress('');
    } catch (error: unknown) {
      setErrorMessage(errorText(error));
      setProgress('');
    } finally {
      setIsCreating(false);
    }
  };

  const sharePdf = async () => {
    if (!pdfFile || !supportsFileSharing(pdfFile)) return;
    setErrorMessage('');
    try {
      await navigator.share({ files: [pdfFile], title: `${participant.name}'s Weirdmas Sketchbook` });
      setStatusMessage('PDF shared.');
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErrorMessage(errorText(error));
    }
  };

  return <dialog
    ref={dialogRef}
    className="sketchbook-export-dialog"
    aria-labelledby="sketchbook-export-title"
    onCancel={(event) => { event.preventDefault(); if (!isCreating) onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget && !isCreating) onClose(); }}
  >
    <div className="sketchbook-export-dialog__inner">
      <div className="sketchbook-export-dialog__header">
        <div>
          <span className="eyebrow">TAKE YOUR ART WITH YOU</span>
          <h2 id="sketchbook-export-title">Share your sketchbook</h2>
        </div>
        <button className="sketchbook-export-dialog__close" type="button" onClick={onClose} disabled={isCreating} aria-label="Close PDF export">×</button>
      </div>
      <p className="sketchbook-export-dialog__description">Create a private PDF of your own drawings. Images are arranged by day and include the prompt.</p>

      <fieldset className="sketchbook-export-options">
        <legend className="eyebrow">CHOOSE PAGES</legend>
        <label className="sketchbook-export-option">
          <input type="radio" name="sketchbook-export-scope" checked={scope === 'all'} onChange={() => updateScope('all')} />
          <span><strong>All pages so far</strong><small>{drawings.length} {drawings.length === 1 ? 'image' : 'images'} across {days.length} {days.length === 1 ? 'day' : 'days'}</small></span>
        </label>
        <label className={`sketchbook-export-option ${!drawingsByDay.has(currentDay) ? 'is-disabled' : ''}`}>
          <input type="radio" name="sketchbook-export-scope" checked={scope === 'current-day'} onChange={() => updateScope('current-day')} disabled={!drawingsByDay.has(currentDay)} />
          <span><strong>This day (Day {currentDay})</strong><small>{drawingsByDay.get(currentDay)?.length ?? 0} images</small></span>
        </label>
        <label className="sketchbook-export-option">
          <input type="radio" name="sketchbook-export-scope" checked={scope === 'selected-days'} onChange={() => updateScope('selected-days')} />
          <span><strong>Choose days</strong><small>Select the days to include</small></span>
        </label>
      </fieldset>

      {scope === 'selected-days' && <fieldset className="sketchbook-export-days">
        <legend className="visually-hidden">Days to include in the PDF</legend>
        {days.map((day) => {
          const count = drawingsByDay.get(day)?.length ?? 0;
          return <label className="sketchbook-export-day" key={day}>
            <input type="checkbox" checked={selectedDays.includes(day)} onChange={() => toggleDay(day)} />
            <span>Day {day}</span>
            <small>{count} {count === 1 ? 'image' : 'images'}</small>
          </label>;
        })}
      </fieldset>}

      <p className="sketchbook-export-summary">{selectedDrawings.length} {selectedDrawings.length === 1 ? 'image' : 'images'} selected</p>
      <p className="sketchbook-export-note">PDF images are optimized for sharing. Animated GIFs appear as a still image.</p>
      {progress && <p className="sketchbook-export-status" role="status">{progress}</p>}
      {statusMessage && <p className="sketchbook-export-status" role="status">{statusMessage}</p>}
      {errorMessage && <p className="sketchbook-export-error" role="alert">{errorMessage}</p>}

      <div className="sketchbook-export-actions">
        {!pdfFile
          ? <button className="button button--primary" type="button" onClick={() => { void createPdf(); }} disabled={isCreating || selectedDrawings.length === 0}>{isCreating ? 'Creating PDF…' : 'Create PDF'}</button>
          : <>
            {supportsFileSharing(pdfFile) && <button className="button button--primary" type="button" onClick={() => { void sharePdf(); }}>Share PDF</button>}
            <button className="button button--secondary" type="button" onClick={() => downloadFile(pdfFile)}>Download PDF</button>
          </>}
        <button className="text-button sketchbook-export-cancel" type="button" onClick={onClose} disabled={isCreating}>Close</button>
      </div>
    </div>
  </dialog>;
}
