import { useCallback, useEffect, useMemo, useState } from 'react';
import i18n from '../i18n';
import { db } from '../data/db';
import { makeUUID } from '../utils/ids';
import { buildEditLog } from '../utils/editLog';
import { localDateKey } from '../utils/dates';
import { deleteRecord } from '../data/records';
import { DEFAULT_WELLBEING_FACTORS } from '../data/constants';

export const localDayKey = localDateKey;

export function normalizeFactorDefinitions(definitions = DEFAULT_WELLBEING_FACTORS) {
  const source = Array.isArray(definitions) && definitions.length ? definitions : DEFAULT_WELLBEING_FACTORS;
  return source
    .map((factor, index) => {
      const label = String(factor.label || '').trim();
      if (!label) return null;
      const id = String(factor.id || label.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/^-|-$/g, '') || `factor-${index}`;
      const type = ['boolean', 'scale', 'number'].includes(factor.type) ? factor.type : 'boolean';
      return {
        id,
        label,
        labelKey: typeof factor.labelKey === 'string' ? factor.labelKey : '',
        type,
        unit: String(factor.unit || '').trim().slice(0, 16),
        help: String(factor.help || '').trim().slice(0, 240),
        helpKey: typeof factor.helpKey === 'string' ? factor.helpKey : '',
        scaleLabels: Array.isArray(factor.scaleLabels)
          ? factor.scaleLabels.map(label => String(label || '').trim()).filter(Boolean).slice(0, 4)
          : null,
        scaleLabelKeys: Array.isArray(factor.scaleLabelKeys)
          ? factor.scaleLabelKeys.map(key => String(key || '').trim()).filter(Boolean).slice(0, 4)
          : null,
        saveZero: factor.saveZero === true,
        active: factor.active !== false,
      };
    })
    .filter(Boolean);
}

function normalizeFactorValues(values = {}, definitions = []) {
  const factors = {};
  definitions.forEach((definition) => {
    const raw = values[definition.id];
    if (definition.type === 'boolean') {
      if (raw === true || raw?.value === true) {
        factors[definition.id] = { ...definition, value: true };
      }
      return;
    }
    if (definition.type === 'scale') {
      const n = Number(raw?.value ?? raw);
      if (Number.isFinite(n) && (n > 0 || definition.saveZero)) {
        factors[definition.id] = { ...definition, value: Math.min(3, Math.max(0, Math.round(n))) };
      }
      return;
    }
    if (definition.type === 'number') {
      const n = Number(raw?.value ?? raw);
      if (Number.isFinite(n) && n >= 0) {
        factors[definition.id] = { ...definition, value: n };
      }
    }
  });
  return factors;
}

export function useWellbeing(settings = {}) {
  const [entries, setEntries] = useState([]);
  const [lastError, setLastError] = useState(null);
  const factorDefinitions = useMemo(
    () => normalizeFactorDefinitions(settings.wellbeingFactorDefinitions),
    [settings.wellbeingFactorDefinitions]
  );

  const load = useCallback(async () => {
    try {
      const rows = await db.wellbeingEntries.orderBy('recordedAt').reverse().toArray();
      setEntries(rows);
      setLastError(null);
      return rows;
    } catch (err) {
      console.error('Failed to load wellbeing entries:', err);
      setLastError({ scope: 'load_wellbeing', message: i18n.t('wellbeing.load_failed', 'Failed to load wellbeing entries.') });
      setEntries([]);
      return [];
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  const todayEntries = useMemo(() => {
    const today = localDayKey();
    return entries.filter(entry => entry.dayKey === today);
  }, [entries]);

  const saveEntry = useCallback(async (payload = {}, existingId = null) => {
    const now = Date.now();
    const recordedAt = Number(payload.recordedAt || now);
    const primaryMood = String(payload.primaryMood || '').trim();
    if (!primaryMood) throw new Error(i18n.t('wellbeing.choose_mood_error', 'Choose a mood before saving.'));
    const intensity = Math.min(3, Math.max(1, Math.round(Number(payload.intensity || 1))));
    const factors = normalizeFactorValues(payload.factors, factorDefinitions);
    const notes = String(payload.notes || '').trim();

    if (existingId) {
      const existing = await db.wellbeingEntries.get(existingId);
      if (!existing) return null;
      const changedFields = [];
      if (existing.recordedAt !== recordedAt) changedFields.push('recordedAt');
      if (existing.primaryMood !== primaryMood) changedFields.push('primaryMood');
      if (existing.intensity !== intensity) changedFields.push('intensity');
      if (JSON.stringify(existing.factors || {}) !== JSON.stringify(factors)) changedFields.push('factors');
      if ((existing.notes || '') !== notes) changedFields.push('notes');
      await db.wellbeingEntries.update(existingId, {
        recordedAt,
        dayKey: localDayKey(recordedAt),
        primaryMood,
        intensity,
        factors,
        notes,
        isEdited: true,
        editLog: buildEditLog(existing, changedFields),
        updatedAt: now,
      });
      await load();
      return db.wellbeingEntries.get(existingId);
    }

    const id = await db.wellbeingEntries.add({
      uuid: makeUUID(),
      recordedAt,
      dayKey: localDayKey(recordedAt),
      primaryMood,
      intensity,
      factors,
      notes,
      isEdited: false,
      editLog: [],
      createdAt: now,
      updatedAt: now,
    });
    await load();
    return db.wellbeingEntries.get(id);
  }, [factorDefinitions, load]);

  const deleteEntry = useCallback(async (id) => {
    await deleteRecord('wellbeingEntries', id);
    await load();
  }, [load]);

  return {
    entries,
    todayEntries,
    factorDefinitions,
    load,
    saveEntry,
    deleteEntry,
    lastError,
    clearLastError: () => setLastError(null),
  };
}
