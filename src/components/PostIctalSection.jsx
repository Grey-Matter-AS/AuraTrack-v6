import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CUSTOM_FINDING, LOCATION_FINDINGS, POST_ICTAL_GROUPS, findingLabel, locationLabel } from '../utils/postIctal';
import { TrashIcon } from './AppIcons';
import { Button, Checkbox, NumberInput, Select, TextInput } from './ui';

const chipStyle = (selected) => (selected
  ? { backgroundColor: 'var(--action-blue)', color: '#fff', border: '1.5px solid var(--action-blue-border)' }
  : { backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1.5px solid var(--border)' });

function Chip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="app-action-tile app-action-tile--compact app-action-tile--center text-[11px] font-black tracking-wide transition-all active:scale-95"
      style={chipStyle(selected)}
    >
      <span className="app-chip-text">{children}</span>
    </button>
  );
}

// Areas recorded for one finding, each removable, plus "add area"
function FindingAreas({ finding, label, onAddArea, onRemoveArea }) {
  const { t } = useTranslation();
  return (
    <div className="ui-inset space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: 'var(--accent-text)' }}>{label}</p>
        <Button variant="secondary" size="sm" onClick={onAddArea}>{t('post_ictal.add_area')}</Button>
      </div>
      {finding.locations.length === 0
        ? <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{t('post_ictal.no_area')}</p>
        : finding.locations.map((location, index) => (
          <div key={`${locationLabel(location)}-${index}`} className="flex items-center gap-2">
            <p className="flex-1 min-w-0 text-[11px] leading-snug break-words" style={{ color: 'var(--text-secondary)' }}>{locationLabel(location)}</p>
            <button type="button" onClick={() => onRemoveArea(index)} className="ui-icon-btn ui-icon-btn--danger" aria-label={t('tagging.remove_area', 'Remove area')}>
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
    </div>
  );
}

// ─── After-seizure (recovery phase) findings ──────────────────
// One scroll, grouped. Findings that affect a body part ask where; recovery time is recorded once.
export function PostIctalSection({ postIctal, savedCustom = [], onToggle, onPickArea, onRemoveArea, onAddCustom, onRemoveCustom, onSetRecovery }) {
  const { t } = useTranslation();
  const selectedKeys = new Set(postIctal.findings.map(f => f.key));
  const [open, setOpen] = useState(() => Object.fromEntries(POST_ICTAL_GROUPS.map(group => [
    group.key, Boolean(group.open || group.findings.some(key => selectedKeys.has(key))),
  ])));
  const [customDraft, setCustomDraft] = useState('');
  const [unit, setUnit] = useState(() => (postIctal.recoveryMinutes >= 120 && postIctal.recoveryMinutes % 60 === 0 ? 'hours' : 'minutes'));
  const recoveryValue = postIctal.recoveryMinutes == null ? 0 : unit === 'hours' ? Math.round(postIctal.recoveryMinutes / 60) : postIctal.recoveryMinutes;

  const toggle = (key) => {
    const adding = !selectedKeys.has(key);
    onToggle(key);
    if (adding && LOCATION_FINDINGS.has(key)) onPickArea(key);
  };
  const customs = postIctal.findings.filter(f => f.key === CUSTOM_FINDING);
  const suggestions = savedCustom.filter(label => !customs.some(f => f.label.toLowerCase() === label.toLowerCase()));
  const addCustom = () => {
    if (!customDraft.trim()) return;
    onAddCustom(customDraft);
    setCustomDraft('');
  };

  return (
    <div className="app-section-card w-full space-y-4">
      <p className="text-[10px] font-black uppercase tracking-widest ml-1" style={{ color: 'var(--text-dim)' }}>
        {t('tagging.post_ictal_findings', 'After-seizure symptoms')} <span className="font-normal normal-case tracking-normal" style={{ color: 'var(--text-faint)' }}>({t('tagging.recovery_phase', 'recovery phase')})</span>
      </p>

      {POST_ICTAL_GROUPS.map(group => {
        const count = group.findings.filter(key => selectedKeys.has(key)).length;
        const isOpen = open[group.key];
        return (
          <div key={group.key} className="space-y-2">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
              className="w-full flex items-center justify-between gap-2 min-h-[2.75rem] text-left"
            >
              <span className="text-xs font-black uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>
                <span aria-hidden="true" className="mr-1.5">{isOpen ? '▾' : '▸'}</span>
                {t(`post_ictal.group.${group.key}`)}
              </span>
              {count > 0 && <span className="app-status-badge app-status-badge--info">{count}</span>}
            </button>
            {isOpen && (
              <>
                <div className="app-choice-grid--compact">
                  {group.findings.map(key => (
                    <Chip key={key} selected={selectedKeys.has(key)} onClick={() => toggle(key)}>
                      {t(`post_ictal.finding.${key}`)}
                    </Chip>
                  ))}
                </div>
                {group.findings.filter(key => LOCATION_FINDINGS.has(key) && selectedKeys.has(key)).map(key => {
                  const finding = postIctal.findings.find(f => f.key === key);
                  return (
                    <FindingAreas
                      key={key}
                      finding={finding}
                      label={findingLabel(finding, t)}
                      onAddArea={() => onPickArea(key)}
                      onRemoveArea={index => onRemoveArea(key, index)}
                    />
                  );
                })}
              </>
            )}
          </div>
        );
      })}

      {/* Findings in the user's own words: remembered for next time */}
      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>{t('post_ictal.group.other')}</p>
        {(customs.length > 0 || suggestions.length > 0) && (
          <div className="app-choice-grid--compact">
            {customs.map(f => <Chip key={f.label} selected onClick={() => onRemoveCustom(f.label)}>{f.label}</Chip>)}
            {suggestions.map(label => <Chip key={label} selected={false} onClick={() => onAddCustom(label)}>{label}</Chip>)}
          </div>
        )}
        <div className="ui-inline">
          <TextInput
            value={customDraft}
            onChange={setCustomDraft}
            onKeyDown={e => { if (e.key === 'Enter') addCustom(); }}
            aria-label={t('post_ictal.other_placeholder')}
            placeholder={t('post_ictal.other_placeholder')}
            maxLength={80}
            className="flex-1 min-w-0"
          />
          <Button variant="secondary" size="sm" onClick={addCustom} disabled={!customDraft.trim()}>{t('post_ictal.add_other')}</Button>
        </div>
      </div>

      {/* How long until back to normal: one of the most useful post-ictal facts */}
      <div className="space-y-2 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <p className="text-xs font-black uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>{t('post_ictal.recovery_title')}</p>
        {!postIctal.recoveryOngoing && (
          <span className="ui-inline">
            <NumberInput
              compact
              value={recoveryValue}
              max={unit === 'hours' ? 72 : 999}
              maxLength={3}
              aria-label={t('post_ictal.recovery_title')}
              onChange={n => onSetRecovery({ minutes: n ? (unit === 'hours' ? n * 60 : n) : null })}
            />
            <Select
              value={unit}
              onChange={next => {
                setUnit(next);
                if (postIctal.recoveryMinutes != null) onSetRecovery({ minutes: next === 'hours' ? Math.max(1, Math.round(postIctal.recoveryMinutes / 60)) * 60 : postIctal.recoveryMinutes });
              }}
              aria-label={t('settings.recording.cluster_window_unit')}
              options={[
                { value: 'minutes', label: t('settings.recording.unit_minutes') },
                { value: 'hours', label: t('settings.recording.unit_hours') },
              ]}
            />
          </span>
        )}
        <Checkbox
          checked={postIctal.recoveryOngoing}
          onChange={checked => onSetRecovery({ ongoing: checked, minutes: checked ? null : postIctal.recoveryMinutes })}
          label={t('post_ictal.recovery_ongoing')}
        />
      </div>
    </div>
  );
}
