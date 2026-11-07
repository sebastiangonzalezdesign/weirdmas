import { Icon } from './Icon';

export function UploadCard({ onUpload, disabled }: { onUpload: () => void; disabled?: boolean }) {
  return <section className="glass-panel upload-panel" aria-labelledby="upload-title">
    <div className="upload-icon-tile"><Icon name="upload"/></div>
    <div className="upload-copy"><span className="eyebrow">ADD TO THE BOOK</span><h2 id="upload-title">Upload your drawing</h2><p>Share a photo or scan from today’s prompt.</p></div>
    <button className="button button--upload" onClick={onUpload} disabled={disabled}><Icon name={disabled ? 'lock' : 'upload'}/>{disabled ? 'Available after unlock' : 'Choose a drawing'}</button>
  </section>;
}
