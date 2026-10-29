import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WizardMenu } from '../components/WizardMenu';
import { ArrowRightIcon } from '../components/AppIcons';
import Summary from '../components/Summary';
import { SYMPTOM_WIZARD, REGION_WIZARD, SEIZURE_TYPES } from '../data/constants';
import { db } from '../data/db';
import { TextArea } from '../components/ui';

const FAVORITES_KEY = 'favoriteSymptomSets';

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
}) {
  return (
    <div className="app-page-shell flex flex-col h-full mx-auto animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between items-center mb-8 shrink-0">
        {onBack ? (
          <button
            onClick={onBack}
            className="ui-btn ui-btn--secondary ui-btn--md"
          >
            ← BACK
          </button>
        ) : <div className="w-10" />}
        <p className="text-center font-black uppercase text-[11px] tracking-[0.3em]" style={{ color: 'var(--text-dim)' }}>{title}</p>
        <div className="w-10" />
      </div>

      <div className="space-y-4">
        <TextArea
          aria-label={placeholder}
          value={value}
          onChange={onChange}
          className="min-h-[140px]"
          placeholder={placeholder}
          autoFocus
        />
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
  postIctal, togglePostIctalFinding, addPostIctalParalysisLocations, removePostIctalParalysisLocation,
  editingId, activeEventId,
  manualDurations, editedTimers, setManualDuration,
  overrideDateTime, isManualEntry, setEventDateTime,
  elapsed, laps, startTime,
  onSave, onSkip, onCancel,
  durationFormat = 'seconds',
}) {
  const { t } = useTranslation();
  const skipLabel = t('tagging.skip_for_now');
  const [favoriteSets, setFavoriteSets] = useState([]);
  const [pendingSpecificParts, setPendingSpecificParts] = useState([]);
  const [customDraft, setCustomDraft] = useState('');
  const [customMode, setCustomMode] = useState(null);

  const finalizePostIctalParalysisSelection = (specificParts) => {
    if (!specificParts.length) return;
    addPostIctalParalysisLocations(specificParts.map((specificPart) => ({
      region: selections.region,
      subRegion: selections.subRegion,
      specificPart,
      label: "After-seizure Paralysis",
      med: "Todd's paralysis",
    })));
    setPendingSpecificParts([]);
    setTaggingStep('SUMMARY');
  };

  useEffect(() => {
    let mounted = true;
    db.settings.get(FAVORITES_KEY).then(row => {
      if (mounted) setFavoriteSets(Array.isArray(row?.value) ? row.value : []);
    }).catch(() => {
      if (mounted) setFavoriteSets([]);
    });
    return () => { mounted = false; };
  }, []);

  const updateFavoriteSets = async (nextSets) => {
    setFavoriteSets(nextSets);
    await db.settings.put({ key: FAVORITES_KEY, value: nextSets });
  };

  const openCustomStep = (mode) => {
    setCustomMode(mode);
    setCustomDraft('');
    setTaggingStep('CUSTOM_INPUT');
  };

  const submitCustomEntry = async () => {
    const value = customDraft.trim();
    if (!value) return;

    if (customMode === 'symptom') {
      setSelections({
        ...selections,
        symptom: value,
        detail: '',
        medical: 'Custom',
      });
      setTaggingStep('S_DET');
    } else if (customMode === 'detail') {
      setSelections({
        ...selections,
        detail: value,
        medical: selections.medical || 'Custom',
      });
      setTaggingStep('R_CAT');
    } else if (customMode === 'favorite') {
      const nextSets = [
        ...favoriteSets,
        {
          id: crypto.randomUUID(),
          name: value,
          symptoms: tempSymptomList.map(symptom => ({ ...symptom })),
        },
      ];
      await updateFavoriteSets(nextSets);
      setTaggingStep('SUMMARY');
    }
    setCustomDraft('');
    setCustomMode(null);
  };

  const addFavoriteSetToSelection = (favorite) => {
    setTempSymptomList([
      ...tempSymptomList,
      ...favorite.symptoms.map(symptom => ({ ...symptom })),
    ]);
    setTaggingStep('SUMMARY');
  };

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

  const handleTypeSelect = async (val) => {
    const targetId = editingId || activeEventId;
    if (!targetId) { console.error('No active event found'); return; }
    await db.events.update(targetId, { type: val });
    setSelections({ ...selections, type: val });
    setTaggingStep('S_CAT');
  };

  return (
    <div className="app-page-shell flex-1 min-h-full flex flex-col items-center overflow-y-auto py-4 custom-scrollbar animate-in fade-in slide-in-from-bottom-6">
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
              onEditPostIctalParalysis={() => {
                setPendingSpecificParts([]);
                setSelections({ ...selections, region: '', subRegion: '' });
                setTaggingStep('PI_R_CAT');
              }}
              onRemovePostIctalParalysisLocation={removePostIctalParalysisLocation}
              elapsed={elapsed}
              laps={laps}
              startTime={startTime}
              manualDurations={manualDurations}
              editedTimers={editedTimers}
              onSetManualDuration={setManualDuration}
              onAddAnother={() => setTaggingStep('S_CAT')}
              onSaveFavorite={() => openCustomStep('favorite')}
              onSave={onSave}
              onSkip={onSkip}
              onCancel={onCancel}
              onRemoveSymptom={index => setTempSymptomList(tempSymptomList.filter((_, i) => i !== index))}
              editingId={editingId}
              isManualEntry={isManualEntry}
              overrideDateTime={overrideDateTime}
              onSetEventDateTime={setEventDateTime}
              durationFormat={durationFormat}
            />
          </div>
        ) : (
          <>
            {/* Step 1: Seizure Type */}
            {taggingStep === 'TYPE' && (
              <WizardMenu
                title={t('tagging.step1_title')}
                options={SEIZURE_TYPES}
                onPick={handleTypeSelect}
                onSkip={onSkip}
                skipLabel={skipLabel}
              />
            )}

            {/* Step 2-4: Symptom Drill-Down */}
            {taggingStep === 'S_CAT' && (
              <WizardMenu
                title={t('tagging.feeling_title')}
                options={[
                  ...(favoriteSets.length ? ['Favorite Symptom Sets'] : []),
                  ...Object.keys(SYMPTOM_WIZARD),
                ]}
                onPick={v => {
                  if (v === 'Favorite Symptom Sets') {
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
            {taggingStep === 'FAV_PICK' && favoriteSets.length > 0 && (
              <WizardMenu
                title="Favorite Sets"
                options={favoriteSets.map(set => set.name)}
                onPick={name => {
                  const favorite = favoriteSets.find(set => set.name === name);
                  if (favorite) addFavoriteSetToSelection(favorite);
                }}
                onBack={() => setTaggingStep('S_CAT')}
                onSkip={onSkip}
                skipLabel={skipLabel}
              />
            )}
            {taggingStep === 'S_SYM' && selections.group && SYMPTOM_WIZARD[selections.group] && (
              <WizardMenu
                title={selections.group}
                options={[...Object.keys(SYMPTOM_WIZARD[selections.group]), '+ Add Custom Symptom']}
                onPick={v => {
                  if (v === '+ Add Custom Symptom') {
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
                options={
                  !isCustomSymptom
                    ? [...SYMPTOM_WIZARD[selections.group][selections.symptom].options.map(o => o.label), '+ Add Custom Detail']
                    : ['+ Add Custom Detail']
                }
                onPick={label => {
                  if (label === '+ Add Custom Detail') {
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
                primaryActionLabel={isCustomSymptom ? 'Save and Continue to Summary' : undefined}
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
                confirmLabel={pendingSpecificParts.length > 0 ? `Add ${pendingSpecificParts.length} Selected` : 'Add Selected'}
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
                title={t('tagging.post_ictal_paralysis', 'After-seizure paralysis')}
                options={Object.keys(REGION_WIZARD)}
                onPick={v => { setPendingSpecificParts([]); setSelections({ ...selections, region: v, subRegion: '' }); setTaggingStep('PI_R_SUB'); }}
                onBack={() => setTaggingStep('SUMMARY')}
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
                onConfirmSelection={() => finalizePostIctalParalysisSelection(pendingSpecificParts)}
                confirmLabel={pendingSpecificParts.length > 0
                  ? t('tagging.add_paralysis_areas', { count: pendingSpecificParts.length })
                  : t('tagging.add_paralysis_area', 'Add Paralysis Area')}
                onBack={() => {
                  setPendingSpecificParts([]);
                  setTaggingStep('PI_R_SUB');
                }}
              />
            )}
            {taggingStep === 'CUSTOM_INPUT' && (
              <TextEntryStep
                title={customMode === 'favorite' ? 'Favorite Set Name' : customMode === 'detail' ? 'Custom Detail' : 'Custom Symptom'}
                value={customDraft}
                onChange={setCustomDraft}
                onSubmit={submitCustomEntry}
                onBack={() => {
                  setCustomDraft('');
                  const previousStep = customMode === 'favorite' ? 'SUMMARY' : customMode === 'detail' ? 'S_DET' : 'S_SYM';
                  setCustomMode(null);
                  setTaggingStep(previousStep);
                }}
                placeholder={
                  customMode === 'favorite'
                    ? 'For example: Left arm sensory cluster'
                    : customMode === 'detail'
                      ? 'Describe the symptom detail or variant'
                      : 'Name the symptom to add under this menu'
                }
                submitLabel={customMode === 'favorite' ? 'Save Favorite Set' : 'Continue'}
              />
            )}
          </>
        )}

      </div>
    </div>
  );
}
