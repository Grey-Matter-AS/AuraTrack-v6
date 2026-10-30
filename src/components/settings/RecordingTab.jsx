import { useTranslation } from 'react-i18next';
import { DEFAULT_WELLBEING_FACTORS } from '../../data/constants';
import { SymptomLibrarySettings } from '../SymptomLibrarySettings';
import { EmergencyPlanSection } from './EmergencyPlanSection';
import { FieldLabel, Row, Section, TextField } from './atoms';
import { FieldRow, Inset, Select, TextArea, TextInput, Toggle } from '../ui';

// ─── Recording tab: emergency plan, saved symptom sets, recording and wellbeing options ──
export function RecordingTab({ settings, onUpdate, notificationPermission, onRequestNotificationPermission }) {
  const { t } = useTranslation();
  const wellbeingFactors = Array.isArray(settings.wellbeingFactorDefinitions) && settings.wellbeingFactorDefinitions.length
    ? settings.wellbeingFactorDefinitions
    : DEFAULT_WELLBEING_FACTORS;

  const updateWellbeingFactor = (index, changes) => {
    const next = wellbeingFactors.map((factor, i) => i === index ? { ...factor, ...changes } : factor);
    onUpdate('wellbeingFactorDefinitions', next);
  };

  const addWellbeingFactor = () => {
    const id = `custom-${Date.now()}`;
    onUpdate('wellbeingFactorDefinitions', [
      ...wellbeingFactors,
      { id, label: t('settings.recording.custom_factor', 'Custom factor'), type: 'boolean', unit: '', help: '', active: true },
    ]);
  };

  const removeWellbeingFactor = (index) => {
    onUpdate('wellbeingFactorDefinitions', wellbeingFactors.filter((_, i) => i !== index));
  };

  const show = () => true;
  return (
    <>
      {/* ── RECORDING ── */}
      {show('recording') && <EmergencyPlanSection settings={settings} onUpdate={onUpdate} />}
      {show('recording') && <SymptomLibrarySettings settings={settings} onUpdate={onUpdate} />}
      {show('recording') && <Section title={t('settings.recording.section')}>
        <Row label={t('settings.recording.haptic')} help={t('settings.recording.haptic_help')}>
          <Toggle value={settings.hapticFeedback} onChange={v => onUpdate('hapticFeedback', v)} label={t('settings.recording.haptic')} />
        </Row>
        <Row label={t('settings.recording.eeg_diary')} help={t('settings.recording.eeg_diary_help')}>
          <Toggle value={settings.eegDiaryEnabled} onChange={v => onUpdate('eegDiaryEnabled', v)} label={t('settings.recording.eeg_diary')} />
        </Row>
        <Row
          label={t('settings.recording.wellbeing', 'Wellbeing tracking')}
          help={t('settings.recording.wellbeing_help', 'Optional mood and context logging for pattern spotting.')}
        >
          <Toggle value={settings.wellbeingEnabled !== false} onChange={v => onUpdate('wellbeingEnabled', v)} label={t('settings.recording.wellbeing', 'Wellbeing tracking')} />
        </Row>
        {settings.wellbeingEnabled !== false && (
          <div className="space-y-4">
            <Row
              label={t('settings.recording.wellbeing_reminder', 'Daily wellbeing reminder')}
              help={t('settings.recording.wellbeing_reminder_help', 'Optional reminder. It is skipped after a wellbeing entry is saved for the day.')}
            >
              <Toggle
                value={settings.wellbeingDailyReminderEnabled === true}
                onChange={async value => {
                  if (value && notificationPermission !== 'granted') {
                    const permission = await onRequestNotificationPermission?.();
                    if (permission !== 'granted') return;
                  }
                  onUpdate('wellbeingDailyReminderEnabled', value);
                }}
                label={t('settings.recording.wellbeing_reminder', 'Daily wellbeing reminder')}
              />
            </Row>
            {settings.wellbeingDailyReminderEnabled && (
              <TextField
                label={t('settings.recording.wellbeing_reminder_time', 'Reminder time')}
                value={settings.wellbeingReminderTime || '20:00'}
                onChange={v => onUpdate('wellbeingReminderTime', v)}
                type="time"
              />
            )}
            <div>
              <FieldLabel>{t('settings.recording.wellbeing_factors', 'Wellbeing factors')}</FieldLabel>
              <p className="text-[11px] text-[var(--text-dim)] mb-3">
                {t('settings.recording.wellbeing_factors_help', 'Choose the context fields shown in the wellbeing sheet. Existing diary entries keep their saved labels.')}
              </p>
              <div className="space-y-3">
                {wellbeingFactors.map((factor, index) => (
                  <Inset key={factor.id || index} className="!p-3 space-y-2">
                    <div className="ui-row ui-row--split items-center">
                      <TextInput
                        aria-label={t('settings.recording.factor_label', 'Factor name')}
                        placeholder={t('settings.recording.factor_label', 'Factor name')}
                        value={factor.label || ''}
                        onChange={value => updateWellbeingFactor(index, { label: value })}
                      />
                      <Toggle
                        value={factor.active !== false}
                        onChange={value => updateWellbeingFactor(index, { active: value })}
                        label={factor.label || t('settings.recording.factor_active', 'Factor active')}
                      />
                    </div>
                    <FieldRow split>
                      <Select
                        aria-label={t('settings.recording.factor_type', 'Factor type')}
                        value={factor.type || 'boolean'}
                        onChange={value => updateWellbeingFactor(index, { type: value })}
                        options={[
                          { value: 'boolean', label: t('settings.recording.factor_type_boolean', 'Present / absent') },
                          { value: 'scale', label: t('settings.recording.factor_type_scale', 'Scale 0-3') },
                          { value: 'number', label: t('settings.recording.factor_type_number', 'Number') },
                        ]}
                      />
                      <TextInput
                        aria-label={t('settings.recording.factor_unit_placeholder', 'Unit')}
                        value={factor.unit || ''}
                        onChange={value => updateWellbeingFactor(index, { unit: value })}
                        placeholder={t('settings.recording.factor_unit_placeholder', 'Unit')}
                        className="!w-24"
                      />
                    </FieldRow>
                    <TextArea
                      aria-label={t('settings.recording.factor_help_placeholder', 'Tooltip/helper text')}
                      value={factor.help || ''}
                      onChange={value => updateWellbeingFactor(index, { help: value })}
                      placeholder={t('settings.recording.factor_help_placeholder', 'Tooltip/helper text')}
                      rows={2}
                    />
                    <button
                      onClick={() => removeWellbeingFactor(index)}
                      className="ui-btn ui-btn--danger ui-btn--sm"
                    >
                      {t('settings.recording.remove_factor', 'Remove factor')}
                    </button>
                  </Inset>
                ))}
              </div>
              <div className="ui-button-row mt-3">
                <button
                  onClick={addWellbeingFactor}
                  className="ui-btn ui-btn--secondary ui-btn--md"
                >
                  {t('settings.recording.add_factor', 'Add factor')}
                </button>
                <button
                  onClick={() => onUpdate('wellbeingFactorDefinitions', DEFAULT_WELLBEING_FACTORS)}
                  className="ui-btn ui-btn--secondary ui-btn--md"
                >
                  {t('settings.recording.reset_factors', 'Reset factors')}
                </button>
              </div>
            </div>
          </div>
        )}
        <div>
          <FieldLabel>{t('settings.recording.quick_labels')}</FieldLabel>
          <p className="text-[11px] text-[var(--text-dim)] mb-3">{t('settings.recording.quick_labels_help')}</p>
          <FieldRow min="8rem">
            {(settings.quickNoteLabels || []).map((label, i) => (
              <TextInput
                key={i}
                aria-label={t('settings.recording.button_n', { n: i + 1 })}
                value={label}
                onChange={value => {
                  const updated = [...settings.quickNoteLabels];
                  updated[i] = value;
                  onUpdate('quickNoteLabels', updated);
                }}
                placeholder={t('settings.recording.button_n', { n: i + 1 })}
                className="text-center"
              />
            ))}
          </FieldRow>
        </div>
      </Section>}

    </>
  );
}
