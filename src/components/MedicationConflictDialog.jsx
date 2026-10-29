import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setMedicationConflictHandler } from '../utils/medicationConflictPrompt';
import { regimenSnapshot } from '../utils/medicationSchedule';
import { changeTypeLabel, describeChange, regimenSummary } from '../utils/medicationChanges';

// ─── Sync / import: warn before overwriting a medication ──────
// Mounted once in App. When a merge finds a medication that differs between the two sides it
// waits here; the side with the most recently confirmed change is preselected.
export function MedicationConflictDialog() {
  const { t } = useTranslation();
  const [request, setRequest] = useState(null); // { conflicts, resolve }
  const [choices, setChoices] = useState({});

  useEffect(() => setMedicationConflictHandler(conflicts => new Promise(resolve => {
    setChoices(Object.fromEntries(conflicts.map(c => [c.uuid, c.newer])));
    setRequest({ conflicts, resolve });
  })), []);

  if (!request) return null;

  const describeSide = (latest, med) => {
    if (!latest) return t('medication_changes.conflict_no_history', { summary: regimenSummary(regimenSnapshot(med), t) });
    const when = new Date(latest.recordedAt ?? latest.effectiveAt).toLocaleDateString();
    const what = describeChange(latest, t).join('; ');
    return `${when} · ${changeTypeLabel(latest.type, t)}${what ? ` — ${what}` : ''}`;
  };

  const apply = () => {
    request.resolve(choices);
    setRequest(null);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-6">
      <div
        className="w-full max-w-md rounded-[2rem] flex flex-col overflow-hidden max-h-[90dvh]"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="px-6 pt-6 shrink-0 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--status-late-text)' }}>
            {t('medication_changes.conflict_title')}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{t('medication_changes.conflict_intro')}</p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          {request.conflicts.map(conflict => (
            <div key={conflict.uuid} className="rounded-2xl p-4 space-y-2" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{conflict.name}</p>
              {[
                { side: 'local', label: t('medication_changes.conflict_keep_local'), detail: describeSide(conflict.localLatest, conflict.local) },
                { side: 'incoming', label: t('medication_changes.conflict_use_incoming'), detail: describeSide(conflict.incomingLatest, conflict.incoming) },
              ].map(option => {
                const selected = choices[conflict.uuid] === option.side;
                return (
                  <button
                    key={option.side}
                    onClick={() => setChoices(c => ({ ...c, [conflict.uuid]: option.side }))}
                    className="w-full text-left rounded-xl px-3 py-2.5 transition-all active:scale-[0.98]"
                    style={{
                      backgroundColor: selected ? 'var(--action-blue)' : 'var(--bg-card)',
                      color: selected ? '#fff' : 'var(--text-primary)',
                      border: selected ? '1px solid var(--action-blue-border)' : '1px solid var(--border)',
                    }}
                  >
                    <span className="block text-[11px] font-black uppercase tracking-widest">
                      {option.label}
                      {conflict.newer === option.side && ` · ${t('medication_changes.conflict_newer')}`}
                    </span>
                    <span className="block text-[11px] mt-0.5" style={{ opacity: 0.85 }}>{option.detail}</span>
                  </button>
                );
              })}
            </div>
          ))}
          <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{t('medication_changes.conflict_history_note')}</p>
        </div>

        <div className="px-6 pb-6 pt-2 shrink-0">
          <button
            onClick={apply}
            className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-lg"
            style={{ backgroundColor: 'var(--action-blue)', color: '#fff', border: '1px solid var(--action-blue-border)' }}
          >
            {t('medication_changes.conflict_apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
