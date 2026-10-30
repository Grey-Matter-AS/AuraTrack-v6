// A patient's display name: their profile name, or "Patient 2" when none was given
export const patientName = (profile, profiles, t) =>
  profile?.name || t('patients.unnamed', { number: Math.max(1, profiles.indexOf(profile) + 1) });
