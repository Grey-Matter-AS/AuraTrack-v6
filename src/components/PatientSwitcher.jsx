import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PROFILE_COLORS } from '../data/profiles';
import { patientName } from '../utils/patients';
import { BottomSheet, Button, ChoiceList } from './ui';

export function PatientDot({ color }) {
  return <span aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PROFILE_COLORS[color] || PROFILE_COLORS.blue }} />;
}

// "Recording for: Anna" — shown whenever more than one patient is on this device, so a seizure is
// never logged on the wrong person
export function PatientBanner({ profile, profiles, label }) {
  const { t } = useTranslation();
  if (!profile || profiles.length < 2) return null;
  const color = PROFILE_COLORS[profile.color] || PROFILE_COLORS.blue;
  return (
    <div className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-widest"
      style={{ border: `2px solid ${color}`, color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}>
      <PatientDot color={profile.color} />
      <span className="min-w-0 break-words">{label || t('patients.recording_for', { name: patientName(profile, profiles, t) })}</span>
    </div>
  );
}

// Header chip: the active patient; tap to switch (only shown with more than one patient)
export function PatientSwitcher({ profiles, activeId, onSwitch, onManage }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const active = profiles.find(p => p.id === activeId);
  if (profiles.length < 2 || !active) return null;
  return (
    <>
      <button type="button" className="ui-chip mx-auto mt-2 max-w-full" aria-label={t('patients.switch_label')} onClick={() => setOpen(true)}>
        <PatientDot color={active.color} />
        <span className="truncate">{patientName(active, profiles, t)}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <BottomSheet
          title={t('patients.switch_title')}
          onClose={() => setOpen(false)}
          footer={<Button variant="secondary" fullWidth onClick={() => { setOpen(false); onManage(); }}>{t('patients.manage')}</Button>}
        >
          <ChoiceList
            value={activeId}
            onChange={async (id) => { setOpen(false); if (id !== activeId) await onSwitch(id); }}
            options={profiles.map(p => ({ value: p.id, label: <span className="inline-flex items-center gap-2"><PatientDot color={p.color} />{patientName(p, profiles, t)}</span> }))}
          />
        </BottomSheet>
      )}
    </>
  );
}
