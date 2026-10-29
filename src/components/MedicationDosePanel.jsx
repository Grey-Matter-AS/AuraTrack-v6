import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { slotDose, slotLabel, scheduledTimestampForDay } from '../utils/medicationSchedule';
import { CheckIcon, PillIcon } from './AppIcons';

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

  const selectStyle = {
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  };
  const translatedSlotLabel = (hhMM) => t(`medication_panel.slots.${slotLabel(hhMM).toLowerCase()}`, slotLabel(hhMM));

  return (
    <div
      className="w-full rounded-2xl p-3 space-y-3"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex justify-between items-center gap-3">
        <div className="min-w-0 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--accent)' }}
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
          <button
            onClick={handleSave}
            disabled={toggledKeys.size === 0}
            className="rounded-xl px-3 py-2 text-[10px] font-medium uppercase tracking-widest active:scale-95 transition-all disabled:opacity-30"
            style={{ backgroundColor: '#16a34a', color: '#fff', border: '1px solid #15803d' }}
          >
            {t('medication_panel.save')}
          </button>
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
                    const btnStyle = active
                      ? { backgroundColor: '#16a34a', color: '#fff', border: '1px solid #15803d' }
                      : slotIsMissed
                      ? { backgroundColor: '#dc2626', color: '#fff', border: '1px solid #991b1b' }
                      : slotIsLate
                      ? { backgroundColor: '#334155', color: '#facc15', border: '1px solid #f59e0b' }
                      : { backgroundColor: '#334155', color: '#fff', border: '1px solid #64748b' };
                    return (
                      <button
                        key={key}
                        onClick={() => toggle(med.id, hhMM)}
                        className="px-4 py-2 rounded-full font-medium text-xs transition-all active:scale-95"
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

        <button
          onClick={() => setShowAdHoc(true)}
          className="w-full rounded-2xl px-4 py-3 text-[10px] font-medium uppercase tracking-widest active:scale-[0.98] transition-all"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
        >
          {t('medication_panel.extra_dose')}
        </button>
      </div>

      {/* Ad-hoc dose bottom sheet */}
      {showAdHoc && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdHoc(false); }}
        >
          <div
            className="w-full max-w-md rounded-[2rem] p-6 space-y-4"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.3em]" style={{ color: 'var(--text-dim)' }}>
              {t('medication_panel.log_extra_dose')}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
              {t('medication_panel.extra_dose_help')}
            </p>
            <input
              type="text"
              value={adHocNote}
              onChange={e => setAdHocNote(e.target.value)}
              placeholder={t('medication_panel.reason_placeholder')}
              aria-label={t('medication_panel.reason_label')}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={selectStyle}
            />
            <div className="space-y-2">
              {allActiveMedications.map(med => (
                <button
                  key={med.id}
                  onClick={() => handleAdHocSave(med)}
                  className="w-full py-3 px-4 rounded-2xl text-left transition-all active:scale-[0.98]"
                  style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}
                >
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{med.name}</span>
                  <span className="ml-2 text-xs" style={{ color: 'var(--text-dim)' }}>
                    {med.dose}{med.unit} · {med.frequency}
                    {med.isRescue && <span className="ml-1 text-amber-500">· {t('medication_panel.rescue')}</span>}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAdHoc(false)}
              className="w-full py-3 rounded-2xl font-medium text-xs uppercase tracking-widest"
              style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
            >
              {t('medication_panel.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
