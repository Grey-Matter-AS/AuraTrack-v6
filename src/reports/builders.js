import i18n from '../i18n';
import { phaseDurs } from '../utils/phaseCalculations';
import { esc } from '../utils/htmlEscape';
import { getScheduledDosesForDay, regimenAt, regimenSnapshot } from '../utils/medicationSchedule';
import { changeTypeLabel, describeChange, formLabel, regimenDoseSummary } from '../utils/medicationChanges';

const DAY_MS = 86400000;

export const DIARY_TYPE_COLORS = {
  'Tonic-Clonic': '#dc2626',
  'Focal Aware': '#f59e0b',
  'Focal Impaired': '#ef4444',
  'Absence': '#3b82f6',
  'Aura Only': '#a855f7',
  Uncategorized: '#6b7280',
};

export const DIARY_TYPE_ABBREV = {
  'Tonic-Clonic': 'TC',
  'Focal Aware': 'FA',
  'Focal Impaired': 'FI',
  Absence: 'Ab',
  'Aura Only': 'Au',
  Uncategorized: '?',
};

const FREQ_SHORT = {
  OD: 'Once daily',
  BD: 'Twice daily',
  TDS: 'Three times daily',
  QDS: 'Four times daily',
  PRN: 'As needed (rescue)',
};

// Change rows for reports. Baseline 'started' records (created when upgrading) are left out:
// their date is when tracking began, not a real clinical start.
export function buildMedicationChangeRows(changes = [], { fromMs = -Infinity, toMs = Infinity } = {}) {
  const locale = getCurrentLocale();
  const t = getTranslator();
  return changes
    .filter(change => !change.isBaseline && change.effectiveAt >= fromMs && change.effectiveAt <= toMs)
    .sort((a, b) => a.effectiveAt - b.effectiveAt)
    .map(change => {
      const regimen = change.to ?? change.from ?? {};
      const detail = [regimen.activeIngredient, formLabel(regimen.form, t)].filter(Boolean).join(', ');
      const at = new Date(change.effectiveAt);
      return {
        dateLabel: at.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }),
        timeLabel: at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
        medication: change.medicationName || regimen.name || '',
        medicationDetail: detail,
        type: change.type,
        typeLabel: changeTypeLabel(change.type, t),
        lines: describeChange(change, t),
        note: change.note || '',
      };
    });
}

const changeRowText = (row) =>
  `${row.dateLabel} ${row.timeLabel} · ${row.medication}: ${row.typeLabel}${row.lines.length ? ` — ${row.lines.join('; ')}` : ''}`;

export function getCurrentLocale() {
  return i18n.resolvedLanguage || i18n.language || 'en';
}

export function getTranslator() {
  return (key, options) => i18n.t(key, options);
}

export function formatDurationLabel(seconds) {
  if (!seconds || seconds <= 0) return '-';
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  const secs = whole % 60;
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
}

export function describeSymptomPath(symptom = {}) {
  const path = [symptom.symptom, symptom.detail].filter(Boolean).join(' > ');
  const location = [symptom.region, symptom.subRegion, symptom.specificPart]
    .filter(part => part && part !== 'N/A' && part !== 'Internal/General')
    .join(' > ');
  return {
    path,
    location,
    combined: location ? `${path} @ ${location}` : path,
  };
}

export function describePostIctal(postIctal = {}, t = getTranslator()) {
  const findings = Array.isArray(postIctal.findings) ? postIctal.findings : [];
  const paralysisLocations = Array.isArray(postIctal.paralysisLocations) ? postIctal.paralysisLocations : [];

  const paralysisSummary = paralysisLocations.map((location) =>
    [location.region, location.subRegion, location.specificPart].filter(Boolean).join(' > ')
  );

  const summaryParts = [
    findings.length ? `${t('export.docs.post_ictal_findings', 'After-seizure symptoms')}: ${findings.join(', ')}` : '',
    paralysisSummary.length ? `${t('export.docs.post_ictal_paralysis', 'After-seizure paralysis')}: ${paralysisSummary.join('; ')}` : '',
  ].filter(Boolean);

  return {
    findings,
    paralysisLocations,
    paralysisSummary,
    summary: summaryParts.join(' | '),
  };
}

function wellbeingIntensityLabel(value, t) {
  return ['', t('wellbeing.mild', 'Mild'), t('wellbeing.moderate', 'Moderate'), t('wellbeing.strong', 'Strong')][value] || String(value || '-');
}

function wellbeingFactorLabel(factor, fallback, t) {
  return factor?.labelKey ? t(factor.labelKey, factor.label || fallback) : (factor?.label || fallback);
}

function wellbeingFactorValue(factor, t) {
  const value = factor?.value;
  if (factor?.type === 'boolean') return value ? t('wellbeing.yes', 'Yes') : t('wellbeing.no', 'No');
  if (factor?.type === 'scale') {
    const labels = Array.isArray(factor.scaleLabelKeys) && factor.scaleLabelKeys.length === 4
      ? factor.scaleLabelKeys.map((key, index) => t(key, factor.scaleLabels?.[index] || ''))
      : Array.isArray(factor.scaleLabels) && factor.scaleLabels.length === 4
        ? factor.scaleLabels
        : [t('wellbeing.none', 'None'), t('wellbeing.mild', 'Mild'), t('wellbeing.moderate', 'Moderate'), t('wellbeing.severe', 'Severe')];
    return labels[Number(value) || 0] || String(value);
  }
  return `${value ?? ''}${factor?.unit ? ` ${factor.unit}` : ''}`.trim();
}

function factorHasSignal(factor) {
  const value = factor?.value;
  if (factor?.type === 'boolean') return value === true;
  if (factor?.type === 'scale') return Number(value) > 0 || factor.saveZero === true;
  if (factor?.type === 'number') return Number.isFinite(Number(value)) && Number(value) > 0;
  return value !== undefined && value !== null && value !== '' && value !== false;
}

export function buildEventLogData(events, medicationChanges = []) {
  const locale = getCurrentLocale();
  const t = getTranslator();
  const generatedDate = new Date().toLocaleDateString(locale);

  return {
    locale,
    generatedDate,
    medicationChanges: buildMedicationChangeRows(medicationChanges),
    events: events.map(event => ({
      postIctal: describePostIctal(event.postIctal, t),
      id: event.id,
      date: event.date || '',
      time: event.time || '',
      type: event.type || '',
      durationSec: event.duration || 0,
      durationLabel: `${event.duration || 0}s`,
      notesHtml: [
        event.notes || '',
        event.postIctal ? describePostIctal(event.postIctal, t).summary : '',
        event.videoFileName ? `${t('event_detail.associated_video', 'Associated video')}: ${event.videoFileName}` : '',
      ]
        .filter(Boolean)
        .map(line => esc(line))
        .join('<br>'),
      symptoms: (event.symptoms || []).map(describeSymptomPath),
    })),
  };
}

export function buildNeurologistReportData(events, settings = {}, medications = [], medicationLogs = [], reportRange = {}, wellbeingEntries = [], medicationChanges = []) {
  const locale = getCurrentLocale();
  const t = getTranslator();
  const now = Date.now();
  const selectedFromMs = reportRange.fromMs ?? (events.length ? Math.min(...events.map(event => event.startTime || now)) : now);
  const selectedToMs = reportRange.toMs ?? (events.length ? Math.max(...events.map(event => event.startTime || now)) : now);
  const periodDays = Math.max(1, Math.floor((selectedToMs - selectedFromMs) / DAY_MS) + 1);
  const generatedDate = new Date(now).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' });
  const periodStartStr = new Date(selectedFromMs).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  const periodEndStr = new Date(selectedToMs).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });

  const {
    personName = '',
    caretakerName = '',
    dateOfBirth = '',
    emergencyContact = '',
    neurologistName = '',
    neurologistInstitution = '',
    neurologistContact = '',
    includePatientDOB = true,
    reportNotes = '',
    userMode = 'CARETAKER',
  } = settings;

  const allSorted = [...events].sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
  const periodEvents = allSorted.filter(event => {
    const startTime = event.startTime || 0;
    return startTime >= selectedFromMs && startTime <= selectedToMs;
  });
  const periodWellbeingEntries = [...wellbeingEntries]
    .filter(entry => {
      const recordedAt = Number(entry.recordedAt || 0);
      return recordedAt >= selectedFromMs && recordedAt <= selectedToMs;
    })
    .sort((a, b) => (b.recordedAt || 0) - (a.recordedAt || 0));
  const last10Events = allSorted.slice(0, 10);
  const recentWindowDays = Math.min(10, periodDays);
  const recentWindowStart = selectedToMs - (recentWindowDays - 1) * DAY_MS;
  const last10DaysEvents = allSorted.filter(event => {
    const startTime = event.startTime || 0;
    return startTime >= recentWindowStart && startTime <= selectedToMs;
  });
  const recentEvents = last10DaysEvents.length >= last10Events.length ? last10DaysEvents : last10Events;

  const byType = {};
  let totalDuration = 0;
  periodEvents.forEach(event => {
    const type = event.type || 'Uncategorized';
    byType[type] = (byType[type] || 0) + 1;
    totalDuration += event.duration || 0;
  });

  const totalEvents = periodEvents.length;
  const avgDurationSec = totalEvents ? Math.round(totalDuration / totalEvents) : 0;
  const daysCovered = new Set(periodEvents.map(event => event.date || '')).size;
  const reporterLabel = userMode === 'CARETAKER' ? caretakerName : personName;
  const subjectLabel = userMode === 'CARETAKER' ? personName : t('export.docs.self_subject');

  const awareness = { awake: 0, confused: 0, blackout: 0 };
  const postIctalCounts = {};
  periodEvents.forEach(event => {
    (event.symptoms || []).forEach(symptom => {
      const value = (symptom.symptom || symptom.detail || '').toLowerCase();
      if (value.includes('awake') || value.includes('fully')) awareness.awake += 1;
      else if (value.includes('confused') || value.includes('dream')) awareness.confused += 1;
      else if (value.includes('blackout') || value.includes('loss')) awareness.blackout += 1;
    });
    const postIctal = describePostIctal(event.postIctal, t);
    postIctal.findings.forEach((finding) => {
      postIctalCounts[finding] = (postIctalCounts[finding] || 0) + 1;
    });
    if (postIctal.paralysisLocations.length > 0) {
      const paralysisLabel = t('export.docs.post_ictal_paralysis', 'After-seizure paralysis');
      postIctalCounts[paralysisLabel] = (postIctalCounts[paralysisLabel] || 0) + postIctal.paralysisLocations.length;
    }
  });

  const postIctalSummary = Object.entries(postIctalCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => `${label} (${count}x)`)
    .join(', ');

  const detailMap = new Map();
  const addDetail = event => { if (event?.id != null) detailMap.set(event.id, event); };
  allSorted.slice(0, 3).forEach(addDetail);
  periodEvents.filter(event => (event.duration || 0) > 300 || event.isEdited).forEach(addDetail);
  const detailEvents = [...detailMap.values()].sort((a, b) => (b.startTime || 0) - (a.startTime || 0));

  const triggerCounts = {};
  periodEvents.forEach(event => {
    (event.triggers || []).forEach(trigger => {
      triggerCounts[trigger] = (triggerCounts[trigger] || 0) + 1;
    });
  });

  const longEvents = periodEvents.filter(event => (event.duration || 0) > 300);
  const flags = [];
  if (longEvents.length > 0) {
    flags.push({
      level: 'warning',
      label: t('export.docs.flag_events_exceeding_5m', { count: longEvents.length }),
      detail: longEvents.map(event => `${event.date} ${event.time} (${formatDurationLabel(event.duration || 0)})`).join('; '),
    });
  }

  const midpoint = selectedFromMs + Math.floor(periodDays / 2) * DAY_MS;
  const firstHalf = periodEvents.filter(event => (event.startTime || 0) < midpoint).length;
  const secondHalf = periodEvents.filter(event => (event.startTime || 0) >= midpoint).length;
  if (secondHalf > firstHalf * 1.5 && secondHalf > 1) {
    flags.push({
      level: 'warning',
      label: t('export.docs.flag_increasing_frequency'),
      detail: t('export.docs.flag_detail_recent_vs_prior', { recent: secondHalf, prior: firstHalf }),
    });
  }

  const ascendingEvents = [...periodEvents].sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
  if (ascendingEvents.length >= 4) {
    const half = Math.floor(ascendingEvents.length / 2);
    const avgEarly = ascendingEvents.slice(0, half).reduce((sum, event) => sum + (event.duration || 0), 0) / half;
    const avgRecent = ascendingEvents.slice(half).reduce((sum, event) => sum + (event.duration || 0), 0) / (ascendingEvents.length - half);
    if (avgRecent > avgEarly * 1.3) {
      flags.push({
        level: 'warning',
        label: t('export.docs.flag_increasing_duration'),
        detail: t('export.docs.flag_detail_recent_avg_vs_earlier_avg', {
          recent: formatDurationLabel(avgRecent),
          earlier: formatDurationLabel(avgEarly),
        }),
      });
    }
  }

  const autoStoppedCount = periodEvents.filter(event => event.isEmergencyStop).length;
  if (autoStoppedCount > 0) {
    flags.push({
      level: 'warning',
      label: t('export.docs.flag_auto_terminated', { count: autoStoppedCount }),
      detail: t('export.docs.flag_detail_auto_terminated'),
    });
  }

  const editedCount = periodEvents.filter(event => event.isEdited).length;
  if (editedCount > 0) {
    flags.push({
      level: 'notice',
      label: t('export.docs.flag_edited_records', { count: editedCount }),
      detail: t('export.docs.flag_detail_edited_records'),
    });
  }

  const topTriggers = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topTriggers.length > 0) {
    flags.push({
      level: 'notice',
      label: t('export.docs.flag_reported_triggers', {
        count: periodEvents.filter(event => (event.triggers || []).length > 0).length,
      }),
      detail: topTriggers.map(([trigger, count]) => `${trigger} (${count}x)`).join(', '),
    });
  }

  const fullyRecorded = periodEvents.filter(event => event.isComplete && event.laps?.aura && event.laps?.seizure && event.laps?.recovery).length;
  const partialRecorded = periodEvents.filter(event => event.isComplete && !(event.laps?.aura && event.laps?.seizure && event.laps?.recovery)).length;
  const untagged = periodEvents.filter(event => !event.isComplete).length;
  const fullyPct = totalEvents ? Math.round((fullyRecorded / totalEvents) * 100) : 0;
  const confidence = fullyPct >= 80
    ? { label: 'HIGH', color: '#059669', bg: '#d1fae5' }
    : fullyPct >= 50
      ? { label: 'MEDIUM', color: '#d97706', bg: '#fef3c7' }
      : { label: 'LOW', color: '#dc2626', bg: '#fee2e2' };

  // Expected doses follow the regimen in force on each day (start/stop/schedule changes included)
  const liveMedications = medications.filter(medication => !medication.deletedAt);
  let expectedDoses = 0;
  const expectedEnd = Math.min(selectedToMs, now);
  for (let day = new Date(selectedFromMs).setHours(0, 0, 0, 0); day <= expectedEnd; day = new Date(day).setDate(new Date(day).getDate() + 1)) {
    expectedDoses += getScheduledDosesForDay(liveMedications, day, medicationChanges)
      .filter(dose => dose.scheduledTs >= selectedFromMs && dose.scheduledTs <= expectedEnd).length;
  }
  const scheduledLogs = medicationLogs.filter(log => log.scheduledTime);
  const adherence = { taken: 0, late: 0, assumed: 0, missed: 0 };
  scheduledLogs.forEach(log => {
    const status = log.status || 'taken';
    if (status in adherence) adherence[status] += 1;
  });
  // Medications taken at any point in the period, with their dose at the start and end of it
  const periodMedications = liveMedications.filter(medication => {
    if (medication.startedAt != null && medication.startedAt > selectedToMs) return false;
    if (medication.stoppedAt != null) return medication.stoppedAt >= selectedFromMs;
    return medication.active !== false;
  });
  const wellbeingMoodCounts = {};
  const wellbeingFactorCounts = {};
  periodWellbeingEntries.forEach(entry => {
    if (entry.primaryMood) wellbeingMoodCounts[entry.primaryMood] = (wellbeingMoodCounts[entry.primaryMood] || 0) + 1;
    Object.entries(entry.factors || {}).forEach(([id, factor]) => {
      if (!factorHasSignal(factor)) return;
      const label = wellbeingFactorLabel(factor, id, t);
      wellbeingFactorCounts[label] = (wellbeingFactorCounts[label] || 0) + 1;
    });
  });
  const wellbeingTopMoods = Object.entries(wellbeingMoodCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const wellbeingTopFactors = Object.entries(wellbeingFactorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const wellbeingDaysCovered = new Set(periodWellbeingEntries.map(entry => entry.dayKey || new Date(entry.recordedAt || 0).toISOString().slice(0, 10))).size;

  return {
    locale,
    generatedDate,
    periodStartStr,
    periodEndStr,
    periodDays,
    settings: {
      personName,
      caretakerName,
      dateOfBirth,
      emergencyContact,
      neurologistName,
      neurologistInstitution,
      neurologistContact,
      includePatientDOB,
      reportNotes,
      userMode,
      reporterLabel,
      subjectLabel,
    },
    stats: {
      totalEvents,
      avgDurationSec,
      avgDurationLabel: formatDurationLabel(avgDurationSec),
      daysCovered,
      seizureTypeCount: Object.keys(byType).length,
      byType,
      awareness,
      awarenessTotal: awareness.awake + awareness.confused + awareness.blackout,
      postIctalSummary,
      fullyRecorded,
      partialRecorded,
      untagged,
      autoStoppedCount,
      editedCount,
      fullyPct,
      confidence,
      medicationLogsCount: medicationLogs.length,
      expectedDoses,
      adherence,
    },
    medications: periodMedications.map(medication => {
      const startRegimen = regimenAt(medication, medicationChanges, selectedFromMs);
      const endRegimen = regimenAt(medication, medicationChanges, Math.min(selectedToMs, now)) ?? regimenSnapshot(medication);
      const startDose = startRegimen ? regimenDoseSummary(startRegimen) : null;
      const endDose = regimenDoseSummary(endRegimen);
      return {
        id: medication.id,
        name: medication.name,
        detail: [medication.activeIngredient, formLabel(medication.form, t)].filter(Boolean).join(', '),
        doseLabel: startDose && startDose !== endDose ? `${startDose} → ${endDose}` : endDose,
        frequency: medication.frequency,
        frequencyLabel: FREQ_SHORT[medication.frequency] || medication.frequency,
        stoppedLabel: medication.stoppedAt != null && medication.stoppedAt <= selectedToMs
          ? t('export.docs.stopped_on', { date: new Date(medication.stoppedAt).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) })
          : '',
      };
    }),
    medicationChanges: buildMedicationChangeRows(medicationChanges, { fromMs: selectedFromMs, toMs: selectedToMs }),
    flags,
    wellbeing: {
      entriesCount: periodWellbeingEntries.length,
      daysCovered: wellbeingDaysCovered,
      topMoods: wellbeingTopMoods.map(([label, count]) => ({ label, count })),
      topFactors: wellbeingTopFactors.map(([label, count]) => ({ label, count })),
      recentEntries: periodWellbeingEntries.slice(0, 6).map(entry => ({
        recordedAt: entry.recordedAt || 0,
        date: entry.recordedAt ? new Date(entry.recordedAt).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
        time: entry.recordedAt ? new Date(entry.recordedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '-',
        primaryMood: entry.primaryMood || '-',
        intensity: entry.intensity || '',
        intensityLabel: wellbeingIntensityLabel(entry.intensity, t),
        factors: Object.entries(entry.factors || {})
          .filter(([, factor]) => factorHasSignal(factor))
          .slice(0, 4)
          .map(([id, factor]) => `${wellbeingFactorLabel(factor, id, t)}: ${wellbeingFactorValue(factor, t)}`),
        notes: entry.notes || '',
      })),
    },
    reportNotes,
    recentEvents: recentEvents.map((event, index) => {
      const phase = phaseDurs(event);
      const total = event.manualDurations?.total ?? event.duration ?? 0;
      return {
        index: index + 1,
        postIctal: describePostIctal(event.postIctal, t),
        date: event.date || '-',
        time: event.time || '-',
        type: event.type || 'Uncategorized',
        totalSec: total,
        totalLabel: formatDurationLabel(total),
        auraLabel: formatDurationLabel(phase.aura),
        seizureLabel: formatDurationLabel(phase.seizure),
        recoveryLabel: formatDurationLabel(phase.recovery),
        hasNote: Boolean(event.notes && event.notes.trim()),
        videoFileName: event.videoFileName || '',
        isEdited: Boolean(event.isEdited),
        userModeAtTime: event.userModeAtTime || '',
      };
    }),
    detailEvents: detailEvents.map(event => {
      const phase = phaseDurs(event);
      const total = event.manualDurations?.total ?? event.duration ?? 0;
      return {
        id: event.id,
        postIctal: describePostIctal(event.postIctal, t),
        date: event.date || '-',
        time: event.time || '-',
        type: event.type || 'Uncategorized',
        userModeAtTime: event.userModeAtTime || '',
        totalLabel: formatDurationLabel(total),
        auraLabel: formatDurationLabel(phase.aura),
        seizureLabel: formatDurationLabel(phase.seizure),
        recoveryLabel: formatDurationLabel(phase.recovery),
        notes: event.notes || '',
        videoFileName: event.videoFileName || '',
        badges: [
          (event.duration || 0) > 300 ? t('export.docs.detail_badge_over5') : '',
          event.isEmergencyStop ? t('export.docs.detail_badge_auto_stopped') : '',
          event.isEdited ? t('export.docs.detail_badge_edited') : '',
          ...(event.triggers || []),
        ].filter(Boolean),
        symptoms: (event.symptoms || []).map(symptom => ({
          ...describeSymptomPath(symptom),
          med: symptom.med || '-',
        })),
      };
    }),
    symptomLogGroups: periodEvents
      .filter(event => (event.symptoms || []).length > 0)
      .map((event, index) => ({
        id: event.id,
        eventIndex: index + 1,
        date: event.date || '-',
        time: event.time || '-',
        type: event.type || '-',
        totalLabel: formatDurationLabel(event.manualDurations?.total ?? event.duration ?? 0),
        symptoms: (event.symptoms || []).map(symptom => {
          const described = describeSymptomPath(symptom);
          return {
            path: described.path,
            med: symptom.med || '-',
            location: described.location || '-',
          };
        }),
      })),
    charts: {
      periodEvents,
      periodDays,
      periodStartMs: selectedFromMs,
      periodEndMs: selectedToMs,
      wellbeingEntries: periodWellbeingEntries,
      byType,
      totalEvents,
    },
    version: pkgVersion(),
  };
}

export function buildSeizureDiaryData(allEvents, settings = {}, medications = [], month, year, medicationChanges = []) {
  const locale = getCurrentLocale();
  const patientName = settings.personName || settings.caretakerName || '';
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const monthName = new Date(year, month - 1, 1).toLocaleString(locale, { month: 'long', year: 'numeric' });

  const eventsByDay = {};
  allEvents.forEach(event => {
    const date = new Date(event.startTime || 0);
    if (date.getFullYear() === year && date.getMonth() + 1 === month) {
      const day = date.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(event);
    }
  });

  const totalEvents = Object.values(eventsByDay).reduce((count, dayEvents) => count + dayEvents.length, 0);
  const legendTypes = [...new Set(Object.values(eventsByDay).flat().map(event => event.type || 'Uncategorized'))];
  const totalCells = firstDayOfWeek + daysInMonth;
  const rows = Math.ceil(totalCells / 7);
  const cells = [];

  for (let cellIndex = 0; cellIndex < rows * 7; cellIndex += 1) {
    const dayNum = cellIndex - firstDayOfWeek + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push({ kind: 'empty' });
      continue;
    }

    const dayEvents = eventsByDay[dayNum] || [];
    const typeCounts = {};
    dayEvents.forEach(event => {
      const type = event.type || 'Uncategorized';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    cells.push({
      kind: 'day',
      dayNum,
      eventCount: dayEvents.length,
      hasTriggers: dayEvents.some(event => (event.triggers || []).length > 0),
      types: Object.entries(typeCounts).map(([type, count]) => ({
        type,
        count,
        abbrev: DIARY_TYPE_ABBREV[type] || type.slice(0, 2),
        color: DIARY_TYPE_COLORS[type] || DIARY_TYPE_COLORS.Uncategorized,
      })),
    });
  }

  return {
    locale,
    year,
    month,
    monthName,
    patientName,
    totalEvents,
    firstDayOfWeek,
    daysInMonth,
    rows,
    cells,
    weekdayLabels: buildWeekdayLabels(locale),
    legendTypes: legendTypes.map(type => ({
      type,
      abbrev: DIARY_TYPE_ABBREV[type] || type.slice(0, 2),
      color: DIARY_TYPE_COLORS[type] || DIARY_TYPE_COLORS.Uncategorized,
    })),
    medicationsLine: medications.filter(medication => medication.active !== false && !medication.deletedAt).length > 0
      ? medications
        .filter(medication => medication.active !== false && !medication.deletedAt)
        .map(medication => `${medication.name} ${regimenDoseSummary(regimenSnapshot(medication))} ${medication.frequency}`).join(' | ')
      : '',
    medicationChangesLines: buildMedicationChangeRows(medicationChanges, {
      fromMs: new Date(year, month - 1, 1).getTime(),
      toMs: new Date(year, month, 0, 23, 59, 59, 999).getTime(),
    }).map(changeRowText),
    generatedDate: new Date().toLocaleDateString(locale),
  };
}

export function buildEegDiaryReportData(session, activities = []) {
  const locale = getCurrentLocale();
  const t = getTranslator();
  const generatedDate = new Date().toLocaleDateString(locale);
  const sessionEnd = session?.actualEndTime || session?.plannedEndTime || null;
  return {
    locale,
    generatedDate,
    session: session ? {
      title: session.title || t('idle.eeg_session_default', 'EEG monitoring session'),
      startLabel: new Date(session.startTime).toLocaleString(locale),
      endLabel: sessionEnd ? new Date(sessionEnd).toLocaleString(locale) : t('eeg.running', 'Ongoing'),
      status: session.status || 'ACTIVE',
      notes: session.notes || '',
      durationPreset: session.durationPreset || '',
    } : null,
    activities: activities.map(activity => ({
      id: activity.id,
      kind: activity.kind,
      activityLabel: activity.activityLabel || '',
      customActivityText: activity.customActivityText || '',
      moodLabel: activity.moodLabel || '',
      notes: activity.notes || '',
      startLabel: new Date(activity.startTime).toLocaleString(locale),
      endLabel: activity.endTime ? new Date(activity.endTime).toLocaleString(locale) : 'Running',
      durationLabel: formatDurationLabel(activity.durationSec || 0),
      seizureRef: activity.kind === 'SEIZURE_REFERENCE'
        ? `Event #${activity.linkedEventId || '-'}`
        : '',
    })),
  };
}

function buildWeekdayLabels(locale) {
  const sunday = new Date(Date.UTC(2024, 0, 7));
  return Array.from({ length: 7 }, (_, index) =>
    new Date(sunday.getTime() + index * DAY_MS).toLocaleDateString(locale, { weekday: 'short' })
  );
}

function pkgVersion() {
  return '4.1.0';
}
