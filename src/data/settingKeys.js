// Settings that are never copied by ongoing sync between two phones in use (who uses the phone, how
// it looks, its reminders). Restoring or setting up a new phone copies them too (scope 'all').
export const DEVICE_SETTING_KEYS = new Set([
  'userMode',
  'language',
  'theme',
  'accentColor',
  'fontSize',
  'historyPageSize',
  'dateFormat',
  'durationFormat',
  'timeFormat',
  'hapticFeedback',
  'wellbeingDailyReminderEnabled',
  'wellbeingReminderTime',
  'backupReminderEnabled',
  'backupReminderIntervalDays',
  'assumeDosesTaken',
  'assumeDosesTakenSince',
]);

// Of those, the ones about the device itself rather than a patient: kept once per device (the
// device database), so switching patient keeps the same mode, language and look
export const DEVICE_STORED_KEYS = new Set([
  'userMode',
  'language',
  'theme',
  'accentColor',
  'fontSize',
  'historyPageSize',
  'dateFormat',
  'durationFormat',
  'timeFormat',
  'hapticFeedback',
]);
