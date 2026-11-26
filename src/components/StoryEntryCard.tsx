import { useEffect, useState } from 'react';

interface Props {
  day: number;
  initialValue: string;
  disabled: boolean;
  saving: boolean;
  onSave: (content: string) => void;
}

export function StoryEntryCard({ day, initialValue, disabled, saving, onSave }: Props) {
  const [content, setContent] = useState(initialValue);
  useEffect(() => setContent(initialValue), [initialValue, day]);
  return <section className="glass-panel story-entry-panel" aria-labelledby="story-entry-title">
    <span className="eyebrow">A PAGE A DAY</span>
    <h2 id="story-entry-title">Add to your story</h2>
    <p>Write a little each day. Your entries will be ready to bring together at the end.</p>
    <textarea aria-label={`Story entry for day ${day}`} value={content} onChange={(event) => setContent(event.target.value)} disabled={disabled || saving} placeholder="What happens today?" maxLength={20000} />
    <button className="button button--primary" type="button" disabled={disabled || saving || !content.trim()} onClick={() => onSave(content)}>{saving ? 'Saving…' : 'Save today’s page'}</button>
  </section>;
}
