import { Icon } from './Icon';

export interface UploadFeedback {
  kind: 'success' | 'error';
  message: string;
}

interface Props {
  onUpload: () => void;
  disabled?: boolean;
  saving?: boolean;
  feedback?: UploadFeedback | null;
}

export function UploadCard({ onUpload, disabled, saving, feedback }: Props) {
  return <section className="glass-panel upload-panel" aria-labelledby="upload-title">
    <div className="upload-icon-tile"><Icon name="upload"/></div>
    <div className="upload-copy"><span className="eyebrow">ADD TO THE BOOK</span><h2 id="upload-title">Upload your drawing</h2><p>Select one or more images. You can add more to an available day later.</p></div>
    <button className="button button--upload" onClick={onUpload} disabled={disabled}><Icon name={saving ? 'spark' : disabled ? 'lock' : 'upload'}/>{saving ? 'Saving…' : disabled ? 'Available on your day' : 'Choose drawings'}</button>
    {feedback && <p className={`upload-feedback upload-feedback--${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.message}</p>}
  </section>;
}
