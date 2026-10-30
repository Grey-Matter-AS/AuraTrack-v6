import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PROFILE_COLORS, addProfile, getActiveProfileId, listProfiles, removeProfile, updateProfile } from '../../data/profiles';
import { DATA_CHANGED_EVENT } from '../../utils/dataEvents';
import { patientName } from '../../utils/patients';
import { PatientDot } from '../PatientSwitcher';
import { TrashIcon } from '../AppIcons';
import { Button, Dialog, IconButton, Select, TextInput } from '../ui';
import { Section } from './atoms';

const COLOR_KEYS = Object.keys(PROFILE_COLORS);

// ─── Patients on this device (Settings → Identity) ─────────────
// Each patient's records are kept apart. Removing one deletes only this device's copy.
export function PatientsSection() {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [newName, setNewName] = useState('');
  const [pendingRemove, setPendingRemove] = useState(null);

  const load = useCallback(async () => {
    const [list, active] = await Promise.all([listProfiles(), getActiveProfileId()]);
    setProfiles(list);
    setActiveId(active);
  }, []);
  useEffect(() => {
    const id = setTimeout(() => { load().catch(() => {}); }, 0);
    window.addEventListener(DATA_CHANGED_EVENT, load);
    return () => { clearTimeout(id); window.removeEventListener(DATA_CHANGED_EVENT, load); };
  }, [load]);

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    const used = new Set(profiles.map(p => p.color));
    await addProfile(name, COLOR_KEYS.find(c => !used.has(c)) || 'green');
    setNewName('');
  };

  const colorOptions = COLOR_KEYS.map(key => ({ value: key, label: t(`patients.color_${key}`) }));

  return (
    <Section title={t('patients.section')}>
      <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>{t('patients.section_help')}</p>
      {profiles.map(profile => (
        <div key={profile.id} className="ui-inset space-y-2">
          <div className="flex items-center gap-2">
            <PatientDot color={profile.color} />
            <p className="flex-1 min-w-0 text-sm font-black break-words">{patientName(profile, profiles, t)}</p>
            {profile.id === activeId && <span className="app-status-badge app-status-badge--info">{t('patients.active')}</span>}
            {profiles.length > 1 && (
              <IconButton label={t('patients.remove')} tone="danger" onClick={() => setPendingRemove(profile)}>
                <TrashIcon className="w-4 h-4" />
              </IconButton>
            )}
          </div>
          <div className="ui-row">
            <TextInput
              aria-label={t('patients.name')}
              placeholder={t('patients.name')}
              defaultValue={profile.name}
              maxLength={60}
              onBlur={e => { const name = e.target.value.trim(); if (name !== profile.name) updateProfile(profile.id, { name }); }}
            />
            <Select aria-label={t('patients.color')} value={profile.color} onChange={color => updateProfile(profile.id, { color })} options={colorOptions} />
          </div>
        </div>
      ))}
      <div className="ui-inline">
        <TextInput
          aria-label={t('patients.new_name')}
          placeholder={t('patients.new_name')}
          value={newName}
          onChange={setNewName}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          maxLength={60}
          className="flex-1 min-w-0"
        />
        <Button variant="secondary" size="sm" disabled={!newName.trim()} onClick={add}>{t('patients.add')}</Button>
      </div>

      {pendingRemove && (
        <Dialog
          tone="danger"
          title={t('patients.remove_title', { name: patientName(pendingRemove, profiles, t) })}
          message={t('patients.remove_body')}
          onClose={() => setPendingRemove(null)}
          actions={(
            <>
              <Button variant="danger" fullWidth onClick={async () => { await removeProfile(pendingRemove.id); setPendingRemove(null); }}>{t('patients.remove_confirm')}</Button>
              <Button variant="secondary" fullWidth onClick={() => setPendingRemove(null)}>{t('medication_changes.cancel')}</Button>
            </>
          )}
        />
      )}
    </Section>
  );
}
