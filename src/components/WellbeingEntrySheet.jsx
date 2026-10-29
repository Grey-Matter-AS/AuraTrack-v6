import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WELLBEING_MOOD_OPTIONS } from '../data/constants';
import { BottomSheet, Button, Checkbox, ChipGroup, DateInput, DecimalInput, Field, Inset, TextArea } from './ui';

const INTENSITY_OPTIONS = [
  { value: 1, label: 'Mild', labelKey: 'wellbeing.mild' },
  { value: 2, label: 'Moderate', labelKey: 'wellbeing.moderate' },
  { value: 3, label: 'Strong', labelKey: 'wellbeing.strong' },
];

function valueFromEntryFactor(factor) {
  if (factor && typeof factor === 'object' && 'value' in factor) return factor.value;
  return factor;
}

function translatedLabel(t, item, fallback = '') {
  return item?.labelKey ? t(item.labelKey, item.label || fallback) : (item?.label || fallback);
}

function translatedHelp(t, item) {
  return item?.helpKey ? t(item.helpKey, item.help || '') : (item?.help || '');
}

function translatedScaleLabels(t, definition) {
  if (Array.isArray(definition.scaleLabelKeys) && definition.scaleLabelKeys.length === 4) {
    return definition.scaleLabelKeys.map((key, index) => t(key, definition.scaleLabels?.[index] || ''));
  }
  if (Array.isArray(definition.scaleLabels) && definition.scaleLabels.length === 4) return definition.scaleLabels;
  return [
    t('wellbeing.none', 'None'),
    t('wellbeing.mild', 'Mild'),
    t('wellbeing.moderate', 'Moderate'),
    t('wellbeing.severe', 'Severe'),
  ];
}

function FactorControl({ definition, value, onChange, t }) {
  const label = translatedLabel(t, definition, definition.id);
  const help = translatedHelp(t, definition);
  if (definition.type === 'boolean') {
    return (
      <Checkbox checked={value} onChange={onChange} label={label} help={help} title={help} />
    );
  }

  if (definition.type === 'scale') {
    const numeric = value === undefined || value === null || value === '' ? null : Number(value);
    const scaleLabels = translatedScaleLabels(t, definition);
    return (
      <Inset className="space-y-2" title={help}>
        <div>
          <p className="text-sm font-medium">{label}</p>
          {help && <p className="text-[11px] leading-snug mt-0.5" style={{ color: 'var(--text-dim)' }}>{help}</p>}
        </div>
        <ChipGroup
          fill
          label={label}
          value={numeric}
          onChange={onChange}
          options={scaleLabels.map((scaleLabel, scaleValue) => ({ value: scaleValue, label: scaleLabel }))}
        />
      </Inset>
    );
  }

  return (
    <Inset className="space-y-2" title={help}>
      <div>
        <p className="text-sm font-medium">{label}</p>
        {help && <p className="text-[11px] leading-snug mt-0.5" style={{ color: 'var(--text-dim)' }}>{help}</p>}
      </div>
      <div className="ui-row ui-row--split items-center">
        <DecimalInput value={value ?? ''} onChange={onChange} aria-label={label} />
        {definition.unit ? <span className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>{definition.unit}</span> : <span />}
      </div>
    </Inset>
  );
}

export function WellbeingEntrySheet({ entry = null, factorDefinitions = [], onSave, onClose }) {
  const { t } = useTranslation();
  const [primaryMood, setPrimaryMood] = useState(entry?.primaryMood || WELLBEING_MOOD_OPTIONS[0].label);
  const [intensity, setIntensity] = useState(entry?.intensity || 1);
  const [recordedAt, setRecordedAt] = useState(() => {
    const source = entry?.recordedAt ? new Date(entry.recordedAt) : new Date();
    const offset = source.getTimezoneOffset() * 60000;
    return new Date(source.getTime() - offset).toISOString().slice(0, 16);
  });
  const [factors, setFactors] = useState(() => {
    const initial = {};
    Object.entries(entry?.factors || {}).forEach(([key, factor]) => {
      initial[key] = valueFromEntryFactor(factor);
    });
    return initial;
  });
  const [notes, setNotes] = useState(entry?.notes || '');
  const [error, setError] = useState('');

  const selectedMood = useMemo(
    () => WELLBEING_MOOD_OPTIONS.find(option => option.label === primaryMood),
    [primaryMood]
  );
  const activeDefinitions = factorDefinitions.filter(definition => definition.active !== false);

  const updateFactor = (id, value) => {
    setFactors(prev => ({ ...prev, [id]: value }));
  };

  const submit = async () => {
    try {
      setError('');
      await onSave({
        recordedAt: new Date(recordedAt).getTime(),
        primaryMood,
        intensity,
        factors,
        notes,
      }, entry?.id || null);
      onClose();
    } catch (err) {
      setError(err?.message || t('wellbeing.save_failed', 'Could not save wellbeing entry.'));
    }
  };

  return (
    <BottomSheet
      title={entry ? t('wellbeing.edit_entry', 'Edit Wellbeing Entry') : t('wellbeing.new_entry', 'Log Wellbeing')}
      onClose={onClose}
      testId="wellbeing-entry-sheet"
      bodyTestId="wellbeing-entry-scroll"
      footer={(
        <>
          {error && <p className="app-alert app-alert--danger rounded-xl px-4 py-3 text-xs font-medium">{error}</p>}
          <div className="ui-button-row">
            <Button variant="success" onClick={submit}>{t('wellbeing.save', 'Save')}</Button>
            <Button variant="secondary" onClick={onClose}>{t('eeg.cancel', 'Cancel')}</Button>
          </div>
        </>
      )}
    >
      <DateInput type="datetime-local" label={t('wellbeing.recorded_at', 'Date and time')} value={recordedAt} onChange={setRecordedAt} />

      <Field label={t('wellbeing.mood', 'Mood')} help={selectedMood ? translatedHelp(t, selectedMood) : ''}>
        <ChipGroup
          fill
          label={t('wellbeing.mood', 'Mood')}
          value={primaryMood}
          onChange={setPrimaryMood}
          options={WELLBEING_MOOD_OPTIONS.map(option => ({ value: option.label, label: translatedLabel(t, option) }))}
        />
      </Field>

      <Field label={t('wellbeing.intensity', 'Intensity')}>
        <ChipGroup
          fill
          label={t('wellbeing.intensity', 'Intensity')}
          value={intensity}
          onChange={setIntensity}
          options={INTENSITY_OPTIONS.map(option => ({ value: option.value, label: t(option.labelKey, option.label) }))}
        />
      </Field>

      <div className="space-y-2">
        <p className="ui-label">{t('wellbeing.context', 'Context')}</p>
        {activeDefinitions.map(definition => (
          <FactorControl
            key={definition.id}
            definition={definition}
            value={factors[definition.id]}
            onChange={value => updateFactor(definition.id, value)}
            t={t}
          />
        ))}
      </div>

      <TextArea
        label={t('wellbeing.notes_label', 'Notes')}
        value={notes}
        onChange={setNotes}
        placeholder={t('wellbeing.notes_placeholder', 'Notes (optional)')}
        rows={3}
      />
    </BottomSheet>
  );
}
