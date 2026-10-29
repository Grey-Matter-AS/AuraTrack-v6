import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarIcon, ClockIcon } from '../AppIcons';

// ─── Field wrapper: the one label / help / error style ────────
export function Field({ label, help, error, htmlFor, className = '', children }) {
  return (
    <div className={`ui-field-wrap${className ? ` ${className}` : ''}`}>
      {label && <label className="ui-label" htmlFor={htmlFor}>{label}</label>}
      {children}
      {help && <p className="ui-help">{help}</p>}
      {error && <p className="ui-error">{error}</p>}
    </div>
  );
}

const cx = (...parts) => parts.filter(Boolean).join(' ');

// Labelled control helper: generates an id so the label is linked to the input
function useFieldId(id) {
  const generated = useId();
  return id ?? generated;
}

// Fields are never blank when empty: without a placeholder, the label is shown as the hint
export function TextInput({ label, help, error, id, className = '', onChange, placeholder, ...rest }) {
  const fieldId = useFieldId(id);
  const input = <input id={fieldId} type="text" placeholder={placeholder ?? label} className={cx('ui-field', className)} onChange={e => onChange?.(e.target.value, e)} {...rest} />;
  return label || help || error ? <Field label={label} help={help} error={error} htmlFor={fieldId}>{input}</Field> : input;
}

export function TextArea({ label, help, error, id, rows = 3, className = '', onChange, placeholder, ...rest }) {
  const fieldId = useFieldId(id);
  const area = <textarea id={fieldId} rows={rows} placeholder={placeholder ?? label} className={cx('ui-field', className)} onChange={e => onChange?.(e.target.value, e)} {...rest} />;
  return label || help || error ? <Field label={label} help={help} error={error} htmlFor={fieldId}>{area}</Field> : area;
}

const DATE_HINTS = {
  date: ['ui.select_date', 'Select date'],
  time: ['ui.select_time', 'Select time'],
  'datetime-local': ['ui.select_datetime', 'Select date & time'],
  month: ['ui.select_month', 'Select month'],
};

// type: date | time | datetime-local | month.
// iOS Safari shows an empty date/time field as a blank box (no hint, no icon, placeholder
// ignored), so the kit draws its own hint and icon — identical on every platform. The hint shows
// only while the field is empty and not focused; taps go straight through to the native picker.
export function DateInput({ type = 'date', label, help, error, id, className = '', onChange, placeholder, value, onFocus, onBlur, ...rest }) {
  const { t } = useTranslation();
  const fieldId = useFieldId(id);
  const [focused, setFocused] = useState(false);
  const empty = value == null || value === '';
  const hint = placeholder || t(...DATE_HINTS[type]);
  const Icon = type === 'time' ? ClockIcon : CalendarIcon;
  const control = (
    <div className={cx('ui-date', empty && !focused && 'ui-date--empty')}>
      <input
        id={fieldId}
        type={type}
        value={value ?? ''}
        className={cx('ui-field', className)}
        onChange={e => onChange?.(e.target.value, e)}
        onFocus={e => { setFocused(true); onFocus?.(e); }}
        onBlur={e => { setFocused(false); onBlur?.(e); }}
        {...rest}
        aria-label={rest['aria-label'] ?? (label ? undefined : hint)}
      />
      {empty && !focused && <span className="ui-date__hint" aria-hidden="true">{hint}</span>}
      <span className="ui-date__icon" aria-hidden="true"><Icon className="w-[1.125rem] h-[1.125rem]" /></span>
    </div>
  );
  return label || help || error ? <Field label={label} help={help} error={error} htmlFor={fieldId}>{control}</Field> : control;
}

// Whole numbers typed on the phone's number pad. Focusing starts a fresh entry (old value shown as
// placeholder) so the first digit typed always lands in the ones place; leaving without typing
// keeps the old value. compact: small centred box (timers).
export function NumberInput({ value, onChange, max = Infinity, maxLength = 4, compact = false, label, help, error, id, className = '', readOnly, ...rest }) {
  const fieldId = useFieldId(id);
  const [draft, setDraft] = useState(null);
  const handleChange = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, maxLength);
    const n = digits === '' ? 0 : Math.min(max, parseInt(digits, 10));
    setDraft(digits === '' ? '' : String(n));
    onChange(n);
  };
  const shown = value ? String(value) : '';
  const input = (
    <input
      id={fieldId}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={maxLength}
      readOnly={readOnly}
      placeholder={shown || '0'}
      value={draft ?? shown}
      onFocus={() => { if (!readOnly) setDraft(''); }}
      onBlur={() => setDraft(null)}
      onChange={e => handleChange(e.target.value)}
      className={cx('ui-field', compact && 'ui-field--compact', className)}
      {...rest}
    />
  );
  return label || help || error ? <Field label={label} help={help} error={error} htmlFor={fieldId}>{input}</Field> : input;
}

// Free decimal number (doses). Keeps the typed text so "0.5" can be entered.
export function DecimalInput({ value, onChange, label, help, error, id, className = '', placeholder, ...rest }) {
  const fieldId = useFieldId(id);
  const input = (
    <input
      id={fieldId}
      type="text"
      inputMode="decimal"
      placeholder={placeholder ?? label}
      value={value ?? ''}
      onChange={e => onChange(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))}
      className={cx('ui-field', className)}
      {...rest}
    />
  );
  return label || help || error ? <Field label={label} help={help} error={error} htmlFor={fieldId}>{input}</Field> : input;
}

// options: [{ value, label }]. placeholder: an empty first option.
// allowCustom: adds "Add new…" which reveals a text box; customValues not in options are shown too.
export function Select({ options, value, onChange, placeholder, allowCustom = false, customLabel, customPlaceholder, label, help, error, id, className = '', ...rest }) {
  const { t } = useTranslation();
  const fieldId = useFieldId(id);
  // Never blank: with no value and no placeholder given, show "Choose…"
  if (placeholder === undefined && (value == null || value === '') && !options.some(o => o.value === '')) {
    placeholder = label || t('ui.choose', 'Choose…');
  }
  const known = options.some(o => o.value === value);
  const [custom, setCustom] = useState(false);
  const selectValue = custom ? '__custom' : (value ?? '');
  const select = (
    <select
      id={fieldId}
      value={selectValue}
      onChange={e => {
        const next = e.target.value;
        setCustom(next === '__custom');
        onChange(next === '__custom' ? '' : next);
      }}
      className={cx('ui-field', className)}
      {...rest}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {!known && value && !custom && <option value={value}>{value}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      {allowCustom && <option value="__custom">{customLabel}</option>}
    </select>
  );
  const body = (
    <div className="flex flex-col gap-2 min-w-0">
      {select}
      {custom && (
        <input
          type="text"
          autoFocus
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={customPlaceholder}
          className="ui-field"
        />
      )}
    </div>
  );
  return label || help || error ? <Field label={label} help={help} error={error} htmlFor={fieldId}>{body}</Field> : body;
}

// Checkbox row: the whole row is the tap target (≥44px), box drawn in the accent colour
export function Checkbox({ checked, onChange, label, help, title, className = '' }) {
  return (
    <label className={cx('ui-inset flex items-start gap-3 cursor-pointer min-h-[2.75rem]', className)} title={title}>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 w-5 h-5 shrink-0"
        style={{ accentColor: 'var(--accent)' }}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {help && <span className="block text-[11px] leading-snug mt-0.5" style={{ color: 'var(--text-dim)' }}>{help}</span>}
      </span>
    </label>
  );
}

// Fields side by side when they fit (min width per field), stacked otherwise.
// split: one main field plus a short companion (dose + unit).
export function FieldRow({ split = false, min, className = '', children }) {
  return (
    <div className={cx('ui-row', split && 'ui-row--split', className)} style={min ? { '--ui-row-min': min } : undefined}>
      {children}
    </div>
  );
}
