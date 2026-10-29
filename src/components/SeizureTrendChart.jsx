import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, ChipGroup, IconButton } from './ui';
import { BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

const TIME_WINDOWS = [
  { label: '1D',  description: 'Last 24 Hours',  days: 1   },
  { label: '3D',  description: 'Last 3 Days',    days: 3   },
  { label: '7D',  description: 'Last 7 Days',    days: 7   },
  { label: '14D', description: 'Last 14 Days',   days: 14  },
  { label: '21D', description: 'Last 21 Days',   days: 21  },
  { label: '1M',  description: 'Last Month',     days: 30  },
  { label: '2M',  description: 'Last 2 Months',  days: 60  },
  { label: '3M',  description: 'Last 3 Months',  days: 90  },
  { label: '6M',  description: 'Last 6 Months',  days: 180 },
  { label: '9M',  description: 'Last 9 Months',  days: 270 },
  { label: '1Y',  description: 'Last Year',      days: 365 },
  { label: '2Y',  description: 'Last 2 Years',   days: 730 },
];

// All bucket comparisons use timestamps — avoids locale date-string mismatch
function buildBuckets(events, days) {
  const now = Date.now();
  const cutoff = now - days * 864e5;
  const filtered = events.filter(e => e.startTime >= cutoff);

  if (days <= 1) {
    // Hourly buckets
    return Array.from({ length: 24 }, (_, i) => {
      const h = new Date(now);
      h.setHours(h.getHours() - (23 - i), 0, 0, 0);
      const hEnd = new Date(h);
      hEnd.setHours(hEnd.getHours() + 1);
      return {
        label: `${h.getHours()}:00`,
        start: h.getTime(),
        end: hEnd.getTime(),
        count: filtered.filter(e => e.startTime >= h.getTime() && e.startTime < hEnd.getTime()).length,
      };
    });
  }

  if (days <= 90) {
    // Daily buckets — compare by midnight timestamps, not date strings
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (days - 1 - i));
      const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
      const dayEnd   = new Date(d); dayEnd.setHours(23, 59, 59, 999);
      return {
        label: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        start: dayStart.getTime(),
        end: dayEnd.getTime() + 1,
        count: filtered.filter(e => e.startTime >= dayStart.getTime() && e.startTime <= dayEnd.getTime()).length,
      };
    });
  }

  // Weekly buckets for > 90 days
  const weeks = Math.ceil(days / 7);
  return Array.from({ length: weeks }, (_, i) => {
    const wStart = new Date(now);
    wStart.setDate(wStart.getDate() - (weeks - 1 - i) * 7);
    wStart.setHours(0, 0, 0, 0);
    const wEnd = new Date(wStart.getTime() + 7 * 864e5);
    return {
      label: wStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      start: wStart.getTime(),
      end: wEnd.getTime(),
      count: filtered.filter(e => e.startTime >= wStart.getTime() && e.startTime < wEnd.getTime()).length,
    };
  });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 11 }}>
      <p style={{ color: 'var(--text-dim)', marginBottom: 2 }}>{label}</p>
      <p style={{ color: 'var(--text-primary)', fontWeight: 900 }}>
        {payload[0].value} event{payload[0].value !== 1 ? 's' : ''}
      </p>
    </div>
  );
};

export default function SeizureTrendChart({ allEvents, medicationChanges = [] }) {
  const { t } = useTranslation();
  const [windowIndex, setWindowIndex] = useState(5); // default: 1 Month
  const [chartType, setChartType] = useState('bar');

  const { description, days } = TIME_WINDOWS[windowIndex];
  const data  = useMemo(() => buildBuckets(allEvents, days), [allEvents, days]);
  const total = data.reduce((s, d) => s + d.count, 0);
  const tickInterval = data.length > 20 ? Math.floor(data.length / 6) : 0;
  // Buckets in which a medication change took effect — drawn as dashed markers
  const changeLabels = data
    .filter(bucket => medicationChanges.some(c => !c.isBaseline && c.effectiveAt >= bucket.start && c.effectiveAt < bucket.end))
    .map(bucket => bucket.label);
  const changeMarkers = changeLabels.map(label => (
    <ReferenceLine key={`med-change-${label}`} x={label} stroke="var(--status-late-text)" strokeDasharray="3 3" strokeWidth={1.5} />
  ));

  const canZoomIn  = windowIndex > 0;
  const canZoomOut = windowIndex < TIME_WINDOWS.length - 1;

  return (
    <Card className="mb-4 shrink-0">
      {/* Zoom control row */}
      <div className="flex items-center justify-between mb-3 gap-2">
        {/* Zoom out: more time, fewer bars */}
        <IconButton label="Zoom out" onClick={() => setWindowIndex(i => Math.min(i + 1, TIME_WINDOWS.length - 1))} disabled={!canZoomOut} className="text-lg font-black disabled:opacity-25">
          −
        </IconButton>

        {/* Current window info */}
        <div className="flex-1 min-w-0 text-center">
          <p className="text-xs font-black uppercase tracking-widest leading-tight" style={{ color: 'var(--text-primary)' }}>
            {description}
          </p>
          <p className="text-[9px] font-bold mt-0.5" style={{ color: 'var(--accent)' }}>
            {total} event{total !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Zoom in: less time, more detail */}
        <IconButton label="Zoom in" onClick={() => setWindowIndex(i => Math.max(i - 1, 0))} disabled={!canZoomIn} className="text-lg font-black disabled:opacity-25">
          +
        </IconButton>
      </div>

      {/* Chart type toggle */}
      <ChipGroup
        fill
        className="mb-3"
        label="Chart type"
        value={chartType}
        onChange={setChartType}
        options={['bar', 'line'].map(type => ({ value: type, label: type }))}
      />

      {/* Chart */}
      <ResponsiveContainer width="100%" height={120}>
        {chartType === 'bar' ? (
          <BarChart data={data} margin={{ top: 4, right: 2, left: -22, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 8, fill: 'var(--text-dim)' }}
              tickLine={false}
              axisLine={false}
              interval={tickInterval}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 8, fill: 'var(--text-dim)' }}
              tickLine={false}
              axisLine={false}
              width={22}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--border-subtle)' }} />
            {changeMarkers}
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.count > 0 ? 'var(--accent)' : 'var(--bg-raised)'} />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 4, right: 2, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 8, fill: 'var(--text-dim)' }}
              tickLine={false}
              axisLine={false}
              interval={tickInterval}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 8, fill: 'var(--text-dim)' }}
              tickLine={false}
              axisLine={false}
              width={22}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
            {changeMarkers}
            <Line
              type="monotone"
              dataKey="count"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'var(--accent)', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: 'var(--accent)' }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
      {changeLabels.length > 0 && (
        <p className="text-[9px] font-bold mt-1" style={{ color: 'var(--status-late-text)' }}>
          ┆ {t('medication_changes.chart_marker')}
        </p>
      )}

      {/* Zoom level indicator dots */}
      <div className="flex justify-center gap-1 mt-2">
        {TIME_WINDOWS.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all"
            style={{
              width: i === windowIndex ? 12 : 4,
              height: 4,
              backgroundColor: i === windowIndex ? 'var(--accent)' : 'var(--bg-raised)',
            }}
          />
        ))}
      </div>
    </Card>
  );
}
