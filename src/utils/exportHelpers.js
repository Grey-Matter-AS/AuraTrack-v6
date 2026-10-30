import i18n from '../i18n';
import { formatCSVField, formatCSVRow } from './formatters';
import { buildEventLogData, buildNeurologistReportData, buildSeizureDiaryData, buildEegDiaryReportData } from '../reports/builders';
import { renderEventLogHtml, renderNeurologistReportHtml, renderSeizureDiaryHtml, renderEegDiaryHtml } from '../reports/htmlRenderers';
import { downloadEventLogPdf, downloadNeurologistReportPdf, downloadSeizureDiaryPdf, downloadEegDiaryPdf } from '../reports/pdfRenderers';
import { dateStamp, endOfLocalDay, parseLocalDate } from './dates';
import { saveFileBlob } from './fileSave';

export const filterEventsByDateRange = (events, fromDateStr, toDateStr) => {
  const from = fromDateStr ? parseLocalDate(fromDateStr).getTime() : 0;
  const to = toDateStr ? endOfLocalDay(parseLocalDate(toDateStr)) : Date.now();
  return events.filter(event => event.startTime >= from && event.startTime <= to);
};

function formatWellbeingFactors(factors = {}) {
  return Object.values(factors).map(factor => {
    const value = factor?.value ?? '';
    const suffix = factor?.unit ? ` ${factor.unit}` : '';
    return `${factor?.label || i18n.t('export.factor')}=${value}${suffix}`;
  }).join('|');
}

export const exportToCSV = async (events, medications = [], medicationLogs = [], eegSessions = [], eegActivities = [], wellbeingEntries = [], medicationChanges = []) => {
  const header = 'id,date,time,type,duration,notes,postIctalFindings,postIctalParalysisLocations,postIctalRecovery';
  const rows = events.map(formatCSVRow).join('\n');

  let csv = `${header}\n${rows}`;

  if (medications.length > 0) {
    csv += '\n\nMEDICATIONS\nid,uuid,name,activeIngredient,form,dose,unit,slotDoses,frequency,scheduledTimes,scheduledDays,isRescue,reminderEnabled,showInEmergency,active,startedAt,stoppedAt\n';
    csv += medications.map(medication =>
      [
        medication.id,
        medication.uuid ?? '',
        medication.name,
        medication.activeIngredient ?? '',
        medication.form ?? '',
        medication.dose,
        medication.unit,
        Object.entries(medication.slotDoses || {}).map(([time, dose]) => `${time}=${dose}`).join('|'),
        medication.frequency,
        (medication.scheduledTimes || []).join('|'),
        (medication.scheduledDays || []).join('|'),
        medication.isRescue ? 1 : 0,
        medication.reminderEnabled ? 1 : 0,
        medication.showInEmergency ? 1 : 0,
        medication.active ? 1 : 0,
        medication.startedAt ? new Date(medication.startedAt).toISOString() : '',
        medication.stoppedAt ? new Date(medication.stoppedAt).toISOString() : '',
      ].map(formatCSVField).join(',')
    ).join('\n');
  }

  if (medicationLogs.length > 0) {
    csv += '\n\nMEDICATION_LOGS\nid,medicationId,medicationUuid,takenAt,scheduledTime,status,dose,unit,note,isEdited\n';
    csv += medicationLogs.map(log =>
      [
        log.id,
        log.medicationId,
        log.medicationUuid ?? '',
        log.takenAt,
        log.scheduledTime ?? '',
        log.status ?? '',
        log.doseSnapshot ?? '',
        log.unitSnapshot ?? '',
        log.note ?? '',
        log.isEdited ? 1 : 0,
      ].map(formatCSVField).join(',')
    ).join('\n');
  }

  const realChanges = medicationChanges.filter(change => !change.isBaseline);
  if (realChanges.length > 0) {
    csv += '\n\nMEDICATION_CHANGES\nid,medicationUuid,medicationName,type,effectiveAt,changedFields,from,to,note,recordedAt\n';
    csv += realChanges.map(change =>
      [
        change.id,
        change.medicationUuid ?? '',
        change.medicationName ?? '',
        change.type,
        new Date(change.effectiveAt).toISOString(),
        (change.changedFields || []).join('|'),
        change.from ? JSON.stringify(change.from) : '',
        change.to ? JSON.stringify(change.to) : '',
        change.note ?? '',
        change.recordedAt ? new Date(change.recordedAt).toISOString() : '',
      ].map(formatCSVField).join(',')
    ).join('\n');
  }

  if (eegSessions.length > 0) {
    csv += '\n\nEEG_SESSIONS\nid,startTime,plannedEndTime,actualEndTime,durationPreset,title,status,notes\n';
    csv += eegSessions.map(session =>
      [
        session.id,
        session.startTime,
        session.plannedEndTime ?? '',
        session.actualEndTime ?? '',
        session.durationPreset ?? '',
        session.title ?? '',
        session.status ?? '',
        session.notes ?? '',
      ].map(formatCSVField).join(',')
    ).join('\n');
  }

  if (eegActivities.length > 0) {
    csv += '\n\nEEG_ACTIVITIES\nid,sessionId,kind,activityLabel,customActivityText,moodLabel,startTime,endTime,durationSec,linkedEventId,notes\n';
    csv += eegActivities.map(activity =>
      [
        activity.id,
        activity.sessionId,
        activity.kind ?? '',
        activity.activityLabel ?? '',
        activity.customActivityText ?? '',
        activity.moodLabel ?? '',
        activity.startTime,
        activity.endTime ?? '',
        activity.durationSec ?? 0,
        activity.linkedEventId ?? '',
        activity.notes ?? '',
      ].map(formatCSVField).join(',')
    ).join('\n');
  }

  if (wellbeingEntries.length > 0) {
    csv += '\n\nWELLBEING_ENTRIES\nid,recordedAt,dayKey,primaryMood,intensity,factors,notes,isEdited\n';
    csv += wellbeingEntries.map(entry =>
      [
        entry.id,
        entry.recordedAt,
        entry.dayKey ?? '',
        entry.primaryMood ?? '',
        entry.intensity ?? '',
        formatWellbeingFactors(entry.factors),
        entry.notes ?? '',
        entry.isEdited ? 1 : 0,
      ].map(formatCSVField).join(',')
    ).join('\n');
  }

  const blob = new Blob([csv], { type: 'text/csv' });
  return saveFileBlob(blob, `auratrack-events-${dateStamp()}.csv`, 'AuraTrack CSV Export', ['.csv']);
};

export const buildEventTablePreview = (events, medicationChanges = []) => renderEventLogHtml(buildEventLogData(events, medicationChanges));

export const buildNeurologistReportPreview = (events, settings = {}, medications = [], medicationLogs = [], reportRange = {}, wellbeingEntries = [], medicationChanges = []) =>
  renderNeurologistReportHtml(buildNeurologistReportData(events, settings, medications, medicationLogs, reportRange, wellbeingEntries, medicationChanges));

export const buildSeizureDiaryPreview = (allEvents, settings = {}, medications = [], month, year, medicationChanges = []) =>
  renderSeizureDiaryHtml(buildSeizureDiaryData(allEvents, settings, medications, month, year, medicationChanges));

export const exportEventLogPDF = async (events, medicationChanges = []) => downloadEventLogPdf(buildEventLogData(events, medicationChanges));

export const exportNeurologistReportPDF = async (events, settings = {}, medications = [], medicationLogs = [], reportRange = {}, wellbeingEntries = [], medicationChanges = []) =>
  downloadNeurologistReportPdf(buildNeurologistReportData(events, settings, medications, medicationLogs, reportRange, wellbeingEntries, medicationChanges));

export const exportSeizureDiaryPDF = async (allEvents, settings = {}, medications = [], month, year, medicationChanges = []) =>
  downloadSeizureDiaryPdf(buildSeizureDiaryData(allEvents, settings, medications, month, year, medicationChanges));

export const buildEegDiaryPreview = (session, activities = []) =>
  renderEegDiaryHtml(buildEegDiaryReportData(session, activities));

export const exportEegDiaryPDF = async (session, activities = []) =>
  downloadEegDiaryPdf(buildEegDiaryReportData(session, activities));


export { saveFileBlob, saveTextFile } from './fileSave';
