import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMedications } from '../hooks/useMedications';
import { getScheduledDosesForDay, getDoseStatus } from '../utils/medicationSchedule';
import { changeTypeLabel, describeChange } from '../utils/medicationChanges';
import { EditIcon } from './AppIcons';
import { BottomSheet, Button, DateInput, EmptyState } from './ui';

function parseHHMM(hhMM) {
  const [h, m] = hhMM.split(':').map(Number);
  return (h * 60 + m) * 60000;
}

function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function fmtDay(ms, todayMs) {
  const d = new Date(ms);
  const today = startOfDay(todayMs);
  const yesterday = today - 86400000;
  if (ms === today) return 'Today';
  if (ms === yesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtTime(ms) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const STATUS = {
  taken:    { label: 'TAKEN',    bg: '#16a34a', text: '#fff' },
  late:     { label: 'LATE',     bg: '#d97706', text: '#fff' },
  assumed:  { label: 'ASSUMED',  bg: 'transparent', text: '#16a34a', border: '1px dashed #16a34a' },
  missed:   { label: 'MISSED',   bg: '#dc2626', text: '#fff' },
  upcoming: { label: 'UPCOMING', bg: '#334155', text: '#facc15', border: '1px solid #f59e0b' },
  nodata:   { label: 'NO DATA',  bg: '#334155', text: '#fff', border: '1px solid #64748b' },
};

// When a slot has several logs, show the most informative one
const STATUS_RANK = { missed: 0, assumed: 1, taken: 2, late: 2 };

export function MedicationHistoryTab({ settings = {} }) {
  const { t } = useTranslation();
  const { medications, changes, getLogsForPeriod, updateLog, logDoseWithStatus } = useMedications();
  const statusLabel = (key) => (key === 'assumed' ? t('medication_history.assumed') : STATUS[key]?.label);
  const [allLogs, setAllLogs] = useState([]);
  const [editCell, setEditCell] = useState(null);
  const [editTime, setEditTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [nowMs] = useState(() => Date.now());

  const loadLogs = async () => {
    setLoading(true);
    try {
      const logs = await getLogsForPeriod(0, nowMs + 86400000);
      setAllLogs(logs);
    } catch {
      setAllLogs([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    const id = setTimeout(loadLogs, 0);
    return () => clearTimeout(id);
  }, [medications]);

  // Stopped medications stay so their past days still show; each day uses the regimen in force then
  const scheduledMeds = medications.filter(m => !m.isRescue);

  // Determine start date: earliest of (setting, earliest log, 30 days ago as fallback)
  const startDateMs = useMemo(() => {
    const today = startOfDay(nowMs);
    const maxBack = today - 365 * 86400000;

    const candidates = [];
    if (settings.medicationStartDate) {
      const d = startOfDay(new Date(settings.medicationStartDate).getTime());
      if (!isNaN(d)) candidates.push(d);
    }
    if (allLogs.length > 0) {
      candidates.push(startOfDay(Math.min(...allLogs.map(l => l.takenAt))));
    }
    // A medication started (or backdated) before its first log still shows from its start date
    if (changes.length > 0) {
      candidates.push(startOfDay(Math.min(...changes.map(c => c.effectiveAt))));
    }

    return candidates.length > 0
      ? Math.min(today, Math.max(Math.min(...candidates), maxBack))
      : today; // no history at all — just show today
  }, [allLogs, changes, nowMs, settings.medicationStartDate]);

  // Build list of days from start to today, newest first
  const days = useMemo(() => {
    const today = startOfDay(nowMs);
    const result = [];
    for (let d = today; d >= startDateMs; d -= 86400000) result.push(d);
    return result;
  }, [nowMs, startDateMs]);

  // Fast log lookup: "dayStart|medId|hhMM" → log record
  const logIndex = useMemo(() => {
    const idx = {};
    for (const log of allLogs) {
      const key = `${startOfDay(log.takenAt)}|${log.medicationId}|${log.scheduledTime ?? ''}`;
      // Keep only one record per slot (prefer taken/late over assumed over missed)
      if (!idx[key] || (STATUS_RANK[log.status] ?? 2) > (STATUS_RANK[idx[key].status] ?? 2)) idx[key] = log;
    }
    // Also index ad-hoc logs (scheduledTime = null) by takenAt day
    return idx;
  }, [allLogs]);

  const getLog = (dayMs, medId, hhMM) => logIndex[`${dayMs}|${medId}|${hhMM}`] ?? null;

  const getCellStatus = (dayMs, medId, hhMM) => {
    const log = getLog(dayMs, medId, hhMM);
    if (log) return log.status ?? getDoseStatus(hhMM, log.takenAt, dayMs);
    const scheduledTs = dayMs + parseHHMM(hhMM);
    const isToday = dayMs === startOfDay(nowMs);
    if (isToday && scheduledTs > nowMs) return 'upcoming';
    return 'nodata';
  };

  const openEdit = (dayMs, med, hhMM) => {
    const log = getLog(dayMs, med.id, hhMM);
    setEditCell({ dayMs, med, hhMM, log });
    if (log && log.status !== 'missed') {
      const d = new Date(log.takenAt);
      setEditTime(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`);
    } else {
      setEditTime(hhMM);
    }
  };

  const handleMarkTaken = async () => {
    if (!editCell) return;
    const { dayMs, med, hhMM, log } = editCell;
    const targetTs = dayMs + parseHHMM(editTime || hhMM);
    const status = getDoseStatus(hhMM, targetTs, dayMs);
    if (log) {
      await updateLog(log.id, { takenAt: targetTs, status });
    } else {
      await logDoseWithStatus(med.id, hhMM, targetTs, status);
    }
    setEditCell(null);
    await loadLogs();
  };

  const handleMarkMissed = async () => {
    if (!editCell) return;
    const { dayMs, med, hhMM, log } = editCell;
    if (log) {
      await updateLog(log.id, { status: 'missed' });
    } else {
      await logDoseWithStatus(med.id, hhMM, dayMs + parseHHMM(hhMM), 'missed');
    }
    setEditCell(null);
    await loadLogs();
  };

  const handleConfirmAssumed = async () => {
    if (!editCell?.log) return;
    await updateLog(editCell.log.id, { status: 'taken' });
    setEditCell(null);
    await loadLogs();
  };

  if (scheduledMeds.length === 0) {
    return (
      <EmptyState>No scheduled medications. Add medications in Settings → Medications.</EmptyState>
    );
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="pb-10 space-y-3">
      {/* Legend */}
      <div className="flex gap-3 flex-wrap px-1 pt-1">
        {Object.entries(STATUS).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.bg === 'transparent' ? 'var(--bg-raised)' : s.bg, border: s.border ?? '1px solid var(--border)' }} />
            <span className="text-[9px] font-bold" style={{ color: 'var(--text-dim)' }}>{statusLabel(key)}</span>
          </div>
        ))}
        <span className="inline-flex items-center gap-1 text-[9px] font-bold" style={{ color: 'var(--text-dim)' }}>
          <EditIcon className="w-3 h-3" /> = edited
        </span>
      </div>

      {/* Day sections */}
      {days.map(dayMs => {
        // Build sorted dose rows for this day: sorted by scheduled time, then med name
        const doses = getScheduledDosesForDay(scheduledMeds, dayMs, changes);
        const dayChanges = changes.filter(c => !c.isBaseline && startOfDay(c.effectiveAt) === dayMs);

        // Also include ad-hoc logs for this day (scheduledTime = null)
        const adHocLogs = allLogs.filter(l =>
          startOfDay(l.takenAt) === dayMs &&
          (l.scheduledTime === null || l.scheduledTime === undefined)
        );

        if (doses.length === 0 && adHocLogs.length === 0 && dayChanges.length === 0) return null;

        return (
          <div key={dayMs} className="ui-card !p-0 overflow-hidden">
            {/* Day header */}
            <div
              className="px-4 py-3 border-b"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: dayMs === startOfDay(nowMs) ? 'var(--accent)' : 'var(--text-dim)' }}>
                {fmtDay(dayMs, nowMs)}
              </p>
              {dayChanges.map(change => (
                <p key={change.uuid ?? change.id} className="text-[10px] font-bold mt-1.5" style={{ color: 'var(--status-late-text)' }}>
                  {fmtTime(change.effectiveAt)} · {change.medicationName}: {changeTypeLabel(change.type, t)}
                  {describeChange(change, t).length > 0 && ` — ${describeChange(change, t).join('; ')}`}
                </p>
              ))}
            </div>

            {/* Dose rows — sorted by scheduled time */}
            <div className="divide-y" style={{ '--tw-divide-opacity': 1 }}>
              {doses.map(({ medicationId, medicationName, dose, unit, scheduledHHMM }) => {
                const med = scheduledMeds.find(m => m.id === medicationId);
                if (!med) return null;
                const cellStatus = getCellStatus(dayMs, medicationId, scheduledHHMM);
                const s = STATUS[cellStatus] ?? STATUS.nodata;
                const log = getLog(dayMs, medicationId, scheduledHHMM);
                const doseLabel = log?.doseSnapshot != null ? `${log.doseSnapshot}${log.unitSnapshot || unit}` : `${dose}${unit}`;
                return (
                  <button
                    key={`${medicationId}-${scheduledHHMM}`}
                    onClick={() => openEdit(dayMs, med, scheduledHHMM)}
                    className="w-full min-h-[3rem] flex items-center justify-between gap-3 px-4 py-3 transition-all active:opacity-70 text-left"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {medicationName}
                        {log?.isEdited && <EditIcon className="inline-block ml-1.5 w-3 h-3 text-amber-400 align-[-2px]" />}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                        {doseLabel} · Due {scheduledHHMM}
                        {log && cellStatus !== 'missed' && log.status !== 'missed' && log.status !== 'assumed' && (
                          <span className="ml-1">· Taken {fmtTime(log.takenAt)}</span>
                        )}
                      </p>
                    </div>
                    <span
                      className="ml-3 px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest shrink-0"
                      style={{ backgroundColor: s.bg, color: s.text, border: s.border }}
                    >
                      {statusLabel(cellStatus) ?? s.label}
                    </span>
                  </button>
                );
              })}

              {/* Ad-hoc doses */}
              {adHocLogs.map(log => {
                const med = medications.find(m => m.id === log.medicationId);
                if (!med) return null;
                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {med.name}
                        {log.isEdited && <EditIcon className="inline-block ml-1.5 w-3 h-3 text-amber-400 align-[-2px]" />}
                      </p>
	                      <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
	                        {med.dose}{med.unit} · Extra dose · {fmtTime(log.takenAt)}
	                      </p>
	                      {log.note && (
	                        <p className="text-[10px] mt-1 whitespace-pre-wrap" style={{ color: 'var(--text-dim)' }}>
	                          {log.note}
	                        </p>
	                      )}
	                    </div>
                    <span
                      className="ml-3 px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest shrink-0"
                      style={{ backgroundColor: STATUS.taken.bg, color: STATUS.taken.text }}
                    >
                      TAKEN
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {days.length === 0 && (
        <EmptyState>No history yet.</EmptyState>
      )}

      {/* Edit modal */}
      {editCell && (
        <BottomSheet
          title={`Edit Dose — ${editCell.med.name}`}
          onClose={() => setEditCell(null)}
          footer={(
            <>
              {editCell.log?.status === 'assumed' && (
                <Button variant="ghost" fullWidth onClick={handleConfirmAssumed} style={{ color: 'var(--success)', borderColor: 'var(--success)' }}>
                  {t('medication_history.confirm_taken')}
                </Button>
              )}
              <div className="ui-button-row">
                <Button variant="success" onClick={handleMarkTaken}>Mark Taken</Button>
                <Button variant="danger" onClick={handleMarkMissed}>Mark Missed</Button>
              </div>
              <Button variant="secondary" fullWidth onClick={() => setEditCell(null)}>Cancel</Button>
            </>
          )}
        >
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {fmtDay(editCell.dayMs)} · Scheduled {editCell.hhMM}
            {editCell.log?.isEdited && <span className="app-status-badge app-status-badge--info ml-2">Previously edited</span>}
          </p>
          <DateInput type="time" label="Actual time taken" value={editTime} onChange={setEditTime} />
        </BottomSheet>
      )}
    </div>
  );
}
