import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDurationSetting } from '../utils/formatters';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TRIGGER_DEFINITIONS } from '../data/constants';
import { CheckIcon, CloseIcon, EditIcon, GripIcon, TrashIcon } from './AppIcons';
import { Button, DateInput, FieldRow, IconButton, TextArea, TextInput } from './ui';
import { PostIctalSection } from './PostIctalSection';
import { EMPTY_POST_ICTAL } from '../utils/postIctal';


// ─── Drag handle ───────────────────────────────────────────────
function DragHandle(props) {
  const { t } = useTranslation();
  return (
    <div
      {...props}
      className="flex flex-col items-center justify-center shrink-0 cursor-grab active:cursor-grabbing min-w-[44px] min-h-[44px] rounded-lg"
      style={{ touchAction: 'none', color: 'var(--text-dim)', gap: '1px' }}
      aria-label={t('summary.drag_to_reorder')}
    >
      <GripIcon className="w-4 h-4" />
    </div>
  );
}

// ─── One sortable symptom row ─────────────────────────────────
function SortableSymptomRow({ symptom, index, onRemove }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: symptom._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-3 rounded-2xl border flex items-center gap-3 shadow-md"
      {...attributes}
    >
      {/* Drag handle — touch-action:none prevents scroll capture on the handle only */}
      <DragHandle {...listeners} />

      <div className="flex-1 min-w-0">
        <p className="text-sm uppercase tracking-tight leading-none mb-1 truncate" style={{ color: 'var(--accent-text)' }}>
          {symptom.symptom}
        </p>
        <p className="text-[11px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
          {symptom.region} › {symptom.specificPart}
        </p>
      </div>

      <button
        onClick={() => onRemove(index)}
        className="ui-icon-btn ui-icon-btn--danger"
        aria-label={t('summary.remove_symptom')}
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Inline editable timer (phase: aura / seizure / recovery) ─
function EditableTimer({ phase, label, color, calcValue, manualDurations, editedTimers, onSetManualDuration, durationFormat = 'seconds' }) {
  const { t } = useTranslation();
  const [stage, setStage] = useState('idle'); // idle | confirm | editing
  const [inputVal, setInputVal] = useState('');

  const displayValue = manualDurations?.[phase] ?? calcValue;
  const isEdited     = editedTimers?.includes(phase);

  const startEdit  = () => { setInputVal(String(displayValue)); setStage('editing'); };
  const cancelEdit = () => { setStage('idle'); setInputVal(''); };
  const saveEdit   = () => {
    const val = parseInt(inputVal, 10);
    if (!isNaN(val) && val >= 0) onSetManualDuration(phase, val);
    setStage('idle'); setInputVal('');
  };

  return (
    <div className="text-center">
      <p className="text-[9px] font-black uppercase mb-1" style={{ color }}>{label}</p>

      {stage === 'idle' && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-lg font-mono font-black" style={{ color: 'var(--text-primary)' }}>
            {formatDurationSetting(displayValue, durationFormat)}
            {isEdited && (
              <span className="app-status-badge app-status-badge--info ml-1.5 align-middle !px-1.5 !py-0.5 !text-[8px]">
                {t('summary.edited')}
              </span>
            )}
          </p>
          <button
            onClick={() => setStage('confirm')}
            className="ui-btn ui-btn--primary ui-btn--sm shrink-0"
          >
            <EditIcon className="w-3.5 h-3.5 shrink-0" />
            {t('summary.edit')}
          </button>
        </div>
      )}

      {stage === 'confirm' && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-bold" style={{ color: 'var(--text-dim)' }}>{t('summary.edit_phase_question', { phase: label })}</p>
          <div className="ui-inline justify-center">
            <Button variant="warning" size="sm" onClick={startEdit}>{t('summary.yes')}</Button>
            <Button variant="secondary" size="sm" onClick={cancelEdit}>{t('summary.no')}</Button>
          </div>
        </div>
      )}

      {stage === 'editing' && (
        <div className="ui-inline justify-center">
          <span className="ui-inline justify-center">
            <TextInput
              inputMode="numeric"
              pattern="[0-9]*"
              value={inputVal}
              onChange={value => setInputVal(value.replace(/\D/g, ''))}
              aria-label={label}
              placeholder="0"
              className="ui-field--compact"
              autoFocus
            />
            <span className="text-xs font-bold" style={{ color: 'var(--text-dim)' }}>s</span>
          </span>
          <span className="ui-inline justify-center">
            <IconButton label={t('summary.save')} tone="success" onClick={saveEdit}><CheckIcon className="w-4 h-4" /></IconButton>
            <IconButton label={t('summary.cancel')} onClick={cancelEdit}><CloseIcon className="w-4 h-4" /></IconButton>
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Editable total duration (larger display) ─────────────────
function EditableTotalTimer({ calcValue, manualDurations, editedTimers, onSetManualDuration, durationFormat = 'seconds' }) {
  const { t } = useTranslation();
  const fmtDur = (s) => formatDurationSetting(s, durationFormat);
  const [stage, setStage] = useState('idle');
  const [inputVal, setInputVal] = useState('');

  const displayValue = manualDurations?.['total'] ?? calcValue;
  const isEdited     = editedTimers?.includes('total');

  const startEdit  = () => { setInputVal(String(displayValue)); setStage('editing'); };
  const cancelEdit = () => { setStage('idle'); setInputVal(''); };
  const saveEdit   = () => {
    const val = parseInt(inputVal, 10);
    if (!isNaN(val) && val >= 0) onSetManualDuration('total', val);
    setStage('idle'); setInputVal('');
  };

  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>
        {t('summary.total_duration')}
      </p>

      {stage === 'idle' && (
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-4xl font-mono font-black leading-none" style={{ color: 'var(--text-primary)' }}>
            {fmtDur(displayValue)}
          </p>
          {isEdited && (
            <span className="app-status-badge app-status-badge--info !px-1.5 !py-0.5 !text-[8px]">
              {t('summary.edited')}
            </span>
          )}
          <button
            onClick={() => setStage('confirm')}
            className="ui-btn ui-btn--primary ui-btn--sm shrink-0"
          >
            <EditIcon className="w-3.5 h-3.5 shrink-0" />
            {t('summary.edit')}
          </button>
        </div>
      )}

      {stage === 'confirm' && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold" style={{ color: 'var(--text-dim)' }}>{t('summary.edit_total_question')}</p>
          <div className="ui-button-row">
            <Button variant="warning" onClick={startEdit}>{t('summary.yes_edit')}</Button>
            <Button variant="secondary" onClick={cancelEdit}>{t('summary.cancel')}</Button>
          </div>
        </div>
      )}

      {stage === 'editing' && (
        <div className="ui-inline">
          <span className="ui-inline">
            <TextInput
              inputMode="numeric"
              pattern="[0-9]*"
              value={inputVal}
              onChange={value => setInputVal(value.replace(/\D/g, ''))}
              aria-label={t('summary.total_duration')}
              placeholder="0"
              className="!w-24 text-center"
              autoFocus
            />
            <span className="text-lg font-bold" style={{ color: 'var(--text-dim)' }}>s</span>
          </span>
          <span className="ui-inline">
            <Button variant="success" icon={<CheckIcon className="w-4 h-4" />} onClick={saveEdit}>{t('summary.save')}</Button>
            <IconButton label={t('summary.cancel')} onClick={cancelEdit}><CloseIcon className="w-4 h-4" /></IconButton>
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Inline date/time editor for edit-mode / manual entries ──
function DateTimeOverrideRow({ startTime, overrideDateTime, onSetEventDateTime }) {
  const { t } = useTranslation();
  const [fallbackStartTime] = useState(() => Date.now());
  const d   = new Date(startTime || fallbackStartTime);
  const pad = n => String(n).padStart(2, '0');
  const defDate = overrideDateTime?.date ?? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const defTime = overrideDateTime?.time ?? `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  // Local calendar date for the max (toISOString would give the UTC date)
  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  return (
    <div>
      <p className="ui-label">{t('summary.event_date_time', 'Event date & time')}</p>
      <FieldRow>
        <DateInput max={today} value={defDate} onChange={value => onSetEventDateTime(value, defTime)} aria-label={t('manual_entry.date')} />
        <DateInput type="time" value={defTime} onChange={value => onSetEventDateTime(defDate, value)} aria-label={t('manual_entry.time')} />
      </FieldRow>
    </div>
  );
}

// ─── Main Summary component ───────────────────────────────────
function Summary({
  tempSymptomList,
  setTempSymptomList,
  notes,
  setNotes,
  triggers = [],
  onTriggerToggle,
  postIctal = EMPTY_POST_ICTAL,
  savedCustomPostIctal = [],
  onTogglePostIctalFinding,
  onPickPostIctalArea,
  onRemovePostIctalArea,
  onAddCustomPostIctal,
  onRemoveCustomPostIctal,
  onSetPostIctalRecovery,
  elapsed,
  laps,
  startTime,
  manualDurations,
  editedTimers,
  onSetManualDuration,
  onAddAnother,
  onSaveFavorite,
  onSave,
  onSkip,
  onCancel,
  onRemoveSymptom,
  // Date/time override (edit mode backdating + manual entry)
  editingId,
  isManualEntry,
  overrideDateTime,
  onSetEventDateTime,
  durationFormat = 'seconds',
  seizureType,
  onChangeType,
}) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState(null);

  const auraDur     = laps?.aura    ? Math.floor((laps.aura    - startTime)          / 1000) : 0;
  const seizureDur  = laps?.aura  && laps?.seizure   ? Math.floor((laps.seizure  - laps.aura)    / 1000) : 0;
  const recoveryDur = laps?.seizure && laps?.recovery ? Math.floor((laps.recovery - laps.seizure) / 1000) : 0;

  const currentAura = manualDurations?.aura ?? auraDur;
  const markNoAura = () => {
    const seizure = manualDurations?.seizure ?? seizureDur;
    onSetManualDuration('aura', 0);
    onSetManualDuration('seizure', currentAura + seizure);
  };

  // When a phase timer is edited, recompute total as sum of all three phases
  const handleSetManualDuration = (phase, val) => {
    onSetManualDuration(phase, val);
    if (phase !== 'total') {
      const a = phase === 'aura'     ? val : (manualDurations?.aura     ?? auraDur);
      const s = phase === 'seizure'  ? val : (manualDurations?.seizure  ?? seizureDur);
      const r = phase === 'recovery' ? val : (manualDurations?.recovery ?? recoveryDur);
      onSetManualDuration('total', a + s + r);
    }
  };

  // Stable IDs for dnd-kit (index-based is fine since list only reorders, never slices)
  const itemsWithId = tempSymptomList.map((s, i) => ({ ...s, _id: `symptom-${i}` }));

  // Activate drag only after 8 px movement to avoid blocking scrolls
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor   = useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } });
  const sensors       = useSensors(pointerSensor, touchSensor);

  const handleDragStart = ({ active }) => setActiveId(active.id);

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = itemsWithId.findIndex(s => s._id === active.id);
    const newIndex = itemsWithId.findIndex(s => s._id === over.id);
    setTempSymptomList(arrayMove(tempSymptomList, oldIndex, newIndex));
  };

  const activeSymptom = activeId ? itemsWithId.find(s => s._id === activeId) : null;

  return (
    <div className="flex flex-col w-full mx-auto px-1">

      {/* 1. CLINICAL DURATION BREAKDOWN */}
      <div className="app-surface-card p-5 mb-5">

        {/* Date/time override row — shown when editing or logging past seizure */}
        {(editingId || isManualEntry) && onSetEventDateTime && (
          <DateTimeOverrideRow
            startTime={startTime}
            overrideDateTime={overrideDateTime}
            onSetEventDateTime={onSetEventDateTime}
          />
        )}

        <div className="flex justify-between items-start mb-4">
          <EditableTotalTimer
            calcValue={elapsed}
            manualDurations={manualDurations}
            editedTimers={editedTimers}
            onSetManualDuration={onSetManualDuration}
            durationFormat={durationFormat}
          />
          {onChangeType && (
            <div className="text-right shrink-0 max-w-[50%] min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>{t('summary.seizure_type')}</p>
              <p className="text-sm font-black break-words" style={{ color: 'var(--text-primary)' }}>{seizureType || t('summary.type_not_set')}</p>
              <Button variant="secondary" size="sm" className="mt-1" onClick={onChangeType}>{t('summary.change_type')}</Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <EditableTimer phase="aura" durationFormat={durationFormat} label={t('summary.aura')}     color="var(--phase-aura)"
            calcValue={auraDur}     manualDurations={manualDurations} editedTimers={editedTimers} onSetManualDuration={handleSetManualDuration} />
          <EditableTimer phase="seizure" durationFormat={durationFormat} label={t('summary.seizure')}  color="var(--phase-seizure)"
            calcValue={seizureDur}  manualDurations={manualDurations} editedTimers={editedTimers} onSetManualDuration={handleSetManualDuration} />
          <EditableTimer phase="recovery" durationFormat={durationFormat} label={t('summary.recovery')} color="var(--phase-recovery)"
            calcValue={recoveryDur} manualDurations={manualDurations} editedTimers={editedTimers} onSetManualDuration={handleSetManualDuration} />
        </div>
        {currentAura > 0 && (
          <div className="mt-3 flex justify-center">
            {/* One tap when the aura was marked by mistake: its time moves into the seizure */}
            <Button variant="secondary" size="sm" onClick={markNoAura}>{t('summary.no_aura')}</Button>
          </div>
        )}
      </div>

      {/* 2. MIDDLE CONTENT */}
      <div className="space-y-5 pb-6">

        {/* Symptom list with drag-to-reorder */}
        <div className="app-section-card">
          <p className="text-center font-black uppercase text-[11px] tracking-[0.3em] mb-1" style={{ color: 'var(--text-faint)' }}>
            {t('summary.logged_symptoms')}
          </p>
          {tempSymptomList.length > 1 && (
            <p className="text-center text-[9px] mb-4" style={{ color: 'var(--text-faint)' }}>
              {t('summary.drag_to_reorder')}
            </p>
          )}

          {tempSymptomList.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed rounded-[1.5rem]" style={{ borderColor: 'var(--border)' }}>
              <p className="italic text-sm" style={{ color: 'var(--text-faint)' }}>{t('tagging.no_ictal_symptoms', 'No ictal symptoms tagged yet.')}</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={itemsWithId.map(s => s._id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {itemsWithId.map((symptom, index) => (
                    <SortableSymptomRow
                      key={symptom._id}
                      symptom={symptom}
                      index={index}
                      onRemove={onRemoveSymptom}
                    />
                  ))}
                </div>
              </SortableContext>

              {/* Ghost while dragging */}
              <DragOverlay>
                {activeSymptom && (
                  <div className="p-3 rounded-2xl border flex items-center gap-3 shadow-2xl opacity-90"
                    style={{ backgroundColor: 'var(--bg-raised)', borderColor: 'var(--accent)' }}>
                    <DragHandle />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm uppercase tracking-tight leading-none truncate" style={{ color: 'var(--accent-text)' }}>
                        {activeSymptom.symptom}
                      </p>
                      <p className="text-[11px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                        {activeSymptom.region} › {activeSymptom.specificPart}
                      </p>
                    </div>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}

          <div className="app-balanced-grid mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <button
              onClick={onAddAnother}
              className="app-action-tile app-action-tile--compact app-action-tile--center font-black uppercase text-xs tracking-widest active:scale-95 transition-all"
              style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
            >
              <span className="app-chip-text">{t('summary.add_another')}</span>
            </button>

            {onSaveFavorite && tempSymptomList.length > 0 && (
              <button
                onClick={onSaveFavorite}
                className="app-action-tile app-action-tile--compact app-action-tile--center font-black uppercase text-[11px] tracking-widest active:scale-95 transition-all"
                style={{ backgroundColor: 'var(--action-blue)', color: '#fff', border: '1px solid var(--action-blue-border)' }}
              >
                <span className="app-chip-text">{t('symptom_sets.save')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Post-ictal findings */}
        <PostIctalSection
          postIctal={postIctal}
          savedCustom={savedCustomPostIctal}
          onToggle={onTogglePostIctalFinding}
          onPickArea={onPickPostIctalArea}
          onRemoveArea={onRemovePostIctalArea}
          onAddCustom={onAddCustomPostIctal}
          onRemoveCustom={onRemoveCustomPostIctal}
          onSetRecovery={onSetPostIctalRecovery}
        />

        {/* Trigger chips */}
        <div className="app-section-card w-full">
          <p className="text-[10px] font-black uppercase tracking-widest mb-3 ml-1" style={{ color: 'var(--text-dim)' }}>
            {t('summary.possible_triggers')} <span className="font-normal normal-case tracking-normal" style={{ color: 'var(--text-faint)' }}>({t('summary.optional')})</span>
          </p>
          <div className="app-choice-grid--compact">
            {TRIGGER_DEFINITIONS.map(trigger => {
              const selected = triggers.includes(trigger.value);
              return (
                <button
                  key={trigger.value}
                  aria-pressed={selected}
                  onClick={() => onTriggerToggle?.(trigger.value)}
                  className="app-action-tile app-action-tile--compact app-action-tile--center text-[11px] font-black uppercase tracking-wide transition-all active:scale-95"
                  style={selected
                    ? { backgroundColor: 'var(--action-blue)', color: '#fff', border: '1.5px solid var(--action-blue-border)' }
                    : { backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1.5px solid var(--border)' }
                  }
                >
                  <span className="app-chip-text">{t(trigger.labelKey, trigger.value)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div className="app-section-card w-full">
          <p className="text-[10px] font-black uppercase tracking-widest mb-3 ml-1" style={{ color: 'var(--text-dim)' }}>
            {t('summary.clinical_observations')}
          </p>
          <TextArea
            aria-label={t('event_card.notes_placeholder')}
            value={notes}
            onChange={setNotes}
            className="min-h-[140px]"
            placeholder={t('event_card.notes_placeholder')}
          />
        </div>
      </div>

      {/* 3. BOTTOM ACTIONS */}
      <div className="app-section-card mt-2">
        <button
          onClick={onSave}
          className="ui-btn ui-btn--success ui-btn--md ui-btn--full min-h-[4.75rem]"
        >
          {t('summary.finish_save')}
        </button>

        <div className="app-balanced-grid mt-3">
          {onSkip && (
            <button
              onClick={onSkip}
              className="app-action-tile app-action-tile--compact app-action-tile--center font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
              style={{ backgroundColor: '#334155', border: '2px solid #f59e0b', color: '#facc15' }}
            >
              {t('tagging.save_timing_only')}
            </button>
          )}

          <button
            onClick={onCancel}
            className="app-action-tile app-action-tile--compact app-action-tile--center font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
            style={{ backgroundColor: '#dc2626', border: '2px solid #991b1b', color: '#fff' }}
          >
            {/* Editing a saved seizure discards only the changes; a new recording is discarded entirely */}
            {editingId ? t('summary.cancel_edit') : t('summary.cancel_discard')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Summary;
