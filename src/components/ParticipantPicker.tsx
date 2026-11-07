import type { Participant } from '../data/participants';

interface Props { participants: Participant[]; selectedId: string; onSelect: (id: string) => void; compact?: boolean }

export function ParticipantPicker({ participants, selectedId, onSelect, compact = false }: Props) {
  return <div className={`participant-list ${compact ? 'participant-list--compact' : ''}`} role="group" aria-label="Choose your profile">
    {participants.map((participant) => {
      const selected = participant.id === selectedId;
      return <button className={`participant ${selected ? 'is-selected' : ''}`} key={participant.id} onClick={() => onSelect(participant.id)} aria-pressed={selected}>
        <span className="avatar-tile" aria-hidden="true">
          <span className="avatar-fallback">{participant.name.slice(0, 1).toUpperCase()}</span>
          <img src={participant.avatarPath} alt="" onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.parentElement?.classList.add('has-avatar-fallback'); }} />
        </span>
        <span className="participant-name">{participant.name}</span>
        {!compact && <span className="participant-role">{participant.role}</span>}
      </button>;
    })}
  </div>;
}
