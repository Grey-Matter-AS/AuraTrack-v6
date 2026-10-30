import { ChipGroup, DateInput, Section as KitSection, TextInput } from '../ui';

// ─── Atom components ─────────────────────────────────────────

// Settings atoms are thin wrappers over the shared UI kit, so every settings screen uses the
// same fields, chips, switches and containers as the rest of the app.
export const Section = KitSection;

export function Row({ label, help, children }) {
  return (
    <div className="flex flex-wrap justify-between items-center gap-x-4 gap-y-2">
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-sm font-bold text-[var(--text-primary)]">{label}</p>
        {typeof help === 'string' && help && <p className="text-[11px] text-[var(--text-dim)] mt-0.5">{help}</p>}
        {help && typeof help !== 'string' && <div className="text-[11px] text-[var(--text-dim)] mt-0.5">{help}</div>}
      </div>
      <div className="shrink-0 max-w-full">{children}</div>
    </div>
  );
}

export function FieldLabel({ children }) {
  return <p className="ui-label">{children}</p>;
}

export function TextField({ label, value, onChange, type = 'text', placeholder }) {
  if (type === 'date' || type === 'time') {
    return <DateInput type={type} label={label} value={value || ''} onChange={onChange} placeholder={placeholder} />;
  }
  return <TextInput type={type} label={label} value={value || ''} onChange={onChange} placeholder={placeholder} />;
}

export function Segments({ options, value, onChange }) {
  return (
    <ChipGroup
      fill
      value={value}
      onChange={onChange}
      options={options.map(opt => (typeof opt === 'object' ? opt : { value: opt, label: String(opt) }))}
    />
  );
}

export function ActionBtn({ label, sub, onClick, icon, variant = 'default' }) {
  const isDanger = variant === 'danger';
  const bg = isDanger ? 'var(--danger)' : 'var(--bg-raised)';
  const color = isDanger ? 'var(--on-action)' : 'var(--text-on-raised)';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full min-w-0 flex flex-col items-center justify-center rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 ${isDanger ? 'gap-2 px-4 py-6 min-h-[9rem] text-[11px]' : 'gap-1 px-3 py-5 text-[10px]'}`}
      style={{ backgroundColor: bg, color, border: isDanger ? '1px solid var(--danger-border)' : '1px solid var(--border)', overflowWrap: 'anywhere' }}
    >
      {icon && (
        <span
          className={`rounded-2xl flex items-center justify-center ${isDanger ? 'w-14 h-14' : 'w-10 h-10'}`}
          style={{ backgroundColor: isDanger ? 'rgba(255,255,255,0.14)' : 'var(--bg-card)' }}
        >
          {icon}
        </span>
      )}
      <span className={`text-center whitespace-normal ${isDanger ? 'leading-tight max-w-[18ch]' : 'leading-snug'}`}>{label}</span>
      {sub && <span className={`font-medium normal-case tracking-normal ${isDanger ? 'text-[10px] opacity-90' : 'text-[9px] opacity-60'}`}>{sub}</span>}
    </button>
  );
}

