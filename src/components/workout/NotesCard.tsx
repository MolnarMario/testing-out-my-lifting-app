import { SwitchRow } from "../SwitchRow";

interface Props {
  on: boolean;
  notes: string;
  onToggle: (next: boolean) => void;
  onChange: (next: string) => void;
}

export function NotesCard({ on, notes, onToggle, onChange }: Props) {
  return (
    <div className="card">
      <SwitchRow
        title="Notes"
        description="Cues, aches, anything worth remembering"
        checked={on}
        onChange={onToggle}
      />

      {on && (
        <textarea
          value={notes}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Bar felt heavy off the chest. Keep elbows tucked."
          aria-label="Session notes"
        />
      )}
    </div>
  );
}
