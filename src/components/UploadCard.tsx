import { Icon } from './Icon';

export interface UploadFeedback {
  kind: 'success' | 'error';
  message: string;
}

interface Props {
  onUpload: () => void;
  prelaunch?: boolean;
  disabled?: boolean;
  saving?: boolean;
  feedback?: UploadFeedback | null;
}

export function UploadCard({ onUpload, prelaunch = false, disabled, saving, feedback }: Props) {
  return <section className="glass-panel upload-panel" aria-labelledby="upload-title">
    <div className="upload-icon-tile"><Icon name="upload"/></div>
    <div className="upload-copy"><span className="eyebrow">{prelaunch ? 'PRELAUNCH IMAGE TEST' : 'ONE IMAGE UNLOCKS THE NEXT DAY'}</span><h2 id="upload-title">{prelaunch ? 'Test image uploads' : 'Add today’s image'}</h2><p>{prelaunch ? 'Try image uploads now. Calendar access opens on December 1, and these test images will be cleared at launch.' : 'Upload at least one image to complete this day and unlock the next available day.'}</p></div>
    <button className="button button--upload" onClick={onUpload} disabled={disabled}><Icon name={saving ? 'spark' : disabled ? 'lock' : 'upload'}/>{saving ? 'Saving…' : disabled ? 'Available on your day' : 'Choose drawings'}</button>
    {feedback && <p className={`upload-feedback upload-feedback--${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.message}</p>}
  </section>;
}
