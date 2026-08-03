interface Props {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

export function SwitchRow({ title, description, checked, onChange }: Props) {
  return (
    <div className="switch-row">
      <div className="lbl">
        <span className="t">{title}</span>
        {description && <span className="d">{description}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        className={checked ? "switch on" : "switch"}
        onClick={() => onChange(!checked)}
      >
        <span className="knob" />
      </button>
    </div>
  );
}
