import { useId, useState } from 'react';

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

export function TextInput({ label, help, error, id, className = '', onChange, ...rest }) {
  const fieldId = useFieldId(id);
  const input = <input id={fieldId} type="text" className={cx('ui-field', className)} onChange={e => onChange?.(e.target.value, e)} {...rest} />;
  return label || help || error ? <Field label={label} help={help} error={error} htmlFor={fieldId}>{input}</Field> : input;
}

export function TextArea({ label, help, error, id, rows = 3, className = '', onChange, ...rest }) {
  const fieldId = useFieldId(id);
  const area = <textarea id={fieldId} rows={rows} className={cx('ui-field', className)} onChange={e => onChange?.(e.target.value, e)} {...rest} />;
  return label || help || error ? <Field label={label} help={help} error={error} htmlFor={fieldId}>{area}</Field> : area;
}

// type: date | time | datetime-local | month
export function DateInput({ type = 'date', label, help, error, id, className = '', onChange, ...rest }) {
  const fieldId = useFieldId(id);
  const input = <input id={fieldId} type={type} className={cx('ui-field', className)} onChange={e => onChange?.(e.target.value, e)} {...rest} />;
  return label || help || error ? <Field label={label} help={help} error={error} htmlFor={fieldId}>{input}</Field> : input;
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
export function DecimalInput({ value, onChange, label, help, error, id, className = '', ...rest }) {
  const fieldId = useFieldId(id);
  const input = (
    <input
      id={fieldId}
      type="text"
      inputMode="decimal"
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
  const fieldId = useFieldId(id);
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

// Fields side by side when they fit (min width per field), stacked otherwise.
// split: one main field plus a short companion (dose + unit).
export function FieldRow({ split = false, min, className = '', children }) {
  return (
    <div className={cx('ui-row', split && 'ui-row--split', className)} style={min ? { '--ui-row-min': min } : undefined}>
      {children}
    </div>
  );
}
