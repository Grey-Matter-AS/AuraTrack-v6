import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { slotDose, slotLabel, scheduledTimestampForDay } from '../utils/medicationSchedule';
import { CheckIcon, PillIcon } from './AppIcons';
import { BottomSheet, Button, Card, ChoiceList, TextInput } from './ui';

export function MedicationDosePanel({ medicationGroups, allActiveMedications, onSaveDoses }) {
  const { t } = useTranslation();
  const [nowMs] = useState(() => Date.now());
  // toggledKeys: Set of "medicationId|hhMM" strings
  const [toggledKeys, setToggledKeys] = useState(new Set());
  const [saved, setSaved] = useState(false);
  const [showAdHoc, setShowAdHoc] = useState(false);
  const [adHocNote, setAdHocNote] = useState('');

  const timeSlots = Object.keys(medicationGroups);
  if (timeSlots.length === 0 && allActiveMedications.length === 0) return null;
  const allDoneToday = timeSlots.length === 0 && allActiveMedications.length > 0;

  const toggle = (medId, hhMM) => {
    const key = `${medId}|${hhMM}`;
    setToggledKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    const doses = [...toggledKeys].map(k => {
      const [medicationId, scheduledHHMM] = k.split('|');
      return { medicationId: Number(medicationId), scheduledHHMM };
    });
    await onSaveDoses(doses);
    setToggledKeys(new Set());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleAdHocSave = async (med) => {
    await onSaveDoses([{ medicationId: med.id, scheduledHHMM: null, note: adHocNote }]);
    setShowAdHoc(false);
    setAdHocNote('');
  };

  const translatedSlotLabel = (hhMM) => t(`medication_panel.slots.${slotLabel(hhMM).toLowerCase()}`, slotLabel(hhMM));

  return (
    <Card compact className="w-full space-y-3">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="min-w-0 flex-1 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--accent-text)' }}
          >
            <PillIcon className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('medication_panel.title')}
          </h3>
        </div>
        {saved ? (
          <span className="app-status-badge app-status-badge--success">
            <CheckIcon className="w-3 h-3" /> {t('medication_panel.saved')}
          </span>
        ) : (
          <Button variant="success" size="sm" className="shrink-0" onClick={handleSave} disabled={toggledKeys.size === 0}>
            {t('medication_panel.save')}
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {timeSlots.length === 0 ? (
          <p className="text-xs italic text-center py-1" style={{ color: allDoneToday ? 'inherit' : 'var(--text-faint)' }}>
            {allDoneToday ? (
              <span className="app-status-badge app-status-badge--success">
                <CheckIcon className="w-3.5 h-3.5" /> {t('medication_panel.all_done_today')}
              </span>
            ) : t('medication_panel.no_scheduled_today')}
          </p>
        ) : (
          timeSlots.map(hhMM => {
            const scheduledTs = scheduledTimestampForDay(hhMM, nowMs);
            const diffMin = (nowMs - scheduledTs) / 60000;
            const slotIsMissed = diffMin > 90;
            const slotIsLate = diffMin > 0 && !slotIsMissed;
            const slotColor = slotIsMissed ? 'var(--status-missed-text)' : slotIsLate ? 'var(--status-late-text)' : 'var(--text-faint)';
            const slotTag = slotIsMissed ? ` · ${t('medication_panel.missed')}` : slotIsLate ? ` · ${t('medication_panel.late')}` : '';
            return (
              <div key={hhMM}>
                <p className="text-[9px] font-semibold uppercase tracking-widest mb-2" style={{ color: slotColor }}>
                  {translatedSlotLabel(hhMM)} · {hhMM}{slotTag}
                </p>
                <div className="flex flex-wrap gap-2">
                  {medicationGroups[hhMM].map(med => {
                    const key = `${med.id}|${hhMM}`;
                    const active = toggledKeys.has(key);
                    // Colour carries the dose status: selected to log, missed, late, or due
                    const btnStyle = active
                      ? { backgroundColor: 'var(--success)', color: 'var(--on-action)', borderColor: 'var(--success-border)' }
                      : slotIsMissed
                      ? { backgroundColor: 'var(--danger)', color: 'var(--on-action)', borderColor: 'var(--danger-border)' }
                      : slotIsLate
                      ? { backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)', borderColor: 'var(--warning-border)' }
                      : undefined;
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggle(med.id, hhMM)}
                        className="ui-chip !normal-case !tracking-normal !text-xs"
                        style={btnStyle}
                      >
                        {med.name} {slotDose(med, hhMM)}{med.unit}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        <Button variant="secondary" fullWidth onClick={() => setShowAdHoc(true)}>
          {t('medication_panel.extra_dose')}
        </Button>
      </div>

      {/* Ad-hoc dose bottom sheet */}
      {showAdHoc && (
        <BottomSheet
          title={t('medication_panel.log_extra_dose')}
          onClose={() => setShowAdHoc(false)}
          footer={<Button variant="secondary" fullWidth onClick={() => setShowAdHoc(false)}>{t('medication_panel.cancel')}</Button>}
        >
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{t('medication_panel.extra_dose_help')}</p>
          <TextInput
            label={t('medication_panel.reason_label')}
            value={adHocNote}
            onChange={setAdHocNote}
            placeholder={t('medication_panel.reason_placeholder')}
          />
          <ChoiceList
            value={null}
            onChange={id => handleAdHocSave(allActiveMedications.find(med => med.id === id))}
            options={allActiveMedications.map(med => ({
              value: med.id,
              label: med.name,
              detail: `${med.dose}${med.unit} · ${med.frequency}${med.isRescue ? ` · ${t('medication_panel.rescue')}` : ''}`,
            }))}
          />
        </BottomSheet>
      )}
    </Card>
  );
}
