import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import i18n from '../i18n';
import { durationLineSVG, freqBarChartSVG, phaseStackSVG, typeBarSVG, wellbeingCorrelationSVG } from '../utils/pdfCharts';

const COLORS = {
  ink: [17, 24, 39],
  muted: [107, 114, 128],
  soft: [156, 163, 175],
  line: [229, 231, 235],
  panel: [249, 250, 251],
  accent: [220, 38, 38],
  slate: [30, 41, 59],
  blue: [37, 99, 235],
  amber: [217, 119, 6],
  green: [5, 150, 105],
};

export async function downloadEventLogPdf(data) {
  const t = translator();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();

  drawBrandHeader(doc, {
    margin,
    top: 34,
    title: t('export.docs.event_log_title'),
    subtitleLines: [data.generatedDate],
  });

  autoTable(doc, {
    startY: 86,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 6, overflow: 'linebreak', valign: 'top', textColor: COLORS.ink },
    alternateRowStyles: { fillColor: [252, 252, 253] },
    headStyles: { fillColor: COLORS.slate, textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 54 },
      2: { cellWidth: 86 },
      3: { cellWidth: 62 },
      4: { cellWidth: pageWidth - margin * 2 - 272 },
    },
    head: [[
      t('export.docs.date'),
      t('export.docs.time'),
      t('export.docs.type'),
      t('export.docs.duration'),
      t('export.docs.notes'),
    ]],
    body: data.events.flatMap(event => {
      const rows = [[event.date, event.time, event.type, event.durationLabel, stripHtml(event.notesHtml)]];
      if (event.symptoms.length) {
        rows.push([{ content: event.symptoms.map(symptom => symptom.combined).join(' | '), colSpan: 5, styles: { fontStyle: 'italic', fillColor: COLORS.panel, textColor: [75, 85, 99] } }]);
      }
      return rows;
    }),
  });

  if (data.medicationChanges?.length) {
    const cursorY = ensurePageRoom(doc, doc.lastAutoTable.finalY + 24, 80);
    drawSectionTitle(doc, t('export.docs.medication_changes'), margin, cursorY, pageWidth - margin);
    drawMedicationChangesTable(doc, data.medicationChanges, t, margin, cursorY + 10);
  }

  return savePdfDocument(doc, `auratrack-event-log-${dateStamp()}.pdf`);
}

export async function downloadNeurologistReportPdf(data) {
  const t = translator();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let cursorY = 42;
  const [freqChart, durationChart, typeChart, phaseChart, wellbeingChart] = await Promise.all([
    renderSvgChart(freqBarChartSVG(data.charts.periodEvents, data.periodDays, data.charts.periodEndMs)),
    renderSvgChart(durationLineSVG(data.charts.periodEvents, data.periodDays)),
    renderSvgChart(typeBarSVG(data.charts.byType, data.charts.totalEvents)),
    renderSvgChart(phaseStackSVG(data.charts.periodEvents, 10)),
    renderSvgChart(wellbeingCorrelationSVG(data.charts.periodEvents, data.charts.wellbeingEntries, data.periodDays, data.charts.periodEndMs)),
  ]);

  cursorY = drawBrandHeader(doc, {
    margin,
    top: cursorY - 8,
    title: t('export.docs.neurological_report'),
    subtitleLines: [
      `${t('export.docs.generated')}: ${data.generatedDate}`,
      `${t('export.docs.period')}: ${data.periodStartStr} - ${data.periodEndStr} (${t('export.docs.selected_days', { count: data.periodDays })})`,
    ],
    rightTitle: t('export.docs.prepared_by'),
    rightValue: data.settings.reporterLabel || '-',
    rightMeta: [
      data.settings.neurologistName ? `${t('export.docs.for_label')}: ${data.settings.neurologistName}` : '',
      data.settings.neurologistInstitution || '',
      data.settings.neurologistContact || '',
    ].filter(Boolean),
  }) + 16;

  cursorY = ensurePageRoom(doc, cursorY, 118);
  const metaCardWidth = (pageWidth - margin * 2 - 12) / 2;
  const metaHeight = 94;
  drawMetaCard(doc, {
    x: margin,
    y: cursorY,
    width: metaCardWidth,
    height: metaHeight,
    label: t('export.docs.patient'),
    value: data.settings.subjectLabel || '-',
    lines: [
      data.settings.includePatientDOB && data.settings.dateOfBirth
        ? `${t('export.docs.dob')}: ${new Date(data.settings.dateOfBirth).toLocaleDateString(data.locale, { day: '2-digit', month: 'long', year: 'numeric' })}`
        : '',
      data.settings.emergencyContact ? `${t('export.docs.emergency')}: ${data.settings.emergencyContact}` : '',
    ].filter(Boolean),
  });
  drawMetaCard(doc, {
    x: margin + metaCardWidth + 12,
    y: cursorY,
    width: metaCardWidth,
    height: metaHeight,
    label: t('export.docs.report_summary'),
    value: `${data.stats.totalEvents} ${t('export.docs.events_in_period', { count: data.stats.totalEvents })}`,
    lines: [
      `${data.stats.daysCovered} ${t('export.docs.days_with_recorded_events', { count: data.stats.daysCovered })}`,
      `${t('export.docs.avg_duration')}: ${data.stats.avgDurationLabel}`,
    ],
  });
  cursorY += metaHeight + 14;

  cursorY = ensurePageRoom(doc, cursorY, 70);
  const statGap = 8;
  const statWidth = (pageWidth - margin * 2 - statGap * 3) / 4;
  const statY = cursorY;
  [
    [String(data.stats.totalEvents), t('export.docs.events_period', { count: data.periodDays })],
    [data.stats.avgDurationLabel === '-' ? '0s' : data.stats.avgDurationLabel, t('export.docs.avg_duration')],
    [String(data.stats.daysCovered), t('export.docs.days_affected')],
    [String(data.stats.seizureTypeCount), t('export.docs.seizure_types')],
  ].forEach(([value, label], index) => {
    drawStatCard(doc, margin + index * (statWidth + statGap), statY, statWidth, 58, value, label);
  });
  cursorY += 74;

  if (data.medications.length) {
    cursorY = ensurePageRoom(doc, cursorY, 80);
    drawSectionTitle(doc, t('export.docs.current_medications'), margin, cursorY, pageWidth - margin);
    autoTable(doc, {
      startY: cursorY + 10,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 5, overflow: 'linebreak', textColor: COLORS.ink },
      alternateRowStyles: { fillColor: [252, 252, 253] },
      headStyles: { fillColor: COLORS.slate, textColor: 255, fontStyle: 'bold' },
      head: [[t('export.docs.drug'), t('export.docs.dose'), t('export.docs.frequency')]],
      body: data.medications.map(med => [
        [med.name, med.detail, med.stoppedLabel].filter(Boolean).join('\n'),
        med.doseLabel,
        `${med.frequency} - ${med.frequencyLabel}`,
      ]),
    });
    cursorY = doc.lastAutoTable.finalY + 14;
    if (data.stats.medicationLogsCount > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(55, 65, 81);
      const adherenceLines = [
        `${t('export.docs.doses_logged', { count: data.stats.medicationLogsCount })}${data.stats.expectedDoses > 0 ? ` ${t('export.docs.expected_doses', { count: data.stats.expectedDoses })}` : ''}.`,
        t('export.docs.adherence_line', data.stats.adherence),
        ...(data.stats.adherence.assumed > 0 ? [t('export.docs.assumed_note')] : []),
      ].flatMap(line => doc.splitTextToSize(line, pageWidth - margin * 2));
      doc.text(adherenceLines, margin, cursorY);
      cursorY += adherenceLines.length * 10 + 8;
    }
  }

  if (data.medicationChanges?.length) {
    cursorY = ensurePageRoom(doc, cursorY, 80);
    drawSectionTitle(doc, t('export.docs.medication_changes'), margin, cursorY, pageWidth - margin);
    cursorY = drawMedicationChangesTable(doc, data.medicationChanges, t, margin, cursorY + 10) + 16;
  }

  cursorY = ensurePageRoom(doc, cursorY, 100);
  drawSectionTitle(doc, t('export.docs.recent_events', { count: data.recentEvents.length }), margin, cursorY, pageWidth - margin);
  autoTable(doc, {
    startY: cursorY + 10,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 5, overflow: 'linebreak', valign: 'top', textColor: COLORS.ink },
    alternateRowStyles: { fillColor: [252, 252, 253] },
    headStyles: { fillColor: COLORS.slate, textColor: 255, fontStyle: 'bold' },
    head: [[
      '#',
      t('export.docs.date'),
      t('export.docs.time'),
      t('export.docs.type'),
      t('export.docs.total'),
      t('export.docs.aura'),
      t('export.docs.seizure'),
      t('export.docs.recovery'),
      t('export.docs.notes'),
      t('export.docs.edited'),
      t('export.docs.recorded_by'),
    ]],
    body: data.recentEvents.map(event => [
      event.index,
      event.date,
      event.time,
      event.type,
      event.totalLabel,
      event.auraLabel,
      event.seizureLabel,
      event.recoveryLabel,
      event.hasNote ? 'Y' : '',
      event.isEdited ? 'Y' : '',
      event.userModeAtTime === 'CARETAKER' ? 'CT' : event.userModeAtTime === 'SELF' ? 'SE' : '',
    ]),
  });

  cursorY = doc.lastAutoTable.finalY + 16;

  cursorY = ensurePageRoom(doc, cursorY, 130);
  drawSectionTitle(doc, t('export.docs.medication_context'), margin, cursorY, pageWidth - margin);
  cursorY += 10;
  const contextGap = 8;
  const contextWidth = (pageWidth - margin * 2 - contextGap) / 2;
  const contextHeight = 54;
  const contextItems = [
    {
      label: t('export.docs.awareness_levels'),
      value: data.stats.awarenessTotal > 0
        ? `${t('export.docs.fully_awake')}: ${data.stats.awareness.awake} | ${t('export.docs.confused')}: ${data.stats.awareness.confused} | ${t('export.docs.blackout')}: ${data.stats.awareness.blackout}`
        : t('export.docs.not_recorded'),
    },
    { label: t('export.docs.recovery_quality'), value: data.stats.postIctalSummary || t('export.docs.post_ictal_none', 'No after-seizure symptoms recorded') },
    { label: t('export.docs.rescue_medication_use'), value: t('export.docs.not_recorded') },
    { label: t('export.docs.triggers_medications'), value: data.reportNotes || t('export.docs.not_recorded') },
  ];
  contextItems.forEach((item, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    drawContextCard(
      doc,
      margin + col * (contextWidth + contextGap),
      cursorY + row * (contextHeight + contextGap),
      contextWidth,
      contextHeight,
      item.label,
      item.value,
    );
  });
  cursorY += contextHeight * 2 + contextGap + 16;

  cursorY = drawWellbeingContext(doc, data, t, margin, cursorY, pageWidth);

  if (data.flags.length) {
    cursorY = ensurePageRoom(doc, cursorY, 90 + data.flags.length * 44);
    drawSectionTitle(doc, t('export.docs.clinical_flags'), margin, cursorY, pageWidth - margin);
    cursorY += 14;
    data.flags.forEach(flag => {
      cursorY = ensurePageRoom(doc, cursorY, 52);
      cursorY = drawFlagCard(doc, margin, cursorY, pageWidth - margin * 2, flag);
      cursorY += 8;
    });
  }

  cursorY = ensurePageRoom(doc, cursorY, 360);
  drawSectionTitle(doc, t('export.docs.trend_analysis'), margin, cursorY, pageWidth - margin);
  cursorY += 12;
  cursorY = await drawChartBlock(doc, margin, cursorY, pageWidth - margin * 2, freqChart, 150);
  cursorY += 10;
  cursorY = ensurePageRoom(doc, cursorY, 160);
  cursorY = await drawChartBlock(doc, margin, cursorY, pageWidth - margin * 2, durationChart, 150);
  cursorY += 10;
  cursorY = ensurePageRoom(doc, cursorY, 245);
  cursorY = await drawChartBlock(doc, margin, cursorY, pageWidth - margin * 2, wellbeingChart, 235);
  cursorY += 10;
  cursorY = ensurePageRoom(doc, cursorY, 170);
  const halfWidth = (pageWidth - margin * 2 - 10) / 2;
  const chartRowHeight = Math.max(typeChart.height * (halfWidth / typeChart.width), phaseChart.height * (halfWidth / phaseChart.width)) + 18;
  drawChartCard(doc, margin, cursorY, halfWidth, chartRowHeight, typeChart);
  drawChartCard(doc, margin + halfWidth + 10, cursorY, halfWidth, chartRowHeight, phaseChart);
  cursorY += chartRowHeight + 16;

  if (data.detailEvents.length) {
    cursorY = ensurePageRoom(doc, cursorY, 120);
    drawSectionTitle(doc, t('export.docs.condensed_event_details'), margin, cursorY, pageWidth - margin);
    cursorY += 12;
    data.detailEvents.forEach(event => {
      cursorY = ensurePageRoom(doc, cursorY, estimateDetailEventCardHeight(doc, pageWidth - margin * 2, event, t) + 10);
      cursorY = drawDetailEventCard(doc, margin, cursorY, pageWidth - margin * 2, event, t) + 10;
    });
  }

  if (data.symptomLogGroups.length) {
    cursorY = ensurePageRoom(doc, cursorY, 100);
    drawSectionTitle(doc, t('export.docs.ictal_symptom_log'), margin, cursorY, pageWidth - margin);
    cursorY += 12;
    data.symptomLogGroups.forEach(group => {
      const groupRows = group.symptoms.map(symptom => [symptom.path || '-', symptom.med || '-', symptom.location || '-']);
      const estimatedHeight = estimateSymptomGroupHeight(groupRows);
      cursorY = ensurePageRoom(doc, cursorY, estimatedHeight);
      drawSymptomGroupHeader(doc, margin, cursorY, pageWidth - margin * 2, group, t);
      autoTable(doc, {
        startY: cursorY + 44,
        margin: { left: margin + 8, right: margin + 8 },
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 4, overflow: 'linebreak', valign: 'top', textColor: COLORS.ink },
        alternateRowStyles: { fillColor: [252, 252, 253] },
        headStyles: { fillColor: [241, 245, 249], textColor: COLORS.ink, fontStyle: 'bold' },
        head: [[
          t('export.docs.symptom_path'),
          t('export.docs.medical_term'),
          t('export.docs.location'),
        ]],
        body: groupRows,
        tableWidth: pageWidth - margin * 2 - 16,
        pageBreak: groupRows.length <= 8 ? 'avoid' : 'auto',
        rowPageBreak: 'avoid',
      });
      cursorY = doc.lastAutoTable.finalY + 14;
    });
  }

  cursorY = ensurePageRoom(doc, cursorY, 114);
  drawSectionTitle(doc, t('export.docs.data_quality_confidence'), margin, cursorY, pageWidth - margin);
  cursorY += 14;
  drawConfidenceBanner(doc, margin, cursorY, pageWidth - margin * 2, data, t);
  cursorY += 36;
  const qualityWidth = (pageWidth - margin * 2 - 8 * 4) / 5;
  [
    [String(data.stats.fullyRecorded), t('export.docs.fully_recorded')],
    [String(data.stats.partialRecorded), t('export.docs.partial')],
    [String(data.stats.untagged), t('export.docs.untagged')],
    [String(data.stats.autoStoppedCount), t('export.docs.auto_stopped')],
    [String(data.stats.editedCount), t('export.docs.edited')],
  ].forEach(([value, label], index) => {
    drawQualityCard(doc, margin + index * (qualityWidth + 8), cursorY, qualityWidth, 52, value, label);
  });
  cursorY += 70;

  const footer = [
    t('export.docs.disclaimer_intro', { version: data.version }),
    t('export.docs.disclaimer_medical'),
    t('export.docs.disclaimer_edited'),
  ];
  cursorY = ensurePageRoom(doc, cursorY, 52);
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  footer.forEach(line => {
    const split = doc.splitTextToSize(line, pageWidth - margin * 2);
    doc.text(split, margin, cursorY);
    cursorY += split.length * 9 + 2;
  });

  addPageNumbers(doc);
  return savePdfDocument(doc, `auratrack-neurologist-report-${dateStamp()}.pdf`);
}

export async function downloadSeizureDiaryPdf(data) {
  const t = translator();
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 28;
  const headerY = 34;

  drawBrandHeader(doc, {
    margin,
    top: headerY - 10,
    title: `${data.monthName} - ${t('export.diary_title')}`,
    subtitleLines: [],
    rightTitle: data.patientName ? t('export.docs.patient') : '',
    rightValue: data.patientName || '',
    rightMeta: [t('export.docs.events_recorded_this_month', { count: data.totalEvents })],
  });
  if (data.patientName) {
    // patient line handled in brand header
  }

  const gridTop = 94;
  const weekdayHeight = 18;
  const gridGap = 4;
  const columns = 7;
  const cellWidth = (pageWidth - margin * 2 - gridGap * (columns - 1)) / columns;
  const gridHeight = 360;
  const rows = data.rows;
  const cellHeight = (gridHeight - weekdayHeight - gridGap * rows) / rows;

  data.weekdayLabels.forEach((label, index) => {
    const x = margin + index * (cellWidth + gridGap);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(label.toUpperCase(), x + cellWidth / 2, gridTop, { align: 'center' });
  });

  data.cells.forEach((cell, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x = margin + column * (cellWidth + gridGap);
    const y = gridTop + weekdayHeight + row * (cellHeight + gridGap);

    if (cell.kind === 'empty') {
      doc.setDrawColor(...COLORS.line);
      doc.setFillColor(...COLORS.panel);
      doc.roundedRect(x, y, cellWidth, cellHeight, 4, 4, 'FD');
      return;
    }

    doc.setDrawColor(cell.eventCount > 0 ? 252 : 229, cell.eventCount > 0 ? 165 : 231, cell.eventCount > 0 ? 165 : 235);
    doc.setFillColor(cell.eventCount > 0 ? 255 : 249, cell.eventCount > 0 ? 255 : 250, cell.eventCount > 0 ? 255 : 251);
    doc.roundedRect(x, y, cellWidth, cellHeight, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(cell.eventCount > 0 ? 17 : 156, cell.eventCount > 0 ? 24 : 163, cell.eventCount > 0 ? 39 : 175);
    doc.text(String(cell.dayNum), x + 6, y + 12);

    let badgeY = y + 24;
    cell.types.forEach(type => {
      doc.setFillColor(...hexToRgb(type.color));
      doc.roundedRect(x + 6, badgeY - 7, 16, 12, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text(String(type.count), x + 14, badgeY + 1, { align: 'center' });
      doc.setTextColor(...hexToRgb(type.color));
      doc.setFont('helvetica', 'bold');
      doc.text(type.abbrev, x + 28, badgeY + 1);
      badgeY += 12;
    });

    if (cell.hasTriggers) {
      doc.setTextColor(217, 119, 6);
      doc.setFontSize(7);
      doc.text(`▲ ${t('export.docs.trigger_reported')}`, x + 6, y + cellHeight - 8);
    }
  });

  let footerY = gridTop + weekdayHeight + rows * (cellHeight + gridGap) + 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.soft);
  doc.text(`${t('export.docs.legend')}:`, margin, footerY);

  let legendX = margin + 36;
  data.legendTypes.forEach(type => {
    const labelWidth = doc.getTextWidth(type.type);
    if (legendX + 22 + labelWidth > pageWidth - margin) {
      footerY += 14;
      legendX = margin + 36;
    }
    doc.setFillColor(...hexToRgb(type.color));
    doc.roundedRect(legendX, footerY - 7, 16, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.text(type.abbrev, legendX + 8, footerY, { align: 'center' });
    legendX += 22;
    doc.setTextColor(55, 65, 81);
    doc.setFontSize(8);
    doc.text(type.type, legendX, footerY);
    legendX += doc.getTextWidth(type.type) + 12;
  });

  footerY += 14;
  if (data.medicationsLine) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    const split = doc.splitTextToSize(`${t('export.docs.medications_label')}: ${data.medicationsLine}`, pageWidth - margin * 2);
    doc.text(split, margin, footerY);
    footerY += split.length * 9 + 4;
  }
  if (data.medicationChangesLines?.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    const split = doc.splitTextToSize(`${t('export.docs.medication_changes')}: ${data.medicationChangesLines.join(' | ')}`, pageWidth - margin * 2);
    doc.text(split, margin, footerY);
    footerY += split.length * 9 + 4;
  }

  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  const footerText = t('export.docs.diary_footer', { date: data.generatedDate });
  doc.text(doc.splitTextToSize(footerText, pageWidth - margin * 2), margin, footerY);

  return savePdfDocument(doc, `auratrack-seizure-diary-${data.year}-${String(data.month).padStart(2, '0')}.pdf`);
}

export async function downloadEegDiaryPdf(data) {
  const t = translator();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  drawBrandHeader(doc, {
    margin,
    top: 26,
    title: t('eeg.report_title', 'EEG Diary Report'),
    subtitleLines: [`${t('export.docs.generated')}: ${data.generatedDate}`],
    rightTitle: data.session?.status || '',
    rightValue: data.session?.title || '',
    rightMeta: data.session ? [`${data.session.startLabel} - ${data.session.endLabel}`] : [],
  });

  if (data.session?.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    const split = doc.splitTextToSize(data.session.notes, doc.internal.pageSize.getWidth() - margin * 2);
    doc.text(split, margin, 98);
  }

  autoTable(doc, {
    startY: data.session?.notes ? 120 : 92,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 5, overflow: 'linebreak', textColor: COLORS.ink, valign: 'top' },
    alternateRowStyles: { fillColor: [252, 252, 253] },
    headStyles: { fillColor: COLORS.slate, textColor: 255, fontStyle: 'bold' },
    head: [[
      t('eeg.type', 'Type'),
      t('eeg.activity', 'Activity'),
      t('eeg.mood_label', 'Mood'),
      t('eeg.started', 'Started'),
      t('eeg.end', 'End'),
      t('export.docs.duration'),
      t('eeg.notes_or_reference', 'Notes / Seizure Ref'),
    ]],
    body: data.activities.length
      ? data.activities.map(activity => [
          activity.kind === 'SEIZURE_REFERENCE' ? t('eeg.seizure_type', 'Seizure') : t('eeg.activity_type', 'Activity'),
          [activity.activityLabel, activity.customActivityText].filter(Boolean).join(' - '),
          activity.moodLabel || '-',
          activity.startLabel,
          activity.endLabel,
          activity.durationLabel,
          activity.seizureRef || activity.notes || '-',
        ])
      : [['-', t('eeg.no_activities', 'No EEG activities logged for this session.'), '-', '-', '-', '-', '-']],
  });

  addPageNumbers(doc);
  return savePdfDocument(doc, `auratrack-eeg-diary-${dateStamp()}.pdf`);
}

// Returns the y position below the table
function drawMedicationChangesTable(doc, rows, t, margin, startY) {
  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 5, overflow: 'linebreak', valign: 'top', textColor: COLORS.ink },
    alternateRowStyles: { fillColor: [252, 252, 253] },
    headStyles: { fillColor: COLORS.slate, textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 72 },
      1: { cellWidth: 110 },
      3: { cellWidth: 110 },
    },
    head: [[t('export.docs.change_when'), t('export.docs.drug'), t('export.docs.change_what'), t('export.docs.notes')]],
    body: rows.map(row => [
      `${row.dateLabel}\n${row.timeLabel}`,
      [row.medication, row.medicationDetail].filter(Boolean).join('\n'),
      [row.typeLabel, ...row.lines].join('\n'),
      row.note,
    ]),
  });
  return doc.lastAutoTable.finalY;
}

function drawSectionTitle(doc, title, x, y, lineEndX) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  doc.text(title.toUpperCase(), x, y);
  doc.setDrawColor(...COLORS.line);
  doc.line(x, y + 4, lineEndX, y + 4);
}

function ensurePageRoom(doc, currentY, neededHeight) {
  if (currentY + neededHeight > doc.internal.pageSize.getHeight() - 36) {
    doc.addPage();
    return 42;
  }
  return currentY;
}

function drawBrandHeader(doc, { margin, top, title, subtitleLines = [], rightTitle = '', rightValue = '', rightMeta = [] }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.accent);
  doc.text('AURATRACK', margin, top + 10);

  doc.setFontSize(20);
  doc.setTextColor(...COLORS.ink);
  doc.text(title, margin, top + 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  subtitleLines.forEach((line, index) => {
    doc.text(line, margin, top + 44 + index * 11);
  });

  const ruleY = top + 50 + Math.max(0, subtitleLines.length - 1) * 11;
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(2);
  doc.line(margin, ruleY, pageWidth - margin, ruleY);

  if (rightTitle || rightValue || rightMeta.length) {
    const rightX = pageWidth - margin;
    if (rightTitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.muted);
      doc.text(rightTitle, rightX, top + 10, { align: 'right' });
    }
    if (rightValue) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...COLORS.ink);
      doc.text(rightValue, rightX, top + 23, { align: 'right' });
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    rightMeta.forEach((line, index) => {
      doc.text(line, rightX, top + 35 + index * 10, { align: 'right' });
    });
  }

  return ruleY + 18;
}

function drawMetaCard(doc, { x, y, width, height, label, value, lines = [] }) {
  doc.setDrawColor(...COLORS.line);
  doc.setFillColor(...COLORS.panel);
  doc.roundedRect(x, y, width, height, 8, 8, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.soft);
  doc.text(String(label).toUpperCase(), x + 12, y + 16);
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.ink);
  const valueLines = doc.splitTextToSize(value || '-', width - 24);
  doc.text(valueLines, x + 12, y + 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  let lineY = y + 54;
  lines.forEach(line => {
    const split = doc.splitTextToSize(line, width - 24);
    doc.text(split, x + 12, lineY);
    lineY += split.length * 10 + 2;
  });
}

function drawStatCard(doc, x, y, width, height, value, label) {
  doc.setFillColor(...COLORS.slate);
  doc.roundedRect(x, y, width, height, 8, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(value, x + width / 2, y + 24, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  doc.text(String(label).toUpperCase(), x + width / 2, y + 40, { align: 'center' });
}

function drawContextCard(doc, x, y, width, height, label, value) {
  doc.setDrawColor(...COLORS.line);
  doc.setFillColor(...COLORS.panel);
  doc.roundedRect(x, y, width, height, 8, 8, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.soft);
  doc.text(String(label).toUpperCase(), x + 10, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.ink);
  doc.text(doc.splitTextToSize(value || '-', width - 20), x + 10, y + 30);
}

function drawWellbeingContext(doc, data, t, margin, cursorY, pageWidth) {
  const wellbeing = data.wellbeing || {};
  cursorY = ensurePageRoom(doc, cursorY, wellbeing.recentEntries?.length ? 180 : 92);
  drawSectionTitle(doc, t('export.docs.wellbeing_context', 'Wellbeing Context'), margin, cursorY, pageWidth - margin);
  cursorY += 10;

  const gap = 8;
  const cardWidth = (pageWidth - margin * 2 - gap * 3) / 4;
  const cards = [
    [String(wellbeing.entriesCount || 0), t('export.docs.wellbeing_entries', 'Wellbeing entries')],
    [String(wellbeing.daysCovered || 0), t('export.docs.wellbeing_days', 'Days covered')],
    [
      wellbeing.topMoods?.length ? wellbeing.topMoods.map(item => `${item.label} (${item.count}x)`).join(', ') : t('export.docs.not_recorded'),
      t('export.docs.wellbeing_top_moods', 'Top moods'),
    ],
    [
      wellbeing.topFactors?.length ? wellbeing.topFactors.map(item => `${item.label} (${item.count}x)`).join(', ') : t('export.docs.not_recorded'),
      t('export.docs.wellbeing_top_factors', 'Top context factors'),
    ],
  ];

  cards.forEach(([value, label], index) => {
    drawContextCard(doc, margin + index * (cardWidth + gap), cursorY, cardWidth, 56, label, value);
  });
  cursorY += 70;

  if (wellbeing.recentEntries?.length) {
    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 5, overflow: 'linebreak', valign: 'top', textColor: COLORS.ink },
      alternateRowStyles: { fillColor: [252, 252, 253] },
      headStyles: { fillColor: COLORS.slate, textColor: 255, fontStyle: 'bold' },
      head: [[
        t('export.docs.date'),
        t('export.docs.time'),
        t('wellbeing.mood', 'Mood'),
        t('wellbeing.intensity', 'Intensity'),
        t('wellbeing.context', 'Context'),
      ]],
      body: wellbeing.recentEntries.map(entry => [
        entry.date,
        entry.time,
        entry.primaryMood,
        entry.intensityLabel,
        entry.factors?.length ? entry.factors.join('; ') : '-',
      ]),
    });
    cursorY = doc.lastAutoTable.finalY + 16;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(t('export.docs.no_wellbeing_entries', 'No wellbeing entries recorded in this period.'), margin, cursorY);
    cursorY += 16;
  }

  return cursorY;
}

function drawFlagCard(doc, x, y, width, flag) {
  const accent = flag.level === 'warning' ? COLORS.amber : COLORS.blue;
  const bodyLines = doc.splitTextToSize(flag.detail, width - 24);
  const height = Math.max(42, 24 + bodyLines.length * 9);
  doc.setDrawColor(...COLORS.line);
  if (flag.level === 'warning') {
    doc.setFillColor(255, 251, 235);
  } else {
    doc.setFillColor(239, 246, 255);
  }
  doc.roundedRect(x, y, width, height, 8, 8, 'FD');
  doc.setFillColor(...accent);
  doc.roundedRect(x, y, 6, height, 8, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.ink);
  doc.text(flag.label, x + 14, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text(bodyLines, x + 14, y + 28);
  return y + height;
}

function estimateDetailEventCardHeight(doc, width, event, t) {
  const notesLines = event.notes ? doc.splitTextToSize(event.notes, width - 24) : [];
  const postIctalLines = event.postIctal?.summary ? doc.splitTextToSize(`${t('export.docs.post_ictal_summary', 'After-seizure summary')}: ${event.postIctal.summary}`, width - 24) : [];
  const extraLines = notesLines.length + postIctalLines.length;
  return extraLines ? Math.max(104, 84 + extraLines * 9) : 96;
}

function drawDetailEventCard(doc, x, y, width, event, t) {
  const notesLines = event.notes ? doc.splitTextToSize(event.notes, width - 24) : [];
  const postIctalLines = event.postIctal?.summary ? doc.splitTextToSize(`${t('export.docs.post_ictal_summary', 'After-seizure summary')}: ${event.postIctal.summary}`, width - 24) : [];
  const height = estimateDetailEventCardHeight(doc, width, event, t);
  doc.setDrawColor(...COLORS.line);
  doc.roundedRect(x, y, width, height, 8, 8, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.ink);
  doc.text(`${event.date} ${t('export.docs.at')} ${event.time}`, x + 12, y + 18);
  doc.setFontSize(10);
  doc.text(event.type, x + 12, y + 33);
  if (event.userModeAtTime) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(event.userModeAtTime, x + 12, y + 46);
  }

  let badgeX = x + width - 12;
  [...event.badges].reverse().forEach(badge => {
    const w = doc.getTextWidth(badge) + 12;
    badgeX -= w;
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(badgeX, y + 10, w, 14, 4, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.blue);
    doc.text(badge, badgeX + 6, y + 19);
    badgeX -= 4;
  });

  const metricY = y + 60;
  [
    [t('export.docs.total'), event.totalLabel],
    [t('export.docs.aura'), event.auraLabel],
    [t('export.docs.seizure'), event.seizureLabel],
    [t('export.docs.recovery'), event.recoveryLabel],
  ].forEach(([label, value], index) => {
    const columnX = x + 12 + index * ((width - 24) / 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.soft);
    doc.text(String(label).toUpperCase(), columnX, metricY);
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.ink);
    doc.text(value || '-', columnX, metricY + 13);
  });

  let textY = y + 90;
  if (event.postIctal?.summary) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.blue);
    doc.text(postIctalLines, x + 12, textY);
    textY += postIctalLines.length * 9 + 4;
  }

  if (event.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(notesLines, x + 12, textY);
  }

  return y + height;
}

function drawConfidenceBanner(doc, x, y, width, data, t) {
  const bg = hexToRgb(data.stats.confidence.bg);
  const fg = hexToRgb(data.stats.confidence.color);
  doc.setFillColor(...bg);
  doc.roundedRect(x, y, width, 28, 8, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...fg);
  doc.text(
    `${t('export.docs.confidence_label')}: ${data.stats.confidence.label} (${data.stats.fullyPct}% ${t('export.docs.fully_recorded').toLowerCase()})`,
    x + 12,
    y + 18,
  );
}

function drawQualityCard(doc, x, y, width, height, value, label) {
  doc.setDrawColor(...COLORS.line);
  doc.setFillColor(...COLORS.panel);
  doc.roundedRect(x, y, width, height, 8, 8, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.ink);
  doc.text(value, x + width / 2, y + 22, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.soft);
  doc.text(String(label).toUpperCase(), x + width / 2, y + 37, { align: 'center' });
}

function drawSymptomGroupHeader(doc, x, y, width, group, t) {
  doc.setDrawColor(...COLORS.line);
  doc.setFillColor(...COLORS.panel);
  doc.roundedRect(x, y, width, 36, 8, 8, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.soft);
  doc.text(String(t('export.docs.event_number', { count: group.eventIndex })).toUpperCase(), x + 10, y + 11);
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.ink);
  doc.text(`${group.date} ${t('export.docs.at')} ${group.time}`, x + 10, y + 23);
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(8);
  doc.text(group.type, x + 10, y + 32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text(`${t('export.docs.total')}: ${group.totalLabel}`, x + width - 10, y + 21, { align: 'right' });
}

function estimateSymptomGroupHeight(groupRows) {
  const headerHeight = 44;
  const tableHeaderHeight = 18;
  const estimatedRows = groupRows.reduce((sum, row) => {
    const longest = Math.max(...row.map(cell => String(cell || '').length));
    return sum + (longest > 70 ? 34 : longest > 36 ? 28 : 22);
  }, 0);
  return headerHeight + tableHeaderHeight + estimatedRows + 12;
}

async function drawChartBlock(doc, x, y, width, chart, fallbackHeight = 150) {
  const height = Math.max(fallbackHeight, chart.height * (width / chart.width)) + 18;
  drawChartCard(doc, x, y, width, height, chart);
  return y + height;
}

function drawChartCard(doc, x, y, width, height, chart) {
  const innerPad = 9;
  doc.setDrawColor(...COLORS.line);
  doc.setFillColor(...COLORS.panel);
  doc.roundedRect(x, y, width, height, 10, 10, 'FD');
  const imageWidth = width - innerPad * 2;
  const imageHeight = chart.height * (imageWidth / chart.width);
  doc.addImage(chart.dataUrl, 'PNG', x + innerPad, y + innerPad, imageWidth, imageHeight);
}

async function renderSvgChart(svgMarkup) {
  const viewBoxMatch = svgMarkup.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  const width = viewBoxMatch ? Number.parseFloat(viewBoxMatch[1]) : 520;
  const height = viewBoxMatch ? Number.parseFloat(viewBoxMatch[2]) : 150;
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * 2);
    canvas.height = Math.ceil(height * 2);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/png'), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function savePdfDocument(doc, filename) {
  const blob = doc.output('blob');
  return saveFileNative(blob, filename, 'AuraTrack PDF', ['.pdf']);
}

function addPageNumbers(doc) {
  const pageCount = doc.getNumberOfPages();
  if (pageCount <= 1) return;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`${page} / ${pageCount}`, pageWidth - 40, pageHeight - 18, { align: 'right' });
  }
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function translator() {
  return (key, options) => i18n.t(key, options);
}

function stripHtml(value) {
  return value.replace(/<br\s*\/?>/gi, '\n');
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

async function saveFileNative(blob, suggestedName, description, extensions) {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description, accept: { [blob.type]: extensions } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { ok: true, cancelled: false };
    } catch (error) {
      if (error.name === 'AbortError') return { ok: false, cancelled: true };
    }
  }
  triggerDownload(blob, suggestedName);
  return { ok: true, cancelled: false };
}
