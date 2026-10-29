import { CloseIcon } from '../AppIcons';

// ─── Buttons ──────────────────────────────────────────────────
// variant: primary | secondary | success | danger | warning | ghost
// size:    sm (44px) | md (48px) | lg (56px call-to-action)
export function Button({ variant = 'secondary', size = 'md', fullWidth = false, icon = null, className = '', type = 'button', children, ...rest }) {
  return (
    <button
      type={type}
      className={`ui-btn ui-btn--${variant} ui-btn--${size}${fullWidth ? ' ui-btn--full' : ''}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

// Square 44px icon button. `label` is required — it is the accessible name.
// tone: neutral | accent | success | danger
export function IconButton({ label, tone = 'neutral', className = '', type = 'button', children, ...rest }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`ui-icon-btn${tone !== 'neutral' ? ` ui-icon-btn--${tone}` : ''}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function CloseButton({ label, ...rest }) {
  return (
    <IconButton label={label} {...rest}>
      <CloseIcon className="w-4 h-4" />
    </IconButton>
  );
}

// A row of buttons that wraps (and stacks on small phones) instead of squeezing
export function ButtonRow({ stack = false, className = '', children }) {
  return <div className={`ui-button-row${stack ? ' ui-button-row--stack' : ''}${className ? ` ${className}` : ''}`}>{children}</div>;
}

// ─── Chips ────────────────────────────────────────────────────
// Single select (value) or multi select (multiple + value array). Selected uses the accent colour.
// options: [{ value, label, icon? }]. fill: chips share the row width. scroll: one scrolling line (tabs).
export function ChipGroup({ options, value, onChange, multiple = false, fill = false, scroll = false, label, className = '' }) {
  const isSelected = (v) => (multiple ? (value || []).includes(v) : value === v);
  const choose = (v) => {
    if (!multiple) { onChange(v); return; }
    const current = value || [];
    onChange(current.includes(v) ? current.filter(x => x !== v) : [...current, v]);
  };
  return (
    <div
      role="group"
      aria-label={label}
      className={`ui-chip-group${fill ? ' ui-chip-group--fill' : ''}${scroll ? ' ui-chip-group--scroll' : ''}${className ? ` ${className}` : ''}`}
    >
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={isSelected(option.value)}
          onClick={() => choose(option.value)}
          className="ui-chip"
          style={option.style}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

// Full-width radio-like rows. options: [{ value, label, detail? }]
export function ChoiceList({ options, value, onChange, className = '' }) {
  return (
    <div className={`ui-choice-list${className ? ` ${className}` : ''}`}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className="ui-choice"
        >
          {option.label}
          {option.detail && <span className="ui-choice__detail">{option.detail}</span>}
        </button>
      ))}
    </div>
  );
}

// ─── Switch ───────────────────────────────────────────────────
export function Toggle({ value, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      className="ui-toggle relative inline-flex items-center justify-center w-14 shrink-0"
      style={{ minHeight: 'var(--touch-target-compact)' }}
    >
      <span
        className="relative block w-14 h-8 rounded-full transition-all"
        style={{
          backgroundColor: value ? 'var(--accent)' : 'var(--bg-input)',
          border: value ? '1px solid transparent' : '1px solid var(--border)',
        }}
      >
        <span
          className="absolute top-1 w-6 h-6 rounded-full shadow transition-all"
          style={{ left: value ? '1.6rem' : '0.2rem', backgroundColor: value ? '#fff' : 'var(--text-dim)' }}
        />
      </span>
    </button>
  );
}
