import i18n from '../i18n';
import { freqBarChartSVG, durationLineSVG, typeBarSVG, phaseStackSVG, wellbeingCorrelationSVG } from '../utils/pdfCharts';
import { esc } from '../utils/htmlEscape';

export function renderEventLogHtml(data) {
  const t = translator();
  const styles = buildPreviewStyles(`
    .auratrack-simple-report {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #111827;
      font-size: 12px;
    }
    .auratrack-simple-report h2 {
      margin: 0 0 16px;
      font-size: 18px;
      font-weight: 900;
      letter-spacing: -0.02em;
    }
    .auratrack-simple-report table {
      border-collapse: collapse;
      width: 100%;
      table-layout: fixed;
    }
    .auratrack-simple-report td,
    .auratrack-simple-report th {
      border: 1px solid #d1d5db;
      padding: 6px 10px;
      text-align: left;
      vertical-align: top;
      overflow-wrap: anywhere;
    }
    .auratrack-simple-report th {
      background: #111827;
      color: #fff;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .auratrack-simple-report .symp-row td {
      border-top: none;
      color: #4b5563;
      font-style: italic;
      font-size: 11px;
      background: #f9fafb;
    }
  `);

  const html = `
    <div class="auratrack-simple-report">
      <h2>${esc(t('export.docs.event_log_title'))} - ${data.generatedDate}</h2>
      <table>
        <thead><tr><th>${esc(t('export.docs.date'))}</th><th>${esc(t('export.docs.time'))}</th><th>${esc(t('export.docs.type'))}</th><th>${esc(t('export.docs.duration'))}</th><th>${esc(t('export.docs.notes'))}</th></tr></thead>
        <tbody>
          ${data.events.map(event => {
            const eventRow = `<tr><td>${esc(event.date)}</td><td>${esc(event.time)}</td><td>${esc(event.type)}</td><td>${esc(event.durationLabel)}</td><td>${event.notesHtml}</td></tr>`;
            const symptomRow = event.symptoms.length
              ? `<tr class="symp-row"><td colspan="5">${event.symptoms.map(symptom => esc(symptom.combined)).join('&nbsp;&nbsp;|&nbsp;&nbsp;')}</td></tr>`
              : '';
            return eventRow + symptomRow;
          }).join('')}
        </tbody>
      </table>
      ${data.medicationChanges?.length ? `
        <h2 style="margin-top:24px">${esc(t('export.docs.medication_changes'))}</h2>
        ${renderMedicationChangesTable(data.medicationChanges)}
      ` : ''}
    </div>
  `;

  return {
    title: `${t('export.pdf_label')} - ${data.generatedDate}`,
    styles,
    html,
  };
}

export function renderNeurologistReportHtml(data) {
  const t = translator();
  const chart1 = freqBarChartSVG(data.charts.periodEvents, data.periodDays, data.charts.periodEndMs);
  const chart2 = durationLineSVG(data.charts.periodEvents, data.periodDays);
  const chart3 = typeBarSVG(data.charts.byType, data.charts.totalEvents);
  const chart4 = phaseStackSVG(data.charts.periodEvents, 10);
  const chart5 = wellbeingCorrelationSVG(data.charts.periodEvents, data.charts.wellbeingEntries, data.periodDays, data.charts.periodEndMs);

  const styles = buildPreviewStyles(`
    .auratrack-neuro-report,
    .auratrack-neuro-report * { box-sizing: border-box; }
    .auratrack-neuro-report {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      color: #111827;
      line-height: 1.4;
    }
    .auratrack-neuro-report h2 {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #374151;
      margin: 0 0 10px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 5px;
    }
    .auratrack-neuro-report table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    .auratrack-neuro-report th {
      background: #1e293b;
      color: #fff;
      padding: 6px 7px;
      text-align: left;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .auratrack-neuro-report td {
      padding: 5px 7px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 10px;
      vertical-align: top;
      overflow-wrap: anywhere;
    }
    .auratrack-neuro-report .section { margin-bottom: 20px; page-break-inside: avoid; }
    .auratrack-neuro-report .chart-wrap { margin-bottom: 10px; }
    .auratrack-neuro-report .chart-wrap svg { width: 100%; height: auto; display: block; }
    .auratrack-neuro-report .stat-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 14px; }
    .auratrack-neuro-report .stat-card { background: #1e293b; border-radius: 6px; padding: 10px 8px; text-align: center; color: #fff; }
    .auratrack-neuro-report .stat-value { font-size: 20px; font-weight: 900; }
    .auratrack-neuro-report .stat-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-top: 2px; }
    .auratrack-neuro-report .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
    .auratrack-neuro-report .meta-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 9px 11px; }
    .auratrack-neuro-report .meta-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; font-weight: 700; }
    .auratrack-neuro-report .meta-value { font-size: 12px; font-weight: 800; color: #111827; margin-top: 2px; }
    .auratrack-neuro-report .meta-sm { font-size: 10px; color: #374151; margin-top: 1px; }
    .auratrack-neuro-report .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 3px solid #dc2626; margin-bottom: 14px; gap: 12px; }
    .auratrack-neuro-report .ctx-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .auratrack-neuro-report .ctx-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; }
    .auratrack-neuro-report .ctx-label { font-size: 8px; font-weight: 800; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.06em; }
    .auratrack-neuro-report .ctx-value { font-size: 10px; font-weight: 600; color: #374151; margin-top: 2px; }
    .auratrack-neuro-report .qual-grid { display: grid; grid-template-columns: repeat(5,1fr); gap: 8px; }
    .auratrack-neuro-report .qual-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; text-align: center; }
    .auratrack-neuro-report .qual-num { font-size: 18px; font-weight: 900; color: #1e293b; }
    .auratrack-neuro-report .qual-label { font-size: 8px; text-transform: uppercase; color: #9ca3af; font-weight: 700; margin-top: 2px; }
    .auratrack-neuro-report .disclaimer { font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 14px; }
  `);

  const html = `
    <div class="auratrack-neuro-report">
      <div class="header">
        <div>
          <div style="font-size:9px;font-weight:900;letter-spacing:0.4em;color:#dc2626;text-transform:uppercase">AuraTrack</div>
          <div style="font-size:18px;font-weight:900;margin-top:2px;letter-spacing:-0.3px">${esc(t('export.docs.neurological_report'))}</div>
          <div style="font-size:9px;color:#6b7280;margin-top:4px">${esc(t('export.docs.generated'))}: ${esc(data.generatedDate)}</div>
          <div style="font-size:9px;color:#6b7280">${esc(t('export.docs.period'))}: ${esc(data.periodStartStr)} - ${esc(data.periodEndStr)} (${esc(t('export.docs.selected_days', { count: data.periodDays }))})</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:9px;color:#6b7280;margin-bottom:1px">${esc(t('export.docs.prepared_by'))}</div>
          <div style="font-weight:800;font-size:11px">${esc(data.settings.reporterLabel || '-')}</div>
          ${data.settings.neurologistName ? `<div style="font-size:9px;color:#374151;margin-top:4px">${esc(t('export.docs.for_label'))}: <strong>${esc(data.settings.neurologistName)}</strong></div>` : ''}
          ${data.settings.neurologistInstitution ? `<div style="font-size:9px;color:#6b7280">${esc(data.settings.neurologistInstitution)}</div>` : ''}
          ${data.settings.neurologistContact ? `<div style="font-size:9px;color:#6b7280">${esc(data.settings.neurologistContact)}</div>` : ''}
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-card">
          <div class="meta-label">${esc(t('export.docs.patient'))}</div>
          <div class="meta-value">${esc(data.settings.subjectLabel || '-')}</div>
          ${data.settings.includePatientDOB && data.settings.dateOfBirth ? `<div class="meta-sm">${esc(t('export.docs.dob'))}: ${esc(new Date(data.settings.dateOfBirth).toLocaleDateString(data.locale, { day: '2-digit', month: 'long', year: 'numeric' }))}</div>` : ''}
          ${data.settings.emergencyContact ? `<div class="meta-sm">${esc(t('export.docs.emergency'))}: ${esc(data.settings.emergencyContact)}</div>` : ''}
        </div>
        <div class="meta-card">
          <div class="meta-label">${esc(t('export.docs.report_summary'))}</div>
          <div class="meta-sm" style="margin-top:3px"><strong>${data.stats.totalEvents}</strong> ${esc(t('export.docs.events_in_period', { count: data.stats.totalEvents }))}</div>
          <div class="meta-sm"><strong>${data.stats.daysCovered}</strong> ${esc(t('export.docs.days_with_recorded_events', { count: data.stats.daysCovered }))}</div>
          <div class="meta-sm">${esc(t('export.docs.avg_duration'))}: <strong>${esc(data.stats.avgDurationLabel)}</strong></div>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card"><div class="stat-value">${data.stats.totalEvents}</div><div class="stat-label">${esc(t('export.docs.events_period', { count: data.periodDays }))}</div></div>
        <div class="stat-card"><div class="stat-value">${esc(data.stats.avgDurationLabel === '-' ? '0s' : data.stats.avgDurationLabel)}</div><div class="stat-label">${esc(t('export.docs.avg_duration'))}</div></div>
        <div class="stat-card"><div class="stat-value">${data.stats.daysCovered}</div><div class="stat-label">${esc(t('export.docs.days_affected'))}</div></div>
        <div class="stat-card"><div class="stat-value">${data.stats.seizureTypeCount}</div><div class="stat-label">${esc(t('export.docs.seizure_types'))}</div></div>
      </div>

      ${renderMedicationSection(data)}
      ${renderMedicationChangesSection(data)}
      ${renderWellbeingSection(data)}

      <div class="section">
        <h2>${esc(t('export.docs.recent_events', { count: data.recentEvents.length }))}</h2>
        <table>
          <thead><tr>
            <th>#</th><th>${esc(t('export.docs.date'))}</th><th>${esc(t('export.docs.time'))}</th><th>${esc(t('export.docs.type'))}</th>
            <th style="text-align:right">${esc(t('export.docs.total'))}</th>
            <th style="text-align:right">${esc(t('export.docs.aura'))}</th>
            <th style="text-align:right">${esc(t('export.docs.seizure'))}</th>
            <th style="text-align:right">${esc(t('export.docs.recovery'))}</th>
            <th style="text-align:center">${esc(t('export.docs.notes'))}</th>
            <th style="text-align:center">${esc(t('export.docs.edited'))}</th>
            <th style="text-align:center">${esc(t('export.docs.recorded_by'))}</th>
          </tr></thead>
          <tbody>${data.recentEvents.length
            ? data.recentEvents.map(event => `<tr>
                <td style="font-weight:700;color:#374151">${event.index}</td>
                <td>${esc(event.date)}</td>
                <td>${esc(event.time)}</td>
                <td style="font-weight:700">${esc(event.type)}</td>
                <td style="text-align:right;font-weight:700">${esc(event.totalLabel)}</td>
                <td style="text-align:right;color:#d97706">${esc(event.auraLabel)}</td>
                <td style="text-align:right;color:#dc2626">${esc(event.seizureLabel)}</td>
                <td style="text-align:right;color:#3b82f6">${esc(event.recoveryLabel)}</td>
                <td style="text-align:center">${event.hasNote ? 'Y' : ''}</td>
                <td style="text-align:center">${event.isEdited ? 'E' : ''}</td>
                <td style="text-align:center">${esc(shortMode(event.userModeAtTime))}</td>
              </tr>`).join('')
            : `<tr><td colspan="11" style="color:#9ca3af">${esc(t('export.docs.no_events_recorded'))}</td></tr>`}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h2>${esc(t('export.docs.medication_context'))}</h2>
        <div class="ctx-grid">
          <div class="ctx-item">
            <div class="ctx-label">${esc(t('export.docs.awareness_levels'))}</div>
            <div class="ctx-value">${data.stats.awarenessTotal > 0
              ? `${esc(t('export.docs.fully_awake'))}: ${data.stats.awareness.awake} | ${esc(t('export.docs.confused'))}: ${data.stats.awareness.confused} | ${esc(t('export.docs.blackout'))}: ${data.stats.awareness.blackout}`
              : esc(t('export.docs.not_recorded'))}</div>
          </div>
          <div class="ctx-item">
            <div class="ctx-label">${esc(t('export.docs.recovery_quality'))}</div>
            <div class="ctx-value">${data.stats.postIctalSummary ? esc(data.stats.postIctalSummary) : esc(t('export.docs.post_ictal_none', 'No after-seizure symptoms recorded'))}</div>
          </div>
          <div class="ctx-item">
            <div class="ctx-label">${esc(t('export.docs.rescue_medication_use'))}</div>
            <div class="ctx-value">${esc(t('export.docs.not_recorded'))}</div>
          </div>
          <div class="ctx-item">
            <div class="ctx-label">${esc(t('export.docs.triggers_medications'))}</div>
            <div class="ctx-value">${data.reportNotes ? esc(data.reportNotes) : esc(t('export.docs.not_recorded'))}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>${esc(t('export.docs.trend_analysis'))}</h2>
        <div class="chart-wrap">${chart1}</div>
        <div class="chart-wrap">${chart2}</div>
        <div class="chart-wrap">${chart5}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div class="chart-wrap">${chart3}</div>
          <div class="chart-wrap">${chart4}</div>
        </div>
      </div>

      <div class="section">
        <h2>${esc(t('export.docs.condensed_event_details'))}</h2>
        ${data.detailEvents.length
          ? data.detailEvents.map(event => `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:10px;page-break-inside:avoid">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:8px">
                <div>
                  <span style="font-weight:900;font-size:12px">${esc(event.date)} ${esc(t('export.docs.at'))} ${esc(event.time)}</span>
                  <span style="margin-left:8px;font-size:11px;color:#374151;font-weight:700">${esc(event.type)}</span>
                  ${event.userModeAtTime ? `<span style="margin-left:6px">${esc(shortMode(event.userModeAtTime))}</span>` : ''}
                </div>
                <div style="display:flex;gap:4px;flex-wrap:wrap">${event.badges.map(badge => `<span style="background:#eff6ff;color:#4778d2;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700">${esc(badge)}</span>`).join('')}</div>
              </div>
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px">
                ${metricCard(t('export.docs.total'), event.totalLabel, '#f9fafb', '#111827')}
                ${metricCard(t('export.docs.aura'), event.auraLabel, '#fffbeb', '#d97706')}
                ${metricCard(t('export.docs.seizure'), event.seizureLabel, '#fef2f2', '#dc2626')}
                ${metricCard(t('export.docs.recovery'), event.recoveryLabel, '#eff6ff', '#3b82f6')}
              </div>
              ${event.symptoms.length
                ? `<table style="margin-bottom:6px">
                    <thead><tr style="background:#f3f4f6">
                      <th>${esc(t('export.docs.symptom'))}</th>
                      <th>${esc(t('export.docs.medical_term'))}</th>
                      <th>${esc(t('export.docs.location'))}</th>
                    </tr></thead>
                    <tbody>${event.symptoms.map(symptom => `<tr><td>${esc(symptom.path || '-')}</td><td>${esc(symptom.med || '-')}</td><td>${esc(symptom.location || '-')}</td></tr>`).join('')}</tbody>
                  </table>`
                : `<p style="font-size:10px;color:#9ca3af;margin:4px 0">${esc(t('export.docs.no_symptoms_recorded'))}</p>`}
              ${event.postIctal.summary
                ? `<div style="margin-top:6px;padding:7px 9px;background:#eff6ff;border-radius:5px;font-size:10px;color:#1e3a8a">
                    <strong>${esc(t('export.docs.post_ictal_summary', 'After-seizure summary'))}:</strong> ${esc(event.postIctal.summary)}
                  </div>`
                : ''}
              ${event.notes ? `<div style="margin-top:6px;padding:7px 9px;background:#f9fafb;border-radius:5px;font-size:10px;color:#374151;white-space:pre-wrap">${esc(event.notes)}</div>` : ''}
            </div>`).join('')
          : `<p style="color:#9ca3af;font-size:11px;margin:0">${esc(t('export.docs.no_events_to_display'))}</p>`}
      </div>

      <div class="section">
        <h2>${esc(t('export.docs.ictal_symptom_log'))}</h2>
        ${data.symptomLogGroups.length
          ? data.symptomLogGroups.map(group => `<div style="border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;padding:10px 12px;margin-bottom:10px;page-break-inside:avoid">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">
                <div>
                  <div style="font-size:9px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;margin-bottom:2px">${esc(t('export.docs.event_number', { count: group.eventIndex }))}</div>
                  <div style="font-size:11px;color:#111827">
                    <strong>${esc(group.date)}</strong> ${esc(t('export.docs.at'))} <strong>${esc(group.time)}</strong>
                    <span style="margin-left:8px;color:#374151;font-weight:700">${esc(group.type)}</span>
                  </div>
                </div>
                <div style="font-size:10px;color:#6b7280">${esc(t('export.docs.total'))}: <strong>${esc(group.totalLabel)}</strong></div>
              </div>
              <table>
                <thead><tr>
                  <th>${esc(t('export.docs.symptom_path'))}</th><th>${esc(t('export.docs.medical_term'))}</th><th>${esc(t('export.docs.location'))}</th>
                </tr></thead>
                <tbody>${group.symptoms.map(symptom => `<tr><td>${esc(symptom.path || '-')}</td><td>${esc(symptom.med || '-')}</td><td>${esc(symptom.location || '-')}</td></tr>`).join('')}</tbody>
              </table>
            </div>`).join('')
          : `<p style="color:#9ca3af;font-size:11px;margin:0">${esc(t('export.docs.no_symptoms_period'))}</p>`}
      </div>

      <div class="section">
        <h2>${esc(t('export.docs.clinical_flags'))}</h2>
        ${data.flags.length
          ? `<ul style="margin:0;padding-left:16px;font-size:11px;color:#111827;line-height:1.8">${data.flags.map(flag => `<li><strong>${esc(flag.label)}:</strong> ${esc(flag.detail)}</li>`).join('')}</ul>`
          : `<p style="color:#059669;font-size:11px;font-weight:700;margin:0">OK ${esc(t('export.docs.no_clinical_flags'))}</p>`}
      </div>

      <div class="section">
        <h2>${esc(t('export.docs.data_quality_confidence'))}</h2>
        <div style="margin-bottom:10px">
          <span style="padding:4px 10px;border-radius:4px;font-size:10px;font-weight:900;background:${data.stats.confidence.bg};color:${data.stats.confidence.color}">
            ${esc(t('export.docs.confidence_label'))}: ${esc(data.stats.confidence.label)} (${data.stats.fullyPct}% ${esc(t('export.docs.fully_recorded').toLowerCase())})
          </span>
        </div>
        <div class="qual-grid">
          ${qualityCard(data.stats.fullyRecorded, t('export.docs.fully_recorded'))}
          ${qualityCard(data.stats.partialRecorded, t('export.docs.partial'))}
          ${qualityCard(data.stats.untagged, t('export.docs.untagged'))}
          ${qualityCard(data.stats.autoStoppedCount, t('export.docs.auto_stopped'))}
          ${qualityCard(data.stats.editedCount, t('export.docs.edited'))}
        </div>
      </div>

      <div class="disclaimer">
        ${esc(t('export.docs.disclaimer_intro', { version: data.version }))}<br>
        ${esc(t('export.docs.disclaimer_medical'))}<br>
        ${esc(t('export.docs.disclaimer_edited'))}
      </div>
    </div>
  `;

  return {
    title: `${t('export.neuro_report_label')} - ${data.settings.personName || t('export.docs.patient')}`,
    styles,
    html,
  };
}

export function renderSeizureDiaryHtml(data) {
  const t = translator();
  const styles = buildPreviewStyles(`
    @page { size: A4 landscape; margin: 12mm 14mm; }
    .auratrack-diary-preview,
    .auratrack-diary-preview * { box-sizing: border-box; }
    .auratrack-diary-preview {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      color: #111827;
    }
  `);

  const html = `
    <div class="auratrack-diary-preview">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px;border-bottom:3px solid #dc2626;padding-bottom:8px;gap:12px">
        <div>
          <div style="font-size:8px;font-weight:900;letter-spacing:0.4em;color:#dc2626;text-transform:uppercase">AuraTrack</div>
          <div style="font-size:20px;font-weight:900;letter-spacing:-0.3px">${esc(data.monthName)} - ${esc(t('export.diary_title'))}</div>
        </div>
        <div style="text-align:right">
          ${data.patientName ? `<div style="font-weight:800;font-size:12px">${esc(data.patientName)}</div>` : ''}
          <div style="font-size:10px;color:#6b7280">${esc(t('export.docs.events_recorded_this_month', { count: data.totalEvents }))}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">
        ${data.weekdayLabels.map(label => `<div style="text-align:center;font-size:9px;font-weight:900;text-transform:uppercase;color:#6b7280;padding:3px 0">${esc(label)}</div>`).join('')}
      </div>

      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
        ${data.cells.map(cell => cell.kind === 'empty'
          ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;min-height:64px"></div>`
          : `<div style="background:${cell.eventCount > 0 ? '#fff' : '#f9fafb'};border:${cell.eventCount > 0 ? '2px solid #fca5a5' : '1px solid #e5e7eb'};border-radius:6px;min-height:64px;padding:5px;display:flex;flex-direction:column">
              <span style="font-size:11px;font-weight:${cell.eventCount > 0 ? 900 : 400};color:${cell.eventCount > 0 ? '#111827' : '#9ca3af'}">${cell.dayNum}</span>
              <div style="flex:1">${cell.types.map(type => `<div style="display:flex;align-items:center;gap:3px;margin-top:2px"><span style="background:${type.color};color:#fff;border-radius:3px;padding:1px 4px;font-size:8px;font-weight:900;min-width:18px;text-align:center;line-height:1.4">${type.count}</span><span style="font-size:8px;font-weight:800;color:${type.color}">${esc(type.abbrev)}</span></div>`).join('')}</div>
              ${cell.hasTriggers ? `<div style="font-size:7px;color:#d97706;font-weight:800;margin-top:2px">▲ ${esc(t('export.docs.trigger_reported'))}</div>` : ''}
            </div>`).join('')}
      </div>

      <div style="margin-top:10px;padding-top:8px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px">
        <div>
          <span style="font-size:8px;font-weight:900;text-transform:uppercase;color:#9ca3af;margin-right:6px">${esc(t('export.docs.legend'))}:</span>
          ${data.legendTypes.length
            ? data.legendTypes.map(type => `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;font-size:10px"><span style="background:${type.color};color:#fff;border-radius:3px;padding:1px 4px;font-size:8px;font-weight:900">${esc(type.abbrev)}</span>${esc(type.type)}</span>`).join('')
            : `<span style="font-size:10px;color:#9ca3af">${esc(t('export.docs.no_events'))}</span>`}
        </div>
        ${data.medicationsLine ? `<div style="font-size:9px;color:#374151;max-width:400px">${esc(t('export.docs.medications_label'))}: ${esc(data.medicationsLine)}</div>` : ''}
      </div>
      ${data.medicationChangesLines?.length ? `
        <div style="margin-top:6px;font-size:9px;color:#374151">
          <strong>${esc(t('export.docs.medication_changes'))}:</strong>
          ${data.medicationChangesLines.map(line => `<div>${esc(line)}</div>`).join('')}
        </div>
      ` : ''}

      <div style="margin-top:6px;font-size:8px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:6px">
        ${esc(t('export.docs.diary_footer', { date: data.generatedDate }))}
      </div>
    </div>
  `;

  return {
    title: `AuraTrack Seizure Diary - ${data.monthName}`,
    styles,
    html,
  };
}

export function renderEegDiaryHtml(data) {
  const t = translator();
  const styles = buildPreviewStyles(`
    .auratrack-eeg-report {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #111827;
      font-size: 11px;
    }
    .auratrack-eeg-report table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .auratrack-eeg-report th,
    .auratrack-eeg-report td {
      border: 1px solid #d1d5db;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
      overflow-wrap: anywhere;
    }
    .auratrack-eeg-report th {
      background: #1e293b;
      color: #fff;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
  `);

  const html = `
    <div class="auratrack-eeg-report">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;border-bottom:3px solid #dc2626;padding-bottom:8px;gap:12px">
        <div>
          <div style="font-size:8px;font-weight:900;letter-spacing:0.4em;color:#dc2626;text-transform:uppercase">AuraTrack</div>
          <div style="font-size:18px;font-weight:900;letter-spacing:-0.3px">${esc(t('eeg.report_title', 'EEG Diary Report'))}</div>
          <div style="font-size:10px;color:#6b7280;margin-top:4px">${esc(t('export.docs.generated'))}: ${esc(data.generatedDate)}</div>
        </div>
        ${data.session ? `<div style="text-align:right;font-size:10px;color:#374151">
          <div><strong>${esc(data.session.title)}</strong></div>
          <div>${esc(data.session.startLabel)} - ${esc(data.session.endLabel)}</div>
          <div>${esc(data.session.status)}</div>
        </div>` : ''}
      </div>

      ${data.session?.notes ? `<div style="margin-bottom:10px;padding:8px 10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px">${esc(data.session.notes)}</div>` : ''}

      <table>
        <thead>
          <tr>
            <th>${esc(t('eeg.type', 'Type'))}</th>
            <th>${esc(t('eeg.activity', 'Activity'))}</th>
            <th>${esc(t('eeg.mood_label', 'Mood'))}</th>
            <th>${esc(t('eeg.started', 'Started'))}</th>
            <th>${esc(t('eeg.end', 'End'))}</th>
            <th>${esc(t('export.docs.duration'))}</th>
            <th>${esc(t('eeg.notes_or_reference', 'Notes / Seizure Ref'))}</th>
          </tr>
        </thead>
        <tbody>
          ${data.activities.length
            ? data.activities.map(activity => `<tr>
                <td>${esc(activity.kind === 'SEIZURE_REFERENCE' ? t('eeg.seizure_type', 'Seizure') : t('eeg.activity_type', 'Activity'))}</td>
                <td>${esc([activity.activityLabel, activity.customActivityText].filter(Boolean).join(' - '))}</td>
                <td>${esc(activity.moodLabel || '-')}</td>
                <td>${esc(activity.startLabel)}</td>
                <td>${esc(activity.endLabel)}</td>
                <td>${esc(activity.durationLabel)}</td>
                <td>${esc(activity.seizureRef || activity.notes || '-')}</td>
              </tr>`).join('')
            : `<tr><td colspan="7" style="color:#9ca3af">${esc(t('eeg.no_activities', 'No EEG activities logged for this session.'))}</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  return {
    title: `AuraTrack ${t('eeg.report_title', 'EEG Diary Report')}`,
    styles,
    html,
  };
}

function buildPreviewStyles(documentStyles) {
  return `
    @page { size: A4; margin: 18mm 16mm; }
    .auratrack-print-preview {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: #e5e7eb;
      display: flex;
      flex-direction: column;
    }
    .auratrack-print-preview-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: calc(env(safe-area-inset-top) + 12px) calc(env(safe-area-inset-right) + 16px) 12px calc(env(safe-area-inset-left) + 16px);
      background: #111827;
      color: #fff;
    }
    .auratrack-print-preview-document {
      flex: 1;
      overflow: auto;
      padding: 16px;
    }
    .auratrack-print-preview-sheet {
      width: min(100%, 960px);
      margin: 0 auto;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.18);
      padding: 24px;
    }
    ${documentStyles}
    @media print {
      body { background: #fff !important; }
      .auratrack-print-preview-toolbar { display: none !important; }
      .auratrack-print-preview {
        position: static !important;
        inset: auto !important;
        background: #fff !important;
        display: block !important;
      }
      .auratrack-print-preview-document {
        overflow: visible !important;
        padding: 0 !important;
      }
      .auratrack-print-preview-sheet {
        width: auto !important;
        margin: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        padding: 0 !important;
      }
    }
  `;
}

function renderMedicationSection(data) {
  const t = translator();
  if (!data.medications.length) return '';
  return `
    <div class="section">
      <h2>${esc(t('export.docs.current_medications'))}</h2>
      <table>
        <thead><tr><th>${esc(t('export.docs.drug'))}</th><th>${esc(t('export.docs.dose'))}</th><th>${esc(t('export.docs.frequency'))}</th></tr></thead>
        <tbody>${data.medications.map(med => `<tr><td><span style="font-weight:700">${esc(med.name)}</span>${med.detail ? `<br><span style="font-size:10px;color:#6b7280">${esc(med.detail)}</span>` : ''}${med.stoppedLabel ? `<br><span style="font-size:10px;color:#b91c1c;font-weight:700">${esc(med.stoppedLabel)}</span>` : ''}</td><td>${esc(med.doseLabel)}</td><td>${esc(med.frequency)} - ${esc(med.frequencyLabel)}</td></tr>`).join('')}</tbody>
      </table>
      ${data.stats.medicationLogsCount > 0
        ? `<p style="font-size:10px;color:#374151;margin-top:8px"><strong>${esc(t('export.docs.doses_logged', { count: data.stats.medicationLogsCount }))}</strong>${data.stats.expectedDoses > 0 ? ` ${esc(t('export.docs.expected_doses', { count: data.stats.expectedDoses }))}` : ''}.</p>
           <p style="font-size:10px;color:#374151;margin-top:4px">${esc(t('export.docs.adherence_line', data.stats.adherence))}</p>
           ${data.stats.adherence.assumed > 0 ? `<p style="font-size:9px;color:#6b7280;margin-top:2px">${esc(t('export.docs.assumed_note'))}</p>` : ''}`
        : `<p style="font-size:10px;color:#9ca3af;margin-top:8px">${esc(t('export.docs.no_dose_logs'))}</p>`}
    </div>
  `;
}

function renderMedicationChangesTable(rows) {
  const t = translator();
  return `
    <table>
      <thead><tr><th>${esc(t('export.docs.change_when'))}</th><th>${esc(t('export.docs.drug'))}</th><th>${esc(t('export.docs.change_what'))}</th><th>${esc(t('export.docs.notes'))}</th></tr></thead>
      <tbody>${rows.map(row => `<tr>
        <td>${esc(row.dateLabel)}<br><span style="font-size:10px;color:#6b7280">${esc(row.timeLabel)}</span></td>
        <td><span style="font-weight:700">${esc(row.medication)}</span>${row.medicationDetail ? `<br><span style="font-size:10px;color:#6b7280">${esc(row.medicationDetail)}</span>` : ''}</td>
        <td><span style="font-weight:700">${esc(row.typeLabel)}</span>${row.lines.map(line => `<br>${esc(line)}`).join('')}</td>
        <td>${esc(row.note)}</td>
      </tr>`).join('')}</tbody>
    </table>
  `;
}

function renderMedicationChangesSection(data) {
  const t = translator();
  if (!data.medicationChanges?.length) return '';
  return `
    <div class="section">
      <h2>${esc(t('export.docs.medication_changes'))}</h2>
      ${renderMedicationChangesTable(data.medicationChanges)}
    </div>
  `;
}

function renderWellbeingSection(data) {
  const t = translator();
  const wellbeing = data.wellbeing || {};
  return `
    <div class="section">
      <h2>${esc(t('export.docs.wellbeing_context', 'Wellbeing Context'))}</h2>
      <div class="ctx-grid">
        <div class="ctx-item">
          <div class="ctx-label">${esc(t('export.docs.wellbeing_entries', 'Wellbeing entries'))}</div>
          <div class="ctx-value">${esc(String(wellbeing.entriesCount || 0))}</div>
        </div>
        <div class="ctx-item">
          <div class="ctx-label">${esc(t('export.docs.wellbeing_days', 'Days covered'))}</div>
          <div class="ctx-value">${esc(String(wellbeing.daysCovered || 0))}</div>
        </div>
        <div class="ctx-item">
          <div class="ctx-label">${esc(t('export.docs.wellbeing_top_moods', 'Top moods'))}</div>
          <div class="ctx-value">${wellbeing.topMoods?.length ? esc(wellbeing.topMoods.map(item => `${item.label} (${item.count}x)`).join(', ')) : esc(t('export.docs.not_recorded'))}</div>
        </div>
        <div class="ctx-item">
          <div class="ctx-label">${esc(t('export.docs.wellbeing_top_factors', 'Top context factors'))}</div>
          <div class="ctx-value">${wellbeing.topFactors?.length ? esc(wellbeing.topFactors.map(item => `${item.label} (${item.count}x)`).join(', ')) : esc(t('export.docs.not_recorded'))}</div>
        </div>
      </div>
      ${wellbeing.recentEntries?.length ? `
        <table style="margin-top:10px">
          <thead><tr>
            <th>${esc(t('export.docs.date'))}</th>
            <th>${esc(t('export.docs.time'))}</th>
            <th>${esc(t('wellbeing.mood', 'Mood'))}</th>
            <th>${esc(t('wellbeing.intensity', 'Intensity'))}</th>
            <th>${esc(t('wellbeing.context', 'Context'))}</th>
          </tr></thead>
          <tbody>${wellbeing.recentEntries.map(entry => `<tr>
            <td>${esc(entry.date)}</td>
            <td>${esc(entry.time)}</td>
            <td style="font-weight:700">${esc(entry.primaryMood)}</td>
            <td>${esc(entry.intensityLabel)}</td>
            <td>${esc(entry.factors?.length ? entry.factors.join('; ') : '-')}</td>
          </tr>`).join('')}</tbody>
        </table>
      ` : `<p style="font-size:10px;color:#9ca3af;margin:8px 0 0">${esc(t('export.docs.no_wellbeing_entries', 'No wellbeing entries recorded in this period.'))}</p>`}
    </div>
  `;
}

function qualityCard(value, label) {
  return `<div class="qual-item"><div class="qual-num">${value}</div><div class="qual-label">${esc(label)}</div></div>`;
}

function metricCard(label, value, background, color) {
  return `<div style="text-align:center;padding:5px;background:${background};border-radius:5px"><div style="font-size:8px;color:${color};text-transform:uppercase;font-weight:700">${esc(label)}</div><div style="font-size:12px;font-weight:900;color:${color}">${esc(value)}</div></div>`;
}

function shortMode(mode) {
  if (!mode) return '';
  return mode === 'CARETAKER' ? 'CT' : 'SE';
}

function translator() {
  return (key, options) => i18n.t(key, options);
}
