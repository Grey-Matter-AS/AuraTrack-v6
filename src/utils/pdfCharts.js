// Pure SVG chart generators for the neurologist PDF report.
// Each function returns an SVG string — no React, no recharts needed.

import { esc } from './htmlEscape';
import { phaseDurs } from './phaseCalculations';
import { emergencyPlan, isLongSeizure } from './dangerFlags';
import { formatDuration } from './formatters';
import i18n from '../i18n';

const SVG_FONT_ATTR = `font-family="Helvetica Neue, Arial, sans-serif"`;
const MAX_VALUE_LABELS = 5;

const NO_DATA = (title) => `<svg viewBox="0 0 520 140" xmlns="http://www.w3.org/2000/svg" ${SVG_FONT_ATTR}>
  <rect width="520" height="140" fill="#f9fafb" rx="6"/>
  <text x="260" y="58" text-anchor="middle" font-size="10" font-weight="bold" fill="#374151">${esc(title)}</text>
  <text x="260" y="76" text-anchor="middle" font-size="9" fill="#9ca3af">${esc(i18n.t('export.docs.no_data_available'))}</text>
</svg>`;

function formatNumberLabel(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

const formatDurationLabel = (seconds) => formatDuration(seconds, { compact: true });

function svgValueLabel(x, y, text, { anchor = 'middle', fill = '#111827', bg = true } = {}) {
  if (!text) return '';
  const width = Math.max(14, text.length * 4.7 + 6);
  const rectX = anchor === 'start' ? x - 2 : anchor === 'end' ? x - width + 2 : x - width / 2;
  const textX = anchor === 'start' ? x + 1 : anchor === 'end' ? x - 1 : x;
  const back = bg
    ? `<rect x="${rectX.toFixed(1)}" y="${(y - 8).toFixed(1)}" width="${width.toFixed(1)}" height="10" fill="white" opacity="0.86" rx="2"/>`
    : '';
  return `${back}<text x="${textX.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" font-size="7" font-weight="700" fill="${fill}">${esc(text)}</text>`;
}

function selectBarLabelIndexes(values, limit = MAX_VALUE_LABELS, sparseLimit = 8) {
  const nonzero = values
    .map((value, index) => ({ value: Number(value) || 0, index }))
    .filter(item => item.value > 0);
  if (nonzero.length <= sparseLimit) return new Set(nonzero.map(item => item.index));
  return new Set(
    nonzero
      .sort((a, b) => b.value - a.value || a.index - b.index)
      .slice(0, limit)
      .map(item => item.index)
  );
}

function selectLineLabelIndexes(values, { limit = MAX_VALUE_LABELS, threshold = null, includeLast = true } = {}) {
  const present = values
    .map((value, index) => ({ value: Number(value), index }))
    .filter(item => Number.isFinite(item.value));
  if (present.length <= limit) return new Set(present.map(item => item.index));
  const candidates = new Map();
  const add = (index, score) => {
    if (index == null || index < 0 || index >= values.length || !Number.isFinite(Number(values[index]))) return;
    candidates.set(index, Math.max(candidates.get(index) ?? -Infinity, score));
  };
  const maxItem = present.reduce((best, item) => (item.value > best.value ? item : best), present[0]);
  add(maxItem.index, 10000 + maxItem.value);
  present.forEach(item => {
    if (threshold != null && item.value >= threshold) add(item.index, 8000 + item.value);
    const prev = Number(values[item.index - 1]);
    const next = Number(values[item.index + 1]);
    const hasPrev = Number.isFinite(prev);
    const hasNext = Number.isFinite(next);
    if ((!hasPrev || item.value >= prev) && (!hasNext || item.value > next) && (hasPrev || hasNext)) {
      add(item.index, 5000 + item.value);
    }
  });
  if (includeLast) add(present[present.length - 1].index, 1000 + present[present.length - 1].value);
  present
    .sort((a, b) => b.value - a.value || a.index - b.index)
    .slice(0, limit)
    .forEach(item => add(item.index, 3000 + item.value));
  return new Set(
    [...candidates.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, limit)
      .map(([index]) => index)
  );
}

function selectMultiSeriesLabelKeys(renderedSeries, limit = MAX_VALUE_LABELS) {
  const allPoints = renderedSeries.flatMap((series, seriesIndex) =>
    series.points
      .filter(point => point && Number.isFinite(point.value))
      .map(point => ({ ...point, seriesIndex }))
  );
  if (allPoints.length <= limit) return new Set(allPoints.map(point => `${point.seriesIndex}|${point.index}`));
  const candidates = new Map();
  const add = (point, score) => {
    if (!point) return;
    const key = `${point.seriesIndex}|${point.index}`;
    candidates.set(key, Math.max(candidates.get(key) ?? -Infinity, score));
  };
  renderedSeries.forEach((series, seriesIndex) => {
    const points = series.points.filter(point => point && Number.isFinite(point.value));
    if (!points.length) return;
    const maxPoint = points.reduce((best, point) => (point.normalized > best.normalized ? point : best), points[0]);
    add({ ...maxPoint, seriesIndex }, 10000 + maxPoint.normalized);
    points.forEach(point => {
      const prev = series.points[point.index - 1];
      const next = series.points[point.index + 1];
      if ((!prev || point.normalized >= prev.normalized) && (!next || point.normalized > next.normalized) && (prev || next)) {
        add({ ...point, seriesIndex }, 7000 + point.normalized);
      }
    });
    add({ ...points[points.length - 1], seriesIndex }, 1000 + points[points.length - 1].normalized);
  });
  allPoints
    .sort((a, b) => b.normalized - a.normalized || a.index - b.index)
    .slice(0, limit)
    .forEach(point => add(point, 4000 + point.normalized));
  return new Set(
    [...candidates.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([key]) => key)
  );
}

// ── A. Seizure frequency bar chart (last N days) ─────────────
export function freqBarChartSVG(events, days = 30, endMs = Date.now(), plan = emergencyPlan()) {
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  if (!events.length) return NO_DATA(i18n.t('export.docs.chart_seizure_frequency', { count: days }));

  const W = 520, H = 150, ml = 35, mr = 15, mt = 18, mb = 30;
  const cw = W - ml - mr, ch = H - mt - mb;
  const now = endMs;

  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(now - (days - 1 - i) * 86400000);
    d.setHours(0, 0, 0, 0);
    return { label: d.toLocaleDateString(locale, { month: 'short', day: 'numeric' }), start: d.getTime(), end: d.getTime() + 86399999, count: 0, hasLong: false };
  });

  events.forEach(e => {
    const t = e.startTime || 0;
    for (const b of buckets) {
      if (t >= b.start && t <= b.end) { b.count++; if (isLongSeizure(e, plan)) b.hasLong = true; break; }
    }
  });

  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const bw = cw / days;
  const showEvery = Math.ceil(days / 8);
  const barLabelIndexes = selectBarLabelIndexes(buckets.map(b => b.count));

  const bars = buckets.map((b, i) => {
    const bh = (b.count / maxCount) * ch;
    const x = ml + i * bw + 0.5;
    const y = mt + ch - bh;
    const fill = b.count === 0 ? '#e5e7eb' : (b.hasLong ? '#dc2626' : '#1e3a5f');
    const barWidth = Math.max(bw - 1, 1);
    const labelInside = bh >= 14 && barWidth >= 8;
    const label = barLabelIndexes.has(i)
      ? svgValueLabel(
          x + barWidth / 2,
          labelInside ? y + 9 : Math.max(mt + 8, y - 3),
          formatNumberLabel(b.count),
          { fill: labelInside ? '#fff' : '#111827', bg: !labelInside }
        )
      : '';
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(bh, 0.5).toFixed(1)}" fill="${fill}"/>${label}`;
  }).join('');

  const xLbls = buckets.map((b, i) => i % showEvery === 0
    ? `<text x="${(ml + i * bw + bw / 2).toFixed(1)}" y="${H - 5}" text-anchor="middle" font-size="7" fill="#9ca3af">${esc(b.label)}</text>`
    : '').join('');

  const yLines = [0, Math.ceil(maxCount / 2), maxCount].map(v => {
    const y = (mt + ch - (v / maxCount) * ch).toFixed(1);
    return `<line x1="${ml}" y1="${y}" x2="${ml + cw}" y2="${y}" stroke="#e5e7eb" stroke-width="0.5"/>` +
           `<text x="${ml - 3}" y="${(+y + 3).toFixed(1)}" text-anchor="end" font-size="7" fill="#9ca3af">${v}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" ${SVG_FONT_ATTR}>
  <rect width="${W}" height="${H}" fill="white"/>
  <text x="${W / 2}" y="11" text-anchor="middle" font-size="9" font-weight="bold" fill="#374151">${esc(i18n.t('export.docs.chart_seizure_frequency', { count: days }))}</text>
  ${yLines}${bars}${xLbls}
  <line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt + ch}" stroke="#d1d5db" stroke-width="1"/>
  <line x1="${ml}" y1="${mt + ch}" x2="${ml + cw}" y2="${mt + ch}" stroke="#d1d5db" stroke-width="1"/>
  <rect x="${W - 90}" y="${H - 18}" width="8" height="8" fill="#1e3a5f"/>
  <text x="${W - 79}" y="${H - 11}" font-size="7" fill="#6b7280">${esc(i18n.t('export.docs.normal'))}</text>
  <rect x="${W - 40}" y="${H - 18}" width="8" height="8" fill="#dc2626"/>
  <text x="${W - 29}" y="${H - 11}" font-size="7" fill="#6b7280">&#8805;${plan.alertMinutes} min</text>
</svg>`;
}

// ── B. Duration trend line chart ──────────────────────────────
export function durationLineSVG(events, days = events.length, plan = emergencyPlan()) {
  if (!events.length) return NO_DATA(i18n.t('export.docs.chart_duration_trend', { count: days }));

  const W = 520, H = 150, ml = 45, mr = 15, mt = 18, mb = 28;
  const cw = W - ml - mr, ch = H - mt - mb;
  const sorted = [...events].sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
  const maxDur = Math.max(...sorted.map(e => e.duration || 0), 60);
  const n = sorted.length;

  const px = i => (ml + (n > 1 ? i / (n - 1) : 0.5) * cw).toFixed(1);
  const py = d => (mt + ch - Math.min(d / maxDur, 1) * ch).toFixed(1);

  const pts = sorted.map((e, i) => `${px(i)},${py(e.duration || 0)}`).join(' ');
  const labelIndexes = selectLineLabelIndexes(sorted.map(e => e.duration || 0), { threshold: plan.alertSec });

  const dots = sorted.map((e, i) => {
    const isLong = isLongSeizure(e, plan);
    return `<circle cx="${px(i)}" cy="${py(e.duration || 0)}" r="${isLong ? 4 : 3}" fill="${isLong ? '#dc2626' : '#1e3a5f'}"/>`;
  }).join('');

  const pointLabels = sorted.map((e, i) => {
    if (!labelIndexes.has(i)) return '';
    const x = Number(px(i));
    const y = Number(py(e.duration || 0));
    const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
    return svgValueLabel(x, Math.max(mt + 8, y - 6), formatDurationLabel(e.duration || 0), {
      anchor,
      fill: isLongSeizure(e, plan) ? '#dc2626' : '#111827',
    });
  }).join('');

  const ty = +py(plan.alertSec);
  const thresh = ty > mt && ty < mt + ch
    ? `<line x1="${ml}" y1="${ty.toFixed(1)}" x2="${ml + cw}" y2="${ty.toFixed(1)}" stroke="#dc2626" stroke-width="0.8" stroke-dasharray="4 3"/>` +
      `<text x="${ml + 3}" y="${(ty - 3).toFixed(1)}" font-size="7" fill="#dc2626">${plan.alertMinutes} min</text>`
    : '';

  const yTicks = [0, Math.round(maxDur * 0.5), maxDur].map(v => {
    const y = py(v);
    return `<line x1="${ml}" y1="${y}" x2="${ml + cw}" y2="${y}" stroke="#e5e7eb" stroke-width="0.5"/>` +
           `<text x="${ml - 3}" y="${(+y + 3).toFixed(1)}" text-anchor="end" font-size="7" fill="#9ca3af">${v}s</text>`;
  }).join('');

  const step = Math.max(1, Math.ceil(n / 6));
  const xLbls = sorted.map((e, i) => {
    if (i % step !== 0 && i !== n - 1) return '';
    const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
    return `<text x="${px(i)}" y="${H - 5}" text-anchor="${anchor}" font-size="7" fill="#9ca3af">${esc(e.date || '')}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" ${SVG_FONT_ATTR}>
  <rect width="${W}" height="${H}" fill="white"/>
  <text x="${W / 2}" y="11" text-anchor="middle" font-size="9" font-weight="bold" fill="#374151">${esc(i18n.t('export.docs.chart_duration_trend', { count: days }))}</text>
  ${yTicks}${thresh}
  <polyline points="${pts}" fill="none" stroke="#1e3a5f" stroke-width="1.5" stroke-linejoin="round"/>
  ${dots}${pointLabels}${xLbls}
  <line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt + ch}" stroke="#d1d5db" stroke-width="1"/>
  <line x1="${ml}" y1="${mt + ch}" x2="${ml + cw}" y2="${mt + ch}" stroke="#d1d5db" stroke-width="1"/>
</svg>`;
}

// ── C. Seizure type distribution (horizontal bars) ────────────
export function typeBarSVG(byType, total) {
  const entries = Object.entries(byType).sort(([, a], [, b]) => b - a);
  if (!entries.length) return NO_DATA(i18n.t('export.docs.chart_type_distribution'));

  const W = 520, rowH = 26, lblW = 160, barMax = 260, padT = 22, padB = 10;
  const H = padT + entries.length * rowH + padB;

  const rows = entries.map(([type, count], i) => {
    const pct = total ? count / total : 0;
    const bw = Math.max(pct * barMax, 2).toFixed(1);
    const y = padT + i * rowH;
    return `<text x="${lblW - 6}" y="${y + 17}" text-anchor="end" font-size="9" fill="#374151">${esc(type)}</text>` +
           `<rect x="${lblW}" y="${y + 5}" width="${bw}" height="${rowH - 10}" fill="#1e293b" rx="2"/>` +
           `<text x="${(lblW + +bw + 5).toFixed(1)}" y="${y + 17}" font-size="9" fill="#6b7280">${count} (${Math.round(pct * 100)}%)</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" ${SVG_FONT_ATTR}>
  <rect width="${W}" height="${H}" fill="white"/>
  <text x="${W / 2}" y="14" text-anchor="middle" font-size="9" font-weight="bold" fill="#374151">${esc(i18n.t('export.docs.chart_type_distribution'))}</text>
  ${rows}
</svg>`;
}

// ── D. Phase breakdown stacked bar (last N events) ────────────
export function phaseStackSVG(events, last = 10) {
  const slice = [...events].sort((a, b) => (a.startTime || 0) - (b.startTime || 0)).slice(-last);
  if (!slice.length) return NO_DATA(i18n.t('export.docs.chart_phase_breakdown', { count: last }));

  const W = 520, H = 175, ml = 42, mr = 15, mt = 18, mb = 45;
  const cw = W - ml - mr, ch = H - mt - mb;

  const allMax = slice.map(e => { const d = phaseDurs(e); return Math.max(d.aura + d.seizure + d.recovery, e.duration || 0); });
  const maxTotal = Math.max(...allMax, 1);
  const bw = cw / slice.length;
  const toH = v => (v / maxTotal) * ch;
  const phaseSegmentLabelKeys = new Set(
    slice.flatMap((e, eventIndex) => {
      const d = phaseDurs(e);
      const total = d.aura + d.seizure + d.recovery;
      const segments = [
        { key: `${eventIndex}|recovery`, value: d.recovery },
        { key: `${eventIndex}|seizure`, value: d.seizure },
        { key: `${eventIndex}|aura`, value: d.aura },
      ];
      if (total === 0 && (e.duration || 0) > 0) segments.push({ key: `${eventIndex}|total`, value: e.duration || 0 });
      return segments;
    })
      .filter(segment => segment.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, MAX_VALUE_LABELS)
      .map(segment => segment.key)
  );

  const bars = slice.map((e, i) => {
    const d = phaseDurs(e);
    const x = ml + i * bw;
    let yBot = mt + ch;
    let segs = '';
    const addSegment = (key, value, fill) => {
      if (value <= 0) return;
      const h = toH(value);
      yBot -= h;
      const rectX = x + 1.5;
      const rectW = bw - 3;
      const label = phaseSegmentLabelKeys.has(`${i}|${key}`) && h >= 13 && rectW >= 18
        ? svgValueLabel(rectX + rectW / 2, yBot + h / 2 + 2.5, formatDurationLabel(value), { fill: '#fff', bg: false })
        : '';
      segs += `<rect x="${rectX.toFixed(1)}" y="${yBot.toFixed(1)}" width="${rectW.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" rx="1"/>${label}`;
    };

    addSegment('recovery', d.recovery, '#3b82f6');
    addSegment('seizure', d.seizure, '#dc2626');
    addSegment('aura', d.aura, '#d97706');

    // Fallback: show total as grey if no phase data
    if (d.aura + d.seizure + d.recovery === 0 && (e.duration || 0) > 0) {
      const h = toH(e.duration || 0);
      const rectX = x + 1.5;
      const rectW = bw - 3;
      const rectY = mt + ch - h;
      const label = phaseSegmentLabelKeys.has(`${i}|total`) && h >= 13 && rectW >= 18
        ? svgValueLabel(rectX + rectW / 2, rectY + h / 2 + 2.5, formatDurationLabel(e.duration || 0), { fill: '#fff', bg: false })
        : '';
      segs += `<rect x="${rectX.toFixed(1)}" y="${rectY.toFixed(1)}" width="${rectW.toFixed(1)}" height="${h.toFixed(1)}" fill="#94a3b8" rx="1"/>${label}`;
    }

    const lbl = (e.date || '').split('/').slice(0, 2).join('/');
    segs += `<text x="${(x + bw / 2).toFixed(1)}" y="${mt + ch + 12}" text-anchor="middle" font-size="7" fill="#9ca3af">${esc(lbl)}</text>`;
    return segs;
  }).join('');

  const yTicks = [0, Math.round(maxTotal / 2), maxTotal].map(v => {
    const y = (mt + ch - (v / maxTotal) * ch).toFixed(1);
    return `<line x1="${ml}" y1="${y}" x2="${ml + cw}" y2="${y}" stroke="#e5e7eb" stroke-width="0.5"/>` +
           `<text x="${ml - 3}" y="${(+y + 3).toFixed(1)}" text-anchor="end" font-size="7" fill="#9ca3af">${v}s</text>`;
  }).join('');

  const ly = mt + ch + 28, cx = W / 2;
  const legend =
    `<rect x="${cx - 120}" y="${ly}" width="9" height="9" fill="#d97706" rx="1"/><text x="${cx - 108}" y="${ly + 8}" font-size="8" fill="#374151">Aura</text>` +
    `<rect x="${cx - 75}" y="${ly}" width="9" height="9" fill="#dc2626" rx="1"/><text x="${cx - 63}" y="${ly + 8}" font-size="8" fill="#374151">Seizure</text>` +
    `<rect x="${cx - 20}" y="${ly}" width="9" height="9" fill="#3b82f6" rx="1"/><text x="${cx - 8}" y="${ly + 8}" font-size="8" fill="#374151">Recovery</text>` +
    `<rect x="${cx + 50}" y="${ly}" width="9" height="9" fill="#94a3b8" rx="1"/><text x="${cx + 62}" y="${ly + 8}" font-size="8" fill="#374151">${esc(i18n.t('export.docs.no_phase_data'))}</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" ${SVG_FONT_ATTR}>
  <rect width="${W}" height="${H}" fill="white"/>
  <text x="${W / 2}" y="11" text-anchor="middle" font-size="9" font-weight="bold" fill="#374151">${esc(i18n.t('export.docs.chart_phase_breakdown', { count: slice.length }))}</text>
  ${yTicks}${bars}${legend}
  <line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt + ch}" stroke="#d1d5db" stroke-width="1"/>
  <line x1="${ml}" y1="${mt + ch}" x2="${ml + cw}" y2="${mt + ch}" stroke="#d1d5db" stroke-width="1"/>
</svg>`;
}

function chartFactorValue(factor) {
  if (factor && typeof factor === 'object' && 'value' in factor) return factor.value;
  return factor;
}

function chartFactorLabel(factor, fallback) {
  return factor?.labelKey ? i18n.t(factor.labelKey, factor.label || fallback) : (factor?.label || fallback);
}

function chartFactorHasSignal(factor) {
  const value = chartFactorValue(factor);
  if (factor?.type === 'boolean') return value === true;
  if (factor?.type === 'scale') return Number(value) > 0 || factor.saveZero === true;
  if (factor?.type === 'number') return Number.isFinite(Number(value)) && Number(value) > 0;
  return value !== undefined && value !== null && value !== '' && value !== false;
}

function chartFactorNumericValue(factor) {
  const value = Number(chartFactorValue(factor));
  if (!Number.isFinite(value)) return null;
  if (factor?.type === 'scale' || factor?.type === 'number') return value;
  return null;
}

function normalizeSeriesValue(value, min, max) {
  if (!Number.isFinite(value)) return null;
  if (max <= min) return 0.5;
  return (value - min) / (max - min);
}

// ── E. Wellbeing correlation overview ────────────────────────
export function wellbeingCorrelationSVG(events = [], wellbeingEntries = [], days = 30, endMs = Date.now()) {
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const title = i18n.t('export.docs.chart_wellbeing_correlation', { count: days });
  if (!wellbeingEntries.length) return NO_DATA(title);

  const W = 520, H = 235, ml = 42, mr = 18, mt = 40, mb = 58;
  const cw = W - ml - mr, ch = H - mt - mb;
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(endMs - (days - 1 - i) * 86400000);
    d.setHours(0, 0, 0, 0);
    return {
      label: d.toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
      start: d.getTime(),
      end: d.getTime() + 86399999,
      seizures: 0,
      moodValues: [],
      factorValues: {},
    };
  });

  events.forEach(event => {
    const t = event.startTime || 0;
    const bucket = buckets.find(day => t >= day.start && t <= day.end);
    if (bucket) bucket.seizures += 1;
  });

  const factorCounts = {};
  const factorMeta = {};
  wellbeingEntries.forEach(entry => {
    const t = entry.recordedAt || 0;
    const bucket = buckets.find(day => t >= day.start && t <= day.end);
    if (!bucket) return;
    const intensity = Number(entry.intensity);
    if (Number.isFinite(intensity)) bucket.moodValues.push(intensity);
    Object.entries(entry.factors || {}).forEach(([id, factor]) => {
      if (!chartFactorHasSignal(factor)) return;
      const numericValue = chartFactorNumericValue(factor);
      if (numericValue === null) return;
      const label = chartFactorLabel(factor, id);
      bucket.factorValues[label] = bucket.factorValues[label] || [];
      bucket.factorValues[label].push(numericValue);
      factorCounts[label] = (factorCounts[label] || 0) + 1;
      factorMeta[label] = factor;
    });
  });

  const colors = ['#0284c7', '#7c3aed', '#16a34a', '#f59e0b', '#be123c'];
  const series = [];
  const moodValues = buckets.map(day => {
    if (!day.moodValues.length) return null;
    return day.moodValues.reduce((sum, value) => sum + value, 0) / day.moodValues.length;
  });
  if (moodValues.some(value => value !== null)) {
    series.push({
      label: i18n.t('export.docs.mood_intensity', 'Mood intensity'),
      values: moodValues,
      color: colors[0],
    });
  }

  Object.entries(factorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .forEach(([label], index) => {
      series.push({
        label,
        values: buckets.map(day => {
          const values = day.factorValues[label] || [];
          return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
        }),
        color: colors[(index + 1) % colors.length],
        unit: factorMeta[label]?.unit || '',
      });
    });

  const maxSeizures = Math.max(1, ...buckets.map(day => day.seizures));
  const bw = cw / days;
  const showEvery = Math.ceil(days / 6);
  const px = i => ml + i * bw + bw / 2;
  const lineY = normalizedValue => mt + ch - Math.max(0, Math.min(1, normalizedValue)) * ch;
  const seizureLabelIndexes = selectBarLabelIndexes(buckets.map(day => day.seizures));

  const bars = buckets.map((day, i) => {
    const bh = (day.seizures / maxSeizures) * (ch * 0.62);
    const x = ml + i * bw + 0.8;
    const y = mt + ch - bh;
    const barWidth = Math.max(bw - 1.6, 1);
    const labelInside = bh >= 14 && barWidth >= 8;
    const label = seizureLabelIndexes.has(i)
      ? svgValueLabel(
          x + barWidth / 2,
          labelInside ? y + Math.min(12, Math.max(9, bh - 4)) : Math.max(mt + 8, y - 3),
          formatNumberLabel(day.seizures),
          { fill: labelInside ? '#fff' : '#111827', bg: !labelInside }
        )
      : '';
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(bh, day.seizures ? 1 : 0).toFixed(1)}" fill="${day.seizures ? '#dc2626' : '#eef2f7'}" rx="1"/>${label}`;
  }).join('');

  const renderedSeries = series.map(item => {
    const presentValues = item.values.filter(value => value !== null);
    if (!presentValues.length) return { ...item, points: [] };
    const min = Math.min(...presentValues);
    const max = Math.max(...presentValues);
    const points = item.values.map((value, index) => {
      const normalized = normalizeSeriesValue(value, min, max);
      return normalized === null ? null : {
        index,
        value,
        normalized,
        x: px(index),
        y: lineY(normalized),
        label: `${formatNumberLabel(value)}${item.unit ? ` ${item.unit}` : ''}`,
      };
    });
    return { ...item, points };
  });
  const lineLabelKeys = selectMultiSeriesLabelKeys(renderedSeries);

  const lineSeries = renderedSeries.map((item, seriesIndex) => {
    if (!item.points.length) return '';
    const polylines = [];
    let segment = [];
    item.points.forEach(point => {
      if (point) {
        segment.push(point);
        return;
      }
      if (segment.length > 1) polylines.push(segment);
      segment = [];
    });
    if (segment.length > 1) polylines.push(segment);
    const lines = polylines.map(segmentPoints =>
      `<polyline points="${segmentPoints.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')}" fill="none" stroke="${item.color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`
    ).join('');
    const dotsAndLabels = item.points.map(point => {
      if (!point) return '';
      const labelKey = `${seriesIndex}|${point.index}`;
      const label = lineLabelKeys.has(labelKey)
        ? svgValueLabel(point.x, Math.min(mt + ch - 4, point.y + 13), point.label, { fill: item.color })
        : '';
      return `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="2.4" fill="${item.color}" stroke="white" stroke-width="0.6"/>${label}`;
    }).join('');
    return `${lines}${dotsAndLabels}`;
  }).join('');

  const xLbls = buckets.map((day, i) => i % showEvery === 0
    ? `<text x="${px(i).toFixed(1)}" y="${H - 18}" text-anchor="end" font-size="7" fill="#9ca3af" transform="rotate(-28 ${px(i).toFixed(1)} ${H - 18})">${esc(day.label)}</text>`
    : '').join('');

  const yLines = [0, 0.5, 1].map(value => {
    const y = lineY(value).toFixed(1);
    const label = value === 0 ? i18n.t('export.docs.low', 'Low') : value === 1 ? i18n.t('export.docs.high', 'High') : i18n.t('export.docs.mid', 'Mid');
    return `<line x1="${ml}" y1="${y}" x2="${ml + cw}" y2="${y}" stroke="#e5e7eb" stroke-width="0.5"/>` +
      `<text x="${ml - 4}" y="${(+y + 3).toFixed(1)}" text-anchor="end" font-size="7" fill="#9ca3af">${esc(label)}</text>`;
  }).join('');

  const legendItems = [
    { label: i18n.t('export.docs.seizure_count', 'Seizures'), color: '#dc2626', kind: 'bar' },
    ...series,
  ];
  let legendX = ml;
  let legendY = 24;
  const legend = legendItems.map(item => {
    const label = item.label.length > 22 ? `${item.label.slice(0, 20)}...` : item.label;
    const itemWidth = 18 + label.length * 4.2;
    if (legendX + itemWidth > W - mr) {
      legendX = ml;
      legendY += 11;
    }
    const x = legendX;
    const y = legendY;
    legendX += itemWidth + 8;
    const marker = item.kind === 'bar'
      ? `<rect x="${x}" y="${y - 7}" width="8" height="8" fill="${item.color}" rx="1"/>`
      : `<line x1="${x}" y1="${y - 3}" x2="${x + 10}" y2="${y - 3}" stroke="${item.color}" stroke-width="2"/><circle cx="${x + 5}" cy="${y - 3}" r="2" fill="${item.color}"/>`;
    return `${marker}<text x="${x + 13}" y="${y}" font-size="7" fill="#6b7280">${esc(label)}</text>`;
  }).join('');

  const noLineSeries = series.length
    ? ''
    : `<text x="${W / 2}" y="${mt + ch / 2}" text-anchor="middle" font-size="8" fill="#9ca3af">${esc(i18n.t('export.docs.no_data_available'))}</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" ${SVG_FONT_ATTR}>
  <rect width="${W}" height="${H}" fill="white"/>
  <text x="${W / 2}" y="12" text-anchor="middle" font-size="9" font-weight="bold" fill="#374151">${esc(title)}</text>
  ${legend}
  ${yLines}${bars}${lineSeries}${noLineSeries}${xLbls}
  <line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt + ch}" stroke="#d1d5db" stroke-width="1"/>
  <line x1="${ml}" y1="${mt + ch}" x2="${ml + cw}" y2="${mt + ch}" stroke="#d1d5db" stroke-width="1"/>
  <text x="${ml + cw}" y="${mt + ch + 14}" text-anchor="end" font-size="7" fill="#9ca3af">${esc(i18n.t('export.docs.relative_daily_level', 'Relative daily level'))}</text>
</svg>`;
}
