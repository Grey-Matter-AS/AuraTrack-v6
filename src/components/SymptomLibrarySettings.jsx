import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SEIZURE_TYPES, seizureTypeLabel } from '../data/constants';
import {
  CUSTOM_SYMPTOMS_KEY, MAX_SET_NAME, SETS_KEY, baseSetName, capitalise, suggestSetName, symptomLabel, uniqueSetName,
} from '../utils/symptomSets';
import { CloseIcon, TrashIcon } from './AppIcons';
import { Button, Card, Dialog, EmptyState, IconButton, Section, Select, TextInput } from './ui';

// ─── One saved symptom set ────────────────────────────────────
function SetEditor({ set, sets, onChange, onDelete, onMove, isFirst, isLast }) {
  const { t } = useTranslation();
  const [name, setName] = useState(set.name);
  const suggestion = suggestSetName(set.seizureType, set.symptoms || [], sets, t, set.id);

  // A name left as suggested follows the set; a name the user wrote is never changed
  const update = (fields) => {
    const next = { ...set, ...fields };
    if (set.autoName && !('name' in fields)) next.name = suggestSetName(next.seizureType, next.symptoms || [], sets, t, set.id);
    onChange(next);
    if (next.name !== set.name) setName(next.name);
  };
  const commitName = () => {
    const clean = name.trim().slice(0, MAX_SET_NAME);
    if (!clean) { setName(set.name); return; }
    const unique = uniqueSetName(clean, set.seizureType, sets, set.id);
    setName(unique);
    if (unique !== set.name) onChange({ ...set, name: unique, autoName: unique === baseSetName(set.seizureType, set.symptoms || [], t) });
  };

  return (
    <Card className="space-y-3">
      <TextInput
        label={t('symptom_sets.name_title')}
        value={name}
        maxLength={MAX_SET_NAME}
        onChange={setName}
        onBlur={commitName}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
      {suggestion !== set.name && (
        <Button variant="secondary" size="sm" onClick={() => { setName(suggestion); onChange({ ...set, name: suggestion, autoName: true }); }}>
          {t('symptom_sets.use_suggested', { name: suggestion })}
        </Button>
      )}
      <Select
        label={t('summary.seizure_type')}
        value={set.seizureType || ''}
        onChange={value => update({ seizureType: value })}
        options={[{ value: '', label: t('symptom_sets.untyped') }, ...SEIZURE_TYPES.map(type => ({ value: type, label: seizureTypeLabel(type, t) }))]}
      />
      <div>
        <p className="ui-label">{t('symptom_sets.symptoms_in_set', { count: set.symptoms?.length || 0 })}</p>
        <div className="space-y-1">
          {(set.symptoms || []).map((symptom, index) => (
            <div key={`${symptomLabel(symptom)}-${index}`} className="flex items-center gap-2">
              <p className="flex-1 min-w-0 text-xs break-words" style={{ color: 'var(--text-secondary)' }}>{symptomLabel(symptom)}</p>
              {set.symptoms.length > 1 && (
                <IconButton label={t('symptom_sets.remove_symptom')} onClick={() => update({ symptoms: set.symptoms.filter((_, i) => i !== index) })}>
                  <CloseIcon className="w-4 h-4" />
                </IconButton>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="ui-button-row">
        <Button variant="secondary" size="sm" disabled={isFirst} onClick={() => onMove(-1)}>{t('symptom_sets.move_up')}</Button>
        <Button variant="secondary" size="sm" disabled={isLast} onClick={() => onMove(1)}>{t('symptom_sets.move_down')}</Button>
        <Button variant="danger" size="sm" icon={<TrashIcon className="w-4 h-4" />} onClick={onDelete}>{t('symptom_sets.delete')}</Button>
      </div>
    </Card>
  );
}

// ─── Saved symptom sets and the user's own symptoms (Settings → Recording) ──
export function SymptomLibrarySettings({ settings, onUpdate }) {
  const { t } = useTranslation();
  const sets = Array.isArray(settings.favoriteSymptomSets) ? settings.favoriteSymptomSets : [];
  const custom = Array.isArray(settings.customSymptoms) ? settings.customSymptoms : [];
  const [pendingDelete, setPendingDelete] = useState(null);

  const saveSets = (next) => onUpdate(SETS_KEY, next);
  const move = (index, step) => {
    const next = [...sets];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    saveSets(next);
  };
  // Past seizures keep the text they were saved with; only the list for next time changes
  const renameCustom = (index, label) => {
    const clean = capitalise(label);
    if (!clean) return;
    onUpdate(CUSTOM_SYMPTOMS_KEY, custom.map((item, i) => (i === index ? { ...item, label: clean } : item)));
  };
  const customKind = (item) => (item.kind === 'post_ictal'
    ? t('symptom_sets.kind_post_ictal')
    : item.kind === 'detail' ? `${item.group} › ${item.symptom}` : item.group);

  return (
    <Section title={t('symptom_sets.settings_title')}>
      <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>{t('symptom_sets.settings_help')}</p>

      {sets.length === 0
        ? <EmptyState>{t('symptom_sets.none_yet')}</EmptyState>
        : sets.map((set, index) => (
          <SetEditor
            key={set.id}
            set={set}
            sets={sets}
            isFirst={index === 0}
            isLast={index === sets.length - 1}
            onChange={next => saveSets(sets.map(item => (item.id === set.id ? next : item)))}
            onMove={step => move(index, step)}
            onDelete={() => setPendingDelete({ kind: 'set', id: set.id, name: set.name })}
          />
        ))}

      <div className="space-y-2">
        <p className="ui-label">{t('symptom_sets.your_symptoms')}</p>
        {custom.length === 0
          ? <EmptyState>{t('symptom_sets.no_custom')}</EmptyState>
          : custom.map((item, index) => (
            <div key={`${item.kind}-${item.group}-${item.symptom}-${item.label}`} className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <TextInput
                  label={customKind(item)}
                  defaultValue={item.label}
                  maxLength={80}
                  onBlur={e => renameCustom(index, e.target.value)}
                />
              </div>
              <IconButton label={t('symptom_sets.delete')} tone="danger" onClick={() => setPendingDelete({ kind: 'custom', index, name: item.label })}>
                <TrashIcon className="w-4 h-4" />
              </IconButton>
            </div>
          ))}
      </div>

      {pendingDelete && (
        <Dialog
          title={t('symptom_sets.delete_title', { name: pendingDelete.name })}
          message={t('symptom_sets.delete_body')}
          tone="danger"
          onClose={() => setPendingDelete(null)}
          actions={(
            <>
              <Button variant="danger" fullWidth onClick={() => {
                if (pendingDelete.kind === 'set') saveSets(sets.filter(set => set.id !== pendingDelete.id));
                else onUpdate(CUSTOM_SYMPTOMS_KEY, custom.filter((_, i) => i !== pendingDelete.index));
                setPendingDelete(null);
              }}>{t('symptom_sets.delete')}</Button>
              <Button variant="secondary" fullWidth onClick={() => setPendingDelete(null)}>{t('medication_changes.cancel')}</Button>
            </>
          )}
        />
      )}
    </Section>
  );
}
