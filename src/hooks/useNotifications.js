import { useState, useCallback } from 'react';
import i18n from '../i18n';
import { defaultScheduledTimes, scheduledTimestampForToday, slotDose } from '../utils/medicationSchedule';
import { localDayKey } from './useWellbeing';

// Module-level timer store so timers survive component re-renders
const pendingTimers = new Map();

function clearAllTimers() {
  for (const id of pendingTimers.values()) clearTimeout(id);
  pendingTimers.clear();
}

// Through the service worker where possible, so tapping the reminder opens the app (see
// public/notification-click.js); a plain notification otherwise, which focuses the app on tap
async function show(title, { body, tag, target }) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const plain = () => {
    const notification = new Notification(title, { body, tag });
    notification.onclick = () => { window.focus(); notification.close(); };
  };
  try {
    const sw = await navigator.serviceWorker?.ready;
    if (sw?.showNotification) {
      await sw.showNotification(title, { body, tag, icon: '/favicon.svg', badge: '/favicon.svg', data: { target } });
    } else {
      plain();
    }
  } catch {
    try { plain(); } catch { /* not supported */ }
  }
}

function fireNotification(med, hhMM) {
  // With several patients the reminder says whose medicine it is
  const title = med.patientLabel
    ? i18n.t('notifications.dose_title_for', { name: med.name, patient: med.patientLabel })
    : i18n.t('notifications.dose_title', { name: med.name });
  return show(title, {
    body: i18n.t('notifications.dose_body', { dose: `${slotDose(med, hhMM)}${med.unit}` }),
    tag: `med-${med.uuid || med.id}-${hhMM}`,
    target: 'doses',
  });
}

function fireWellbeingNotification() {
  return show(i18n.t('wellbeing.notification_title', "Log today's wellbeing"), {
    body: i18n.t('wellbeing.notification_body', 'Add mood and context while it is still fresh.'),
    tag: `wellbeing-${localDayKey()}`,
    target: 'wellbeing',
  });
}

export function useNotifications() {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'denied';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const scheduleForToday = useCallback((medications, wellbeingReminder = null) => {
    clearAllTimers();
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const now = Date.now();
    for (const med of medications) {
      if (!med.active || med.isRescue || !med.reminderEnabled) continue;
      const times = med.scheduledTimes ?? defaultScheduledTimes(med.frequency);
      for (const hhMM of times) {
        const targetMs = scheduledTimestampForToday(hhMM);
        const delay = targetMs - now;
        if (delay < 60_000) continue; // already past or less than 1 min away
        const key = `${med.uuid || med.id}-${hhMM}`;
        const timerId = setTimeout(() => fireNotification(med, hhMM), delay);
        pendingTimers.set(key, timerId);
      }
    }

    if (wellbeingReminder?.enabled && !wellbeingReminder.hasTodayEntry && wellbeingReminder.time) {
      const targetMs = scheduledTimestampForToday(wellbeingReminder.time);
      const delay = targetMs - now;
      if (delay >= 60_000) {
        const timerId = setTimeout(() => fireWellbeingNotification(), delay);
        pendingTimers.set(`wellbeing-${wellbeingReminder.time}`, timerId);
      }
    }
  }, []);

  const cancelAll = useCallback(() => {
    clearAllTimers();
  }, []);

  return { permission, requestPermission, scheduleForToday, cancelAll };
}
