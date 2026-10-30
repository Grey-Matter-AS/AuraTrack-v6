import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EMERGENCY_PLAN_DEFAULTS, EMERGENCY_PLAN_LIMITS, emergencyPlan } from '../../utils/dangerFlags';
import { Button, NumberInput, Select } from '../ui';
import { Row, Section } from './atoms';

// ─── Emergency plan: alert time and cluster rule ──────────────
// Defaults are always set (5 minutes; 3 seizures within 8 minutes); the user can match their own
// care plan. Values are clamped by emergencyPlan(), the same function every screen and report uses.
export function EmergencyPlanSection({ settings, onUpdate }) {
  const { t } = useTranslation();
  const plan = emergencyPlan(settings);
  const [windowUnit, setWindowUnit] = useState(() => (plan.clusterWindowMinutes >= 60 && plan.clusterWindowMinutes % 60 === 0 ? 'hours' : 'minutes'));
  const windowValue = windowUnit === 'hours' ? plan.clusterWindowMinutes / 60 : plan.clusterWindowMinutes;
  const isDefault = Object.entries(EMERGENCY_PLAN_DEFAULTS).every(([key, value]) => (settings[key] ?? value) === value);
  const save = (key, value) => onUpdate(key, emergencyPlan({ ...settings, [key]: value })[PLAN_FIELD[key]]);
  const changeUnit = (unit) => {
    setWindowUnit(unit);
    if (unit === 'hours') save('clusterWindowMinutes', Math.max(1, Math.round(plan.clusterWindowMinutes / 60)) * 60);
  };
  const reset = () => Object.entries(EMERGENCY_PLAN_DEFAULTS).forEach(([key, value]) => onUpdate(key, value));

  return (
    <Section title={t('settings.recording.emergency_plan')}>
      <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>{t('settings.recording.emergency_plan_help')}</p>
      <Row label={t('settings.recording.alert_after')} help={t('settings.recording.alert_after_help')}>
        <span className="ui-inline">
          <NumberInput compact value={plan.alertMinutes} max={EMERGENCY_PLAN_LIMITS.emergencyAlertMinutes[1]} maxLength={2}
            aria-label={t('settings.recording.alert_after')} onChange={n => save('emergencyAlertMinutes', n)} />
          <span className="text-xs font-bold" style={{ color: 'var(--text-dim)' }}>{t('settings.recording.unit_minutes')}</span>
        </span>
      </Row>
      <div>
        <p className="text-sm font-bold text-[var(--text-primary)]">{t('settings.recording.cluster_rule')}</p>
        <p className="text-[11px] text-[var(--text-dim)] mt-0.5 mb-2">{t('settings.recording.cluster_rule_help')}</p>
        <span className="ui-inline">
          <NumberInput compact value={plan.clusterMinCount} max={EMERGENCY_PLAN_LIMITS.clusterMinCount[1]} maxLength={2}
            aria-label={t('settings.recording.cluster_count')} onChange={n => save('clusterMinCount', n)} />
          <span className="text-xs font-bold" style={{ color: 'var(--text-dim)' }}>{t('settings.recording.seizures_within')}</span>
          <NumberInput compact value={windowValue} max={windowUnit === 'hours' ? 168 : EMERGENCY_PLAN_LIMITS.clusterWindowMinutes[1]} maxLength={windowUnit === 'hours' ? 3 : 5}
            aria-label={t('settings.recording.cluster_window')} onChange={n => save('clusterWindowMinutes', windowUnit === 'hours' ? n * 60 : n)} />
          <Select
            value={windowUnit}
            onChange={changeUnit}
            aria-label={t('settings.recording.cluster_window_unit')}
            options={[
              { value: 'minutes', label: t('settings.recording.unit_minutes') },
              { value: 'hours', label: t('settings.recording.unit_hours') },
            ]}
          />
        </span>
      </div>
      {!isDefault && (
        <div>
          <Button variant="secondary" size="sm" onClick={reset}>{t('settings.recording.reset_default')}</Button>
        </div>
      )}
    </Section>
  );
}

const PLAN_FIELD = { emergencyAlertMinutes: 'alertMinutes', clusterMinCount: 'clusterMinCount', clusterWindowMinutes: 'clusterWindowMinutes' };

