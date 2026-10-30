import { useState } from 'react';
import { db } from '../data/db';
import { haptic } from '../utils/hapticFeedback';
import { CUSTOM_FINDING, EMPTY_POST_ICTAL, normalizePostIctal } from '../utils/postIctal';

const EMPTY_SELECTIONS = { type: '', group: '', symptom: '', detail: '', region: '', subRegion: '', specificPart: '' };
const sameLocation = (a, b) => a.region === b.region && a.subRegion === b.subRegion && a.specificPart === b.specificPart;

export function useTaggingWizard() {
  const [taggingStep, setTaggingStep] = useState('TYPE');
  const [selections, setSelections] = useState(EMPTY_SELECTIONS);
  const [tempSymptomList, setTempSymptomList] = useState([]);
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [activeEventId, setActiveEventId] = useState(null);
  const [manualDurations, setManualDurationsState] = useState({});
  const [editedTimers, setEditedTimers] = useState([]);
  const [triggers, setTriggers] = useState([]);
  const [postIctal, setPostIctal] = useState(EMPTY_POST_ICTAL);
  const [overrideDateTime, setOverrideDateTimeState] = useState(null);
  const [isManualEntry, setIsManualEntry] = useState(false);

  const setActiveEvent = (id) => {
    setActiveEventId(id);
  };

  const setManualDuration = (phase, seconds) => {
    setManualDurationsState(prev => ({ ...prev, [phase]: seconds }));
    setEditedTimers(prev => prev.includes(phase) ? prev : [...prev, phase]);
  };

  const triggerToggle = (label) => {
    setTriggers(prev => prev.includes(label) ? prev.filter(t => t !== label) : [...prev, label]);
  };

  const setEventDateTime = (date, time) => {
    setOverrideDateTimeState({ date, time });
  };

  // After-seizure findings: { key, locations } (custom ones also carry their label)
  const togglePostIctalFinding = (key) => {
    setPostIctal(prev => ({
      ...prev,
      findings: prev.findings.some(f => f.key === key)
        ? prev.findings.filter(f => f.key !== key)
        : [...prev.findings, { key, locations: [] }],
    }));
  };

  const addPostIctalLocations = (key, locations) => {
    setPostIctal(prev => {
      const existing = prev.findings.find(f => f.key === key);
      const merged = [...(existing?.locations || [])];
      locations.forEach(location => { if (!merged.some(l => sameLocation(l, location))) merged.push(location); });
      const finding = { key, locations: merged };
      return {
        ...prev,
        findings: existing ? prev.findings.map(f => (f === existing ? finding : f)) : [...prev.findings, finding],
      };
    });
  };

  const removePostIctalLocation = (key, index) => {
    setPostIctal(prev => ({
      ...prev,
      findings: prev.findings.map(f => (f.key === key ? { ...f, locations: f.locations.filter((_, i) => i !== index) } : f)),
    }));
  };

  const addCustomPostIctal = (label) => {
    const text = label.trim();
    if (!text) return;
    setPostIctal(prev => (prev.findings.some(f => f.key === CUSTOM_FINDING && f.label.toLowerCase() === text.toLowerCase())
      ? prev
      : { ...prev, findings: [...prev.findings, { key: CUSTOM_FINDING, label: text, locations: [] }] }));
  };

  const removeCustomPostIctal = (label) => {
    setPostIctal(prev => ({ ...prev, findings: prev.findings.filter(f => !(f.key === CUSTOM_FINDING && f.label === label)) }));
  };

  // minutes: back to normal after this long (null = not recorded); ongoing: not back to normal yet
  const setPostIctalRecovery = ({ minutes = null, ongoing = false }) => {
    setPostIctal(prev => ({ ...prev, recoveryMinutes: ongoing ? null : minutes, recoveryOngoing: ongoing }));
  };

  const loadForEdit = (event) => {
    const eventType = event.type && event.type !== 'Uncategorized' ? event.type : '';
    setEditingId(event.id);
    setActiveEventId(event.id);
    setSelections({ ...EMPTY_SELECTIONS, type: eventType });
    setTempSymptomList(event.symptoms || []);
    setNotes(event.notes || '');
    setTriggers(event.triggers || []);
    setPostIctal(normalizePostIctal(event.postIctal));
    setManualDurationsState(event.manualDurations || {});
    setEditedTimers(event.editedTimers || []);
    setOverrideDateTimeState(null);
    setIsManualEntry(false);
    setTaggingStep(!event.isComplete && !eventType ? 'TYPE' : 'SUMMARY');
  };

  const loadForManualEntry = (id, manualDurs, dateTime) => {
    setActiveEventId(id);
    setEditingId(null);
    setManualDurationsState(manualDurs || {});
    setEditedTimers(Object.keys(manualDurs || {}));
    setOverrideDateTimeState(dateTime);
    setIsManualEntry(true);
    setTaggingStep('TYPE');
  };

  // Saves the wizard into the event. complete: true for Save (tagging finished), false for "Skip for
  // now" (timing kept, details later). An edit is recorded in the audit trail only when something changed.
  const saveEvent = async ({ complete }) => {
    const targetId = editingId || activeEventId;
    if (!targetId) throw new Error('No active event to save');

    const existing = await db.events.get(targetId);
    const type = selections.type || existing?.type || 'Uncategorized';
    const savedAt = new Date().getTime();

    const dateTimeOverride = overrideDateTime
      ? (() => {
          const newStartTime = new Date(`${overrideDateTime.date}T${overrideDateTime.time}`).getTime();
          return {
            startTime: newStartTime,
            date: new Date(newStartTime).toLocaleDateString(),
            time: new Date(newStartTime).toLocaleTimeString(),
          };
        })()
      : {};

    const newEditLog = existing?.editLog ? [...existing.editLog] : [];
    if (editingId && existing) {
      const changedFields = [];
      if (type !== (existing.type || 'Uncategorized')) changedFields.push('type');
      if (notes !== (existing.notes || '')) changedFields.push('notes');
      if (JSON.stringify(triggers) !== JSON.stringify(existing.triggers || [])) changedFields.push('triggers');
      if (JSON.stringify(tempSymptomList) !== JSON.stringify(existing.symptoms || [])) changedFields.push('symptoms');
      if (JSON.stringify(postIctal) !== JSON.stringify(normalizePostIctal(existing.postIctal))) changedFields.push('after-seizure symptoms');
      if (JSON.stringify(manualDurations) !== JSON.stringify(existing.manualDurations || {})) changedFields.push('durations');
      if (overrideDateTime) changedFields.push('date/time');
      if (changedFields.length) newEditLog.push({ editedAt: savedAt, changedFields });
    }
    const didEdit = newEditLog.length > (existing?.editLog?.length || 0);

    await db.events.update(targetId, {
      type,
      symptoms: [...tempSymptomList],
      notes,
      triggers: [...triggers],
      postIctal,
      isComplete: complete ? true : (existing?.isComplete ?? false),
      isEdited: Boolean(existing?.isEdited || didEdit),
      manualDurations,
      editedTimers,
      editLog: newEditLog,
      ...(manualDurations?.total != null ? { duration: manualDurations.total } : {}),
      ...dateTimeOverride,
    });

    reset();
  };
  const handleFinalSave = () => saveEvent({ complete: true });
  const handleDeferredSave = () => saveEvent({ complete: false });

  const reset = () => {
    setNotes('');
    setActiveEventId(null);
    setEditingId(null);
    setTempSymptomList([]);
    setTriggers([]);
    setPostIctal(EMPTY_POST_ICTAL);
    setTaggingStep('TYPE');
    setSelections(EMPTY_SELECTIONS);
    setManualDurationsState({});
    setEditedTimers([]);
    setOverrideDateTimeState(null);
    setIsManualEntry(false);
  };

  const addQuickNote = (label, elapsed) => {
    const newNote = `[T+${elapsed}s] ${label}`;
    setNotes(prev => {
      const next = prev ? `${prev}\n${newNote}` : newNote;
      // Kept with the crash-recovery record so a reopened recording still has its notes
      try { localStorage.setItem('aura_notes', next); } catch { /* private browsing */ }
      return next;
    });
    haptic(50);
  };

  return {
    taggingStep, setTaggingStep,
    selections, setSelections,
    tempSymptomList, setTempSymptomList,
    notes, setNotes,
    triggers, triggerToggle,
    postIctal, togglePostIctalFinding, addPostIctalLocations, removePostIctalLocation, addCustomPostIctal, removeCustomPostIctal, setPostIctalRecovery,
    editingId, activeEventId,
    manualDurations, editedTimers,
    overrideDateTime, isManualEntry,
    setManualDuration,
    setActiveEvent,
    setEventDateTime,
    loadForEdit,
    loadForManualEntry,
    handleFinalSave,
    handleDeferredSave,
    reset,
    addQuickNote
  };
}
