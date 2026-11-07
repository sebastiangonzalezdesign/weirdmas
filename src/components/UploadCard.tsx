import { Icon } from './Icon';

export function UploadCard({ onUpload, disabled, saving }: { onUpload: () => void; disabled?: boolean; saving?: boolean }) {
  return <section className="glass-panel upload-panel" aria-labelledby="upload-title">
    <div className="upload-icon-tile"><Icon name="upload"/></div>
    <div className="upload-copy"><span className="eyebrow">ADD TO THE BOOK</span><h2 id="upload-title">Upload your drawing</h2><p>Photos are private until both sketchbooks are complete.</p></div>
    <button className="button button--upload" onClick={onUpload} disabled={disabled}><Icon name={saving ? 'spark' : disabled ? 'lock' : 'upload'}/>{saving ? 'Saving drawing…' : disabled ? 'Available on your day' : 'Choose a drawing'}</button>
  </section>;
}
