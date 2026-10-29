import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setMedicationConflictHandler } from '../utils/medicationConflictPrompt';
import { regimenSnapshot } from '../utils/medicationSchedule';
import { changeTypeLabel, describeChange, regimenSummary } from '../utils/medicationChanges';
import { BottomSheet, Button, ChoiceList, Inset } from './ui';

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
    <BottomSheet
      title={t('medication_changes.conflict_title')}
      dismissible={false}
      footer={<Button variant="primary" size="lg" fullWidth onClick={apply}>{t('medication_changes.conflict_apply')}</Button>}
    >
      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{t('medication_changes.conflict_intro')}</p>
      {request.conflicts.map(conflict => (
        <Inset key={conflict.uuid} className="space-y-2">
          <p className="text-sm font-black">{conflict.name}</p>
          <ChoiceList
            value={choices[conflict.uuid]}
            onChange={side => setChoices(c => ({ ...c, [conflict.uuid]: side }))}
            options={['local', 'incoming'].map(side => ({
              value: side,
              label: `${t(side === 'local' ? 'medication_changes.conflict_keep_local' : 'medication_changes.conflict_use_incoming')}${conflict.newer === side ? ` · ${t('medication_changes.conflict_newer')}` : ''}`,
              detail: describeSide(side === 'local' ? conflict.localLatest : conflict.incomingLatest, side === 'local' ? conflict.local : conflict.incoming),
            }))}
          />
        </Inset>
      ))}
      <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{t('medication_changes.conflict_history_note')}</p>
    </BottomSheet>
  );
}
