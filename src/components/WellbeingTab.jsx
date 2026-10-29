import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatEventDate, formatEventTime } from '../utils/formatters';
import { WellbeingEntrySheet } from './WellbeingEntrySheet';
import { EditIcon, TrashIcon } from './AppIcons';
import { Card, ChipGroup, DateInput, EmptyState, Select } from './ui';

const WINDOWS = [
  { label: '7D', days: 7 },
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
];

function valueOfFactor(factor) {
  if (factor && typeof factor === 'object' && 'value' in factor) return factor.value;
  return factor;
}

function factorLabel(factor, t, fallback = '') {
  return factor?.labelKey ? t(factor.labelKey, factor.label || fallback) : (factor?.label || fallback);
}

function factorDisplay(factor, t) {
  const value = valueOfFactor(factor);
  if (factor?.type === 'boolean') return value ? t('wellbeing.yes', 'Yes') : t('wellbeing.no', 'No');
  if (factor?.type === 'scale') {
    const labels = Array.isArray(factor.scaleLabelKeys) && factor.scaleLabelKeys.length === 4
      ? factor.scaleLabelKeys.map((key, index) => t(key, factor.scaleLabels?.[index] || ''))
      : Array.isArray(factor.scaleLabels) && factor.scaleLabels.length === 4
        ? factor.scaleLabels
        : [t('wellbeing.none', 'None'), t('wellbeing.mild', 'Mild'), t('wellbeing.moderate', 'Moderate'), t('wellbeing.severe', 'Severe')];
    return labels[Number(value) || 0] || String(value);
  }
  return `${value}${factor?.unit ? ` ${factor.unit}` : ''}`;
}

function buildChartData(events, entries, factorDefinitions, days, locale) {
  const now = Date.now();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (days - 1 - index));
    date.setHours(0, 0, 0, 0);
    const dayStart = date.getTime();
    const dayEnd = dayStart + 864e5;
    const dayEntries = entries.filter(entry => entry.recordedAt >= dayStart && entry.recordedAt < dayEnd);
    const row = {
      label: date.toLocaleDateString(locale, { day: '2-digit', month: 'short' }),
      seizures: events.filter(event => event.startTime >= dayStart && event.startTime < dayEnd).length,
      moodIntensity: dayEntries.length
        ? Number((dayEntries.reduce((sum, entry) => sum + Number(entry.intensity || 0), 0) / dayEntries.length).toFixed(2))
        : null,
    };
    factorDefinitions.forEach((definition) => {
      const values = dayEntries
        .map(entry => valueOfFactor(entry.factors?.[definition.id]))
        .filter(value => value !== undefined && value !== null && value !== false && value !== '');
      if (!values.length) {
        row[definition.id] = null;
        return;
      }
      if (definition.type === 'boolean') {
        row[definition.id] = values.some(Boolean) ? 1 : 0;
        return;
      }
      const numeric = values.map(Number).filter(Number.isFinite);
      row[definition.id] = numeric.length
        ? Number((numeric.reduce((sum, value) => sum + value, 0) / numeric.length).toFixed(2))
        : null;
    });
    return row;
  });
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 11 }}>
      <p style={{ color: 'var(--text-dim)', marginBottom: 2 }}>{label}</p>
      {payload.map(item => (
        <p key={item.dataKey} style={{ color: item.color, fontWeight: 900 }}>
          {item.name}: {item.value ?? '-'}
        </p>
      ))}
    </div>
  );
}

function WellbeingChart({ events, entries, factorDefinitions, t }) {
  const { i18n } = useTranslation();
  const [windowIndex, setWindowIndex] = useState(2);
  const [selectedFactors, setSelectedFactors] = useState(() => factorDefinitions.slice(0, 2).map(factor => factor.id));
  const { days } = WINDOWS[windowIndex];
  const knownFactorIds = new Set(factorDefinitions.map(factor => factor.id));
  const validSelectedFactors = selectedFactors.filter(id => knownFactorIds.has(id));
  const effectiveSelectedFactors = validSelectedFactors.length
    ? validSelectedFactors
    : factorDefinitions.slice(0, 2).map(factor => factor.id);
  const data = useMemo(
    () => buildChartData(events, entries, factorDefinitions, days, i18n.resolvedLanguage || i18n.language || undefined),
    [events, entries, factorDefinitions, days, i18n.resolvedLanguage, i18n.language]
  );

  const activeFactors = factorDefinitions.filter(factor => effectiveSelectedFactors.includes(factor.id));

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>{t('wellbeing.chart_title', 'Correlation overview')}</p>
        <ChipGroup
          label={t('wellbeing.chart_title', 'Correlation overview')}
          value={windowIndex}
          onChange={setWindowIndex}
          options={WINDOWS.map((option, index) => ({ value: index, label: option.label }))}
        />
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 8, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false} interval={data.length > 20 ? Math.floor(data.length / 6) : 0} />
          <YAxis allowDecimals tick={{ fontSize: 8, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false} width={24} />
          <Tooltip content={<ChartTooltip />} />
          <Line name={t('wellbeing.mood_intensity', 'Mood intensity')} type="monotone" dataKey="moodIntensity" stroke="#38bdf8" strokeWidth={2} dot={false} connectNulls />
          {activeFactors.map((factor, index) => (
            <Line
              key={factor.id}
              name={factorLabel(factor, t, factor.id)}
              type="monotone"
              dataKey={factor.id}
              stroke={['#f59e0b', '#22c55e', '#a78bfa'][index % 3]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <ResponsiveContainer width="100%" height={72}>
        <BarChart data={data} margin={{ top: 2, right: 4, left: -22, bottom: 0 }}>
          <XAxis dataKey="label" hide />
          <YAxis allowDecimals={false} tick={{ fontSize: 8, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false} width={24} />
          <Tooltip content={<ChartTooltip />} />
          <Bar name={t('wellbeing.seizures', 'Seizures')} dataKey="seizures" fill="var(--accent)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="ui-chip-group">
        {factorDefinitions.slice(0, 8).map(factor => {
          const active = effectiveSelectedFactors.includes(factor.id);
          return (
            <button
              key={factor.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedFactors(prev => active ? prev.filter(id => id !== factor.id) : [...prev, factor.id].slice(-3))}
              className="ui-chip"
              title={factor.helpKey ? t(factor.helpKey, factor.help || factorLabel(factor, t, factor.id)) : (factor.help || factorLabel(factor, t, factor.id))}
            >
              {factorLabel(factor, t, factor.id)}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] leading-snug" style={{ color: 'var(--text-faint)' }}>
        {t('wellbeing.chart_help', 'This view helps spot patterns. It does not prove that any factor caused a seizure.')}
      </p>
    </Card>
  );
}

export function WellbeingTab({ events = [], wellbeing, settings = {} }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [factorFilter, setFactorFilter] = useState('');
  const { entries = [], factorDefinitions = [] } = wellbeing || {};
  const { dateFormat = 'locale', timeFormat = '12h' } = settings;
  const activeFactorDefinitions = useMemo(
    () => factorDefinitions.filter(factor => factor.active !== false),
    [factorDefinitions]
  );

  const filtered = entries.filter(entry => {
    if (fromDate && entry.recordedAt < new Date(fromDate).setHours(0, 0, 0, 0)) return false;
    if (toDate && entry.recordedAt > new Date(toDate).setHours(23, 59, 59, 999)) return false;
    if (factorFilter && !entry.factors?.[factorFilter]) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <WellbeingChart events={events} entries={entries} factorDefinitions={activeFactorDefinitions} t={t} />

      <div className="flex flex-col gap-2">
        <button
          onClick={() => setEditing({})}
          className="ui-btn ui-btn--primary ui-btn--md ui-btn--full"
        >
          {t('wellbeing.log_wellbeing', 'Log wellbeing')}
        </button>
        <div className="ui-row">
          <DateInput
            value={fromDate}
            max={toDate || undefined}
            onChange={setFromDate}
            aria-label={t('history.from_date', 'From')}
            placeholder={t('history.from_date_hint', 'From date')}
          />
          <DateInput
            value={toDate}
            min={fromDate || undefined}
            onChange={setToDate}
            aria-label={t('history.to_date', 'To')}
            placeholder={t('history.to_date_hint', 'To date')}
          />
        </div>
        <Select
          aria-label={t('wellbeing.all_context_factors', 'All context factors')}
          placeholder={t('wellbeing.all_context_factors', 'All context factors')}
          value={factorFilter}
          onChange={setFactorFilter}
          options={factorDefinitions.map(factor => ({ value: factor.id, label: factorLabel(factor, t, factor.id) }))}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState>{t('wellbeing.no_entries', 'No wellbeing entries found.')}</EmptyState>
      ) : (
        filtered.map(entry => (
          <Card key={entry.id} className="space-y-3">
            <div className="flex flex-wrap justify-between gap-3">
              <div className="min-w-0 flex-1 basis-40">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black" style={{ color: 'var(--text-primary)' }}>{entry.primaryMood}</p>
                  <span className="app-status-badge app-status-badge--neutral">
                    {['', t('wellbeing.mild', 'mild'), t('wellbeing.moderate', 'moderate'), t('wellbeing.strong', 'strong')][entry.intensity] || entry.intensity}
                  </span>
                  {entry.isEdited && (
                    <span className="app-status-badge app-status-badge--info">{t('wellbeing.edited', 'Edited')}</span>
                  )}
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
                  {formatEventDate(entry.recordedAt, dateFormat)} • {formatEventTime(entry.recordedAt, timeFormat)}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setEditing(entry)}
                  className="ui-icon-btn ui-icon-btn--accent"
                  aria-label={t('wellbeing.edit_entry_label', 'Edit wellbeing entry')}
                >
                  <EditIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => wellbeing.deleteEntry(entry.id)}
                  className="ui-icon-btn ui-icon-btn--danger"
                  aria-label={t('wellbeing.delete_entry_label', 'Delete wellbeing entry')}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            {Object.keys(entry.factors || {}).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(entry.factors).map(([id, factor]) => (
                  <span key={id} className="app-status-badge app-status-badge--neutral">
                    {factorLabel(factor, t, id)}: {factorDisplay(factor, t)}
                  </span>
                ))}
              </div>
            )}
            {entry.notes && <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>{entry.notes}</p>}
          </Card>
        ))
      )}

      {editing && (
        <WellbeingEntrySheet
          entry={editing.id ? editing : null}
          factorDefinitions={factorDefinitions}
          onSave={wellbeing.saveEntry}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
