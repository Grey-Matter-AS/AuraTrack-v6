import { useState, useEffect } from 'react';
import { db } from '../data/db';
import i18n from '../i18n';
import { DEFAULT_WELLBEING_FACTORS } from '../data/constants';

const DEFAULTS = {
  // Identity & Mode
  userMode: 'CARETAKER',       // 'CARETAKER' | 'PATIENT' (displayed as "Self")
  personName: '',               // patient name or self name — used in reports
  caretakerName: '',
  dateOfBirth: '',
  emergencyContact: '',

  // Neurologist / Reports
  neurologistName: '',
  neurologistInstitution: '',
  neurologistContact: '',
  includePatientDOB: true,
  reportNotes: '',

  // Appearance
  theme: 'dark',               // 'dark' | 'light' | 'system'
  accentColor: 'red',          // 'red' | 'blue' | 'green' | 'purple' | 'amber'
  fontSize: 'normal',          // 'small' | 'normal' | 'large' | 'xlarge'

  // Display
  historyPageSize: 10,
  dateFormat: 'locale',        // 'locale' | 'ISO' | 'US' | 'EU'
  durationFormat: 'seconds',   // 'seconds' | 'human'
  timeFormat: '12h',           // '12h' | '24h'

  // Recording
  hapticFeedback: true,
  eegDiaryEnabled: false,
  wellbeingEnabled: true,
  wellbeingDailyReminderEnabled: false,
  wellbeingReminderTime: '20:00',
  wellbeingFactorDefinitions: DEFAULT_WELLBEING_FACTORS,
  quickNoteLabels: ['FELL', 'RESCUE MED', 'NOT RESPONDING', 'FULL BODY', 'LEFT SIDE', 'RIGHT SIDE'],

  // Data & Backup
  backupReminderEnabled: true,
  backupReminderIntervalDays: 7,
  lastSuccessfulBackupAt: 0,
  lastBackupReminderDismissedAt: 0,

  // Medication tracking
  medicationStartDate: '',      // ISO date string — first day to show in medication history
  assumeDosesTaken: false,      // unlogged scheduled doses become 'assumed' 90 min after their time
  assumeDosesTakenSince: '',    // ISO timestamp the setting was turned on — limits back-filling

  // Localisation
  language: 'en',               // ISO 639-1 language code
};

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const rows = await db.settings.toArray();
        const merged = { ...DEFAULTS };
        rows.forEach(row => { merged[row.key] = row.value; });
        if (merged.language && merged.language !== i18n.language) {
          i18n.changeLanguage(merged.language);
        }
        setSettings(merged);
      } catch (err) {
        console.error('Failed to load settings, using defaults:', err);
        setLastError({ scope: 'load_settings', message: 'Failed to load saved settings.' });
      }
    };
    loadSettings();
  }, []);

  const updateSettings = async (key, value) => {
    try {
      await db.settings.put({ key, value });
      setSettings(prev => ({ ...prev, [key]: value }));
      setLastError(null);
      return true;
    } catch (err) {
      console.error('Failed to save setting:', err);
      setLastError({ scope: 'save_setting', message: `Failed to save setting "${key}".` });
      throw err;
    }
  };

  const resetSettings = async () => {
    try {
      await db.settings.clear();
      setSettings(DEFAULTS);
      setLastError(null);
      return true;
    } catch (err) {
      console.error('Failed to reset settings:', err);
      setLastError({ scope: 'reset_settings', message: 'Failed to reset settings.' });
      throw err;
    }
  };

  return { settings, updateSettings, resetSettings, lastError, clearLastError: () => setLastError(null) };
}
