import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WizardMenu } from '../components/WizardMenu';
import { ArrowRightIcon } from '../components/AppIcons';
import Summary from '../components/Summary';
import { SYMPTOM_WIZARD, REGION_WIZARD, SEIZURE_TYPES, seizureTypeLabel } from '../data/constants';
import { db } from '../data/db';
import { TextArea, TextInput } from '../components/ui';
import {
  CUSTOM_SYMPTOMS_KEY, MAX_SET_NAME, SETS_KEY, capitalise, customDetailsFor, customPostIctal, customSymptomsFor,
  mostUsedSymptoms, rememberCustom, setsForType, suggestSetName, symptomLabel, uniqueSetName,
} from '../utils/symptomSets';

// Option values that aren't symptom names
const SAVED_SETS = '__saved_sets';
const ADD_SYMPTOM = '__add_symptom';
const ADD_DETAIL = '__add_detail';

function addSymptomBundles(existingSymptoms, bundleBase, specificParts) {
  return [
    ...existingSymptoms,
    ...specificParts.map(part => ({
      ...bundleBase,
      specificPart: part,
    })),
  ];
}

function TextEntryStep({
  title,
  value,
  onChange,
  onSubmit,
  onBack,
  placeholder,
  submitLabel,
  singleLine = false,
  help,
}) {
  const { t } = useTranslation();
  return (
    <div className="app-page-shell flex flex-col h-full mx-auto animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between items-center mb-8 shrink-0">
        {onBack ? (
          <button
            onClick={onBack}
            className="ui-btn ui-btn--secondary ui-btn--md"
          >
            ← {t('common.back')}
          </button>
        ) : <div className="w-10" />}
        <p className="text-center font-black uppercase text-[11px] tracking-[0.3em]" style={{ color: 'var(--text-dim)' }}>{title}</p>
        <div className="w-10" />
      </div>

      <div className="space-y-4">
        {singleLine ? (
          <TextInput aria-label={title} value={value} onChange={onChange} placeholder={placeholder} maxLength={MAX_SET_NAME} autoFocus />
        ) : (
          <TextArea
            aria-label={placeholder}
            value={value}
            onChange={onChange}
            className="min-h-[140px]"
            placeholder={placeholder}
            autoFocus
          />
        )}
        {help && <p className="ui-help">{help}</p>}
        <button
          onClick={onSubmit}
          disabled={!value.trim()}
          className="ui-btn ui-btn--primary ui-btn--lg ui-btn--full"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

export default function TaggingView({
  taggingStep, setTaggingStep,
  selections, setSelections,
  tempSymptomList, setTempSymptomList,
  notes, setNotes,
  triggers, triggerToggle,
  postIctal, togglePostIctalFinding, addPostIctalLocations, removePostIctalLocation, addCustomPostIctal, removeCustomPostIctal, setPostIctalRecovery,
  editingId, activeEventId,
  manualDurations, editedTimers, setManualDuration,
  overrideDateTime, isManualEntry, setEventDateTime,
  elapsed, laps, startTime,
  onSave, onSkip, onCancel,
  durationFormat = 'seconds',
  savedSets = [],
  customSymptoms = [],
  history = [],
  onUpdateSetting,
  patientBanner = null,
}) {
  const { t } = useTranslation();
  const skipLabel = t('tagging.skip_for_now');
  const seizureType = selections.type;
  const typeSets = useMemo(() => setsForType(savedSets, seizureType), [savedSets, seizureType]);
  const mostUsed = useMemo(() => mostUsedSymptoms(history, seizureType), [history, seizureType]);
  const [pendingSpecificParts, setPendingSpecificParts] = useState([]);
  const [customDraft, setCustomDraft] = useState('');
  const [customMode, setCustomMode] = useState(null);
  const [typeFromSummary, setTypeFromSummary] = useState(false);

  // Which after-seizure finding the body-area picker is choosing areas for
  const [postIctalTarget, setPostIctalTarget] = useState(null);
  const finalizePostIctalAreaSelection = (specificParts) => {
    if (!specificParts.length || !postIctalTarget) return;
    addPostIctalLocations(postIctalTarget, specificParts.map((specificPart) => ({
      region: selections.region,
      subRegion: selections.subRegion,
      specificPart,
    })));
    setPendingSpecificParts([]);
    setPostIctalTarget(null);
    setTaggingStep('SUMMARY');
  };
  const postIctalPickerTitle = postIctalTarget ? t(`post_ictal.finding.${postIctalTarget}`) : '';

  // Custom symptoms are remembered for next time (Settings → Recording lists and edits them)
  const remember = (entry) => onUpdateSetting?.(CUSTOM_SYMPTOMS_KEY, rememberCustom(customSymptoms, entry));

  const suggestedName = () => suggestSetName(seizureType, tempSymptomList, savedSets, t);

  const openCustomStep = (mode) => {
    setCustomMode(mode);
    setCustomDraft(mode === 'set' ? suggestedName() : '');
    setTaggingStep('CUSTOM_INPUT');
  };

  const submitCustomEntry = async () => {
    const value = customMode === 'set' ? customDraft.trim() : capitalise(customDraft);
    if (!value) return;

    if (customMode === 'symptom') {
      remember({ kind: 'symptom', group: selections.group, label: value });
      setSelections({
        ...selections,
        symptom: value,
        detail: '',
        medical: 'Custom',
      });
      setTaggingStep('S_DET');
    } else if (customMode === 'detail') {
      remember({ kind: 'detail', group: selections.group, symptom: selections.symptom, label: value });
      setSelections({
        ...selections,
        detail: value,
        medical: selections.medical || 'Custom',
      });
      setTaggingStep('R_CAT');
    } else if (customMode === 'set') {
      const suggestion = suggestedName();
      const nextSets = [
        ...savedSets,
        {
          id: crypto.randomUUID(),
          name: uniqueSetName(value, seizureType, savedSets),
          seizureType: seizureType && seizureType !== 'Uncategorized' ? seizureType : '',
          symptoms: tempSymptomList.map(symptom => ({ ...symptom })),
          // A name left as suggested follows the set when its type or symptoms change in Settings
          autoName: value === suggestion,
        },
      ];
      await onUpdateSetting?.(SETS_KEY, nextSets);
      setTaggingStep('SUMMARY');
    }
    setCustomDraft('');
    setCustomMode(null);
  };

  const addSymptomsToSelection = (symptoms) => {
    setTempSymptomList([
      ...tempSymptomList,
      ...symptoms.map(symptom => ({ ...symptom })),
    ]);
    setTaggingStep('SUMMARY');
  };

  // "Saved symptom sets — Focal Aware": the type's sets, then the symptoms used most for it.
  // With no type chosen, every set, grouped by type.
  const savedPickOptions = useMemo(() => {
    const options = [];
    const setOption = (set) => ({ value: `set:${set.id}`, label: set.name, hint: set.seizureType ? '' : t('symptom_sets.untyped') });
    if (seizureType && seizureType !== 'Uncategorized') {
      if (typeSets.length) options.push({ heading: t('symptom_sets.sets_heading') }, ...typeSets.map(setOption));
    } else {
      const byType = new Map();
      typeSets.forEach(set => byType.set(set.seizureType || '', [...(byType.get(set.seizureType || '') || []), set]));
      for (const [type, sets] of byType) options.push({ heading: seizureTypeLabel(type, t) || t('symptom_sets.untyped') }, ...sets.map(setOption));
    }
    if (mostUsed.length) {
      options.push({ heading: t('symptom_sets.most_used', { type: seizureTypeLabel(seizureType, t) }) },
        ...mostUsed.map((symptom, index) => ({ value: `sym:${index}`, label: symptomLabel(symptom) })));
    }
    return options;
  }, [mostUsed, seizureType, t, typeSets]);
  const hasSavedPicks = savedPickOptions.length > 0;

  const finalizeSymptomSelection = (specificParts) => {
    if (!specificParts.length) return;
    const bundleBase = {
      symptom: selections.symptom,
      detail: selections.detail,
      med: selections.medical,
      region: selections.region,
    };
    setTempSymptomList(addSymptomBundles(tempSymptomList, bundleBase, specificParts));
    setPendingSpecificParts([]);
    setTaggingStep('SUMMARY');
  };

  const saveCustomSymptomToSummary = () => {
    const bundle = {
      symptom: selections.symptom,
      detail: selections.detail || 'Custom detail',
      med: selections.medical || 'Custom',
      region: 'N/A',
      specificPart: 'Internal/General',
    };
    setTempSymptomList([...tempSymptomList, bundle]);
    setTaggingStep('SUMMARY');
  };

  // A new seizure saves its type straight away (so a skipped wizard keeps it). When the type is
  // changed from the summary, or a saved seizure is edited, it is saved with the rest on Save, so
  // the change is recorded in the edit history.
  const handleTypeSelect = async (val) => {
    const targetId = editingId || activeEventId;
    if (!targetId) { console.error('No active event found'); return; }
    if (!editingId) await db.events.update(targetId, { type: val });
    setSelections({ ...selections, type: val });
    setTaggingStep(typeFromSummary ? 'SUMMARY' : 'S_CAT');
    setTypeFromSummary(false);
  };

  return (
    <div className="app-page-shell flex-1 min-h-full flex flex-col items-center overflow-y-auto py-4 custom-scrollbar animate-in fade-in slide-in-from-bottom-6">
      {patientBanner && <div className="w-full mb-3 shrink-0">{patientBanner}</div>}
      <div className="w-full p-6 rounded-[2rem] shadow-2xl flex flex-col" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>

        {taggingStep === 'SUMMARY' ? (
          <div className="w-full">
            <Summary
              tempSymptomList={tempSymptomList}
              setTempSymptomList={setTempSymptomList}
              notes={notes}
              setNotes={setNotes}
              triggers={triggers}
              onTriggerToggle={triggerToggle}
              postIctal={postIctal}
              onTogglePostIctalFinding={togglePostIctalFinding}
              onPickPostIctalArea={(key) => {
                setPostIctalTarget(key);
                setPendingSpecificParts([]);
                setSelections({ ...selections, region: '', subRegion: '' });
                setTaggingStep('PI_R_CAT');
              }}
              onRemovePostIctalArea={removePostIctalLocation}
              onAddCustomPostIctal={(label) => { addCustomPostIctal(capitalise(label)); remember({ kind: 'post_ictal', label }); }}
              onRemoveCustomPostIctal={removeCustomPostIctal}
              onSetPostIctalRecovery={setPostIctalRecovery}
              elapsed={elapsed}
              laps={laps}
              startTime={startTime}
              manualDurations={manualDurations}
              editedTimers={editedTimers}
              onSetManualDuration={setManualDuration}
              onAddAnother={() => setTaggingStep('S_CAT')}
              onSaveFavorite={() => openCustomStep('set')}
              savedCustomPostIctal={customPostIctal(customSymptoms)}
              onSave={onSave}
              onSkip={onSkip}
              onCancel={onCancel}
              onRemoveSymptom={index => setTempSymptomList(tempSymptomList.filter((_, i) => i !== index))}
              editingId={editingId}
              isManualEntry={isManualEntry}
              overrideDateTime={overrideDateTime}
              onSetEventDateTime={setEventDateTime}
              durationFormat={durationFormat}
              seizureType={seizureTypeLabel(selections.type, t)}
              onChangeType={() => { setTypeFromSummary(true); setTaggingStep('TYPE'); }}
            />
          </div>
        ) : (
          <>
            {/* Step 1: Seizure Type */}
            {taggingStep === 'TYPE' && (
              <WizardMenu
                title={t('tagging.step1_title')}
                options={SEIZURE_TYPES.map(type => ({ value: type, label: seizureTypeLabel(type, t) }))}
                onPick={handleTypeSelect}
                onBack={typeFromSummary ? () => { setTypeFromSummary(false); setTaggingStep('SUMMARY'); } : undefined}
                onSkip={typeFromSummary ? undefined : onSkip}
                skipLabel={skipLabel}
              />
            )}

            {/* Step 2-4: Symptom Drill-Down */}
            {taggingStep === 'S_CAT' && (
              <WizardMenu
                title={t('tagging.feeling_title')}
                options={[
                  ...(hasSavedPicks ? [{
                    value: SAVED_SETS,
                    label: seizureType && seizureType !== 'Uncategorized' ? t('symptom_sets.entry', { type: seizureTypeLabel(seizureType, t) }) : t('symptom_sets.entry_no_type'),
                  }] : []),
                  ...Object.keys(SYMPTOM_WIZARD),
                ]}
                onPick={v => {
                  if (v === SAVED_SETS) {
                    setTaggingStep('FAV_PICK');
                    return;
                  }
                  setSelections({ ...selections, group: v, symptom: '', detail: '', region: '', subRegion: '', specificPart: '', medical: '' });
                  setTaggingStep('S_SYM');
                }}
                onPrimaryAction={() => setTaggingStep('SUMMARY')}
                primaryActionLabel={t('tagging.continue_to_summary', 'Continue to Summary')}
                primaryActionIcon={<ArrowRightIcon className="w-4 h-4" />}
                onSkip={onSkip}
                skipLabel={skipLabel}
              />
            )}
            {taggingStep === 'FAV_PICK' && hasSavedPicks && (
              <WizardMenu
                title={t('symptom_sets.title')}
                options={savedPickOptions}
                onPick={value => {
                  const [kind, id] = value.split(/:(.+)/);
                  if (kind === 'set') {
                    const set = savedSets.find(item => String(item.id) === id);
                    if (set) addSymptomsToSelection(set.symptoms || []);
                  } else if (kind === 'sym' && mostUsed[Number(id)]) {
                    addSymptomsToSelection([mostUsed[Number(id)]]);
                  }
                }}
                onBack={() => setTaggingStep('S_CAT')}
                onSkip={onSkip}
                skipLabel={skipLabel}
              />
            )}
            {taggingStep === 'S_SYM' && selections.group && SYMPTOM_WIZARD[selections.group] && (
              <WizardMenu
                title={selections.group}
                options={[
                  ...Object.keys(SYMPTOM_WIZARD[selections.group]),
                  ...customSymptomsFor(customSymptoms, selections.group)
                    .filter(label => !(label in SYMPTOM_WIZARD[selections.group]))
                    .map(label => ({ value: label, label, hint: t('symptom_sets.added_by_you') })),
                  { value: ADD_SYMPTOM, label: t('tagging.add_custom_symptom') },
                ]}
                onPick={v => {
                  if (v === ADD_SYMPTOM) {
                    openCustomStep('symptom');
                    return;
                  }
                  setSelections({ ...selections, symptom: v, detail: '', region: '', subRegion: '', specificPart: '', medical: '' });
                  setTaggingStep('S_DET');
                }}
                onBack={() => setTaggingStep('S_CAT')}
                onSkip={onSkip}
                skipLabel={skipLabel}
              />
            )}
            {taggingStep === 'S_DET' && selections.group && selections.symptom && (
              (() => {
                const isCustomSymptom = !(selections.symptom in (SYMPTOM_WIZARD[selections.group] || {}));
                return (
              <WizardMenu
                title={selections.symptom}
                options={[
                  ...(!isCustomSymptom ? SYMPTOM_WIZARD[selections.group][selections.symptom].options.map(o => o.label) : []),
                  ...customDetailsFor(customSymptoms, selections.group, selections.symptom)
                    .map(label => ({ value: label, label, hint: t('symptom_sets.added_by_you') })),
                  { value: ADD_DETAIL, label: t('tagging.add_custom_detail') },
                ]}
                onPick={label => {
                  if (label === ADD_DETAIL) {
                    openCustomStep('detail');
                    return;
                  }
                  const groupConfig = SYMPTOM_WIZARD[selections.group]?.[selections.symptom];
                  const optionObj = groupConfig?.options.find(o => o.label === label);
                  const updatedSelections = {
                    ...selections,
                    detail: label,
                    medical: optionObj?.med || selections.medical || 'Custom',
                    region: optionObj?.forceRegion || '',
                    subRegion: optionObj?.forceSubRegion || ''
                  };
                  setSelections(updatedSelections);

                  if (optionObj?.forceSubRegion) {
                    setTaggingStep('R_DET');
                    return;
                  }
                  if (groupConfig?.skipRegion) {
                    const bundle = {
                      symptom: selections.symptom,
                      detail: label,
                      med: optionObj?.med || selections.medical || 'Custom',
                      region: 'N/A',
                      specificPart: 'Internal/General'
                    };
                    setTempSymptomList([...tempSymptomList, bundle]);
                    setTaggingStep('SUMMARY');
                  } else if (optionObj?.forceRegion) {
                    setTaggingStep('R_SUB');
                  } else {
                    setTaggingStep('R_CAT');
                  }
                }}
                onPrimaryAction={isCustomSymptom ? saveCustomSymptomToSummary : undefined}
                primaryActionLabel={isCustomSymptom ? t('tagging.save_continue_summary') : undefined}
                primaryActionIcon={isCustomSymptom ? <ArrowRightIcon className="w-4 h-4" /> : null}
                onBack={() => setTaggingStep('S_SYM')}
                onSkip={onSkip}
                skipLabel={skipLabel}
              />
                );
              })()
            )}

            {/* Step 3-5: Region Drill-Down */}
            {taggingStep === 'R_CAT' && (
              <WizardMenu
                title={t('tagging.region_title')}
                options={Object.keys(REGION_WIZARD)}
                onPick={v => { setPendingSpecificParts([]); setSelections({ ...selections, region: v }); setTaggingStep('R_SUB'); }}
                onSkip={onSkip}
                skipLabel={skipLabel}
              />
            )}
            {taggingStep === 'R_SUB' && selections.region && REGION_WIZARD[selections.region] && (
              <WizardMenu
                title={selections.region}
                options={Object.keys(REGION_WIZARD[selections.region])}
                onPick={v => { setPendingSpecificParts([]); setSelections({ ...selections, subRegion: v }); setTaggingStep('R_DET'); }}
                onBack={() => {
                  const optionObj = SYMPTOM_WIZARD[selections.group]?.[selections.symptom]?.options.find(o => o.label === selections.detail);
                  setTaggingStep(optionObj?.forceRegion ? 'S_DET' : 'R_CAT');
                }}
                onSkip={onSkip}
                skipLabel={skipLabel}
              />
            )}
            {taggingStep === 'R_DET' && selections.region && selections.subRegion &&
              REGION_WIZARD[selections.region]?.[selections.subRegion] && (
              <WizardMenu
                title={selections.subRegion}
                options={REGION_WIZARD[selections.region][selections.subRegion]}
                multiSelect
                selectedOptions={pendingSpecificParts}
                onToggleOption={v => {
                  setPendingSpecificParts(prev => prev.includes(v) ? prev.filter(part => part !== v) : [...prev, v]);
                }}
                onConfirmSelection={() => finalizeSymptomSelection(pendingSpecificParts)}
                confirmLabel={t('tagging.add_selected', { count: pendingSpecificParts.length })}
                onBack={() => {
                  setPendingSpecificParts([]);
                  const optionObj = SYMPTOM_WIZARD[selections.group]?.[selections.symptom]?.options.find(o => o.label === selections.detail);
                  setTaggingStep(optionObj?.forceSubRegion ? 'S_DET' : 'R_SUB');
                }}
                onSkip={onSkip}
                skipLabel={skipLabel}
              />
            )}
            {taggingStep === 'PI_R_CAT' && (
              <WizardMenu
                title={postIctalPickerTitle}
                options={Object.keys(REGION_WIZARD)}
                onPick={v => { setPendingSpecificParts([]); setSelections({ ...selections, region: v, subRegion: '' }); setTaggingStep('PI_R_SUB'); }}
                onBack={() => { setPostIctalTarget(null); setTaggingStep('SUMMARY'); }}
              />
            )}
            {taggingStep === 'PI_R_SUB' && selections.region && REGION_WIZARD[selections.region] && (
              <WizardMenu
                title={selections.region}
                options={Object.keys(REGION_WIZARD[selections.region])}
                onPick={v => { setPendingSpecificParts([]); setSelections({ ...selections, subRegion: v }); setTaggingStep('PI_R_DET'); }}
                onBack={() => setTaggingStep('PI_R_CAT')}
              />
            )}
            {taggingStep === 'PI_R_DET' && selections.region && selections.subRegion &&
              REGION_WIZARD[selections.region]?.[selections.subRegion] && (
              <WizardMenu
                title={selections.subRegion}
                options={REGION_WIZARD[selections.region][selections.subRegion]}
                multiSelect
                selectedOptions={pendingSpecificParts}
                onToggleOption={v => {
                  setPendingSpecificParts(prev => prev.includes(v) ? prev.filter(part => part !== v) : [...prev, v]);
                }}
                onConfirmSelection={() => finalizePostIctalAreaSelection(pendingSpecificParts)}
                confirmLabel={t('post_ictal.add_areas', { count: pendingSpecificParts.length })}
                onBack={() => {
                  setPendingSpecificParts([]);
                  setTaggingStep('PI_R_SUB');
                }}
              />
            )}
            {taggingStep === 'CUSTOM_INPUT' && (
              <TextEntryStep
                title={customMode === 'set' ? t('symptom_sets.name_title') : customMode === 'detail' ? t('tagging.custom_detail_title') : t('tagging.custom_symptom_title')}
                value={customDraft}
                onChange={setCustomDraft}
                onSubmit={submitCustomEntry}
                singleLine={customMode === 'set'}
                help={customMode === 'set' ? t('symptom_sets.name_help') : t('tagging.custom_remembered_help')}
                onBack={() => {
                  setCustomDraft('');
                  const previousStep = customMode === 'set' ? 'SUMMARY' : customMode === 'detail' ? 'S_DET' : 'S_SYM';
                  setCustomMode(null);
                  setTaggingStep(previousStep);
                }}
                placeholder={
                  customMode === 'set'
                    ? t('symptom_sets.name_placeholder')
                    : customMode === 'detail'
                      ? t('tagging.custom_detail_placeholder')
                      : t('tagging.custom_symptom_placeholder')
                }
                submitLabel={customMode === 'set' ? t('symptom_sets.save_set') : t('tagging.continue')}
              />
            )}
          </>
        )}

      </div>
    </div>
  );
}
