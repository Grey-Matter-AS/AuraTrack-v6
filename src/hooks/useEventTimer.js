import { useState, useEffect, useRef, useCallback } from 'react';
import { haptic } from '../utils/hapticFeedback';

const EMPTY_LAPS = { aura: null, seizure: null, recovery: null };
// Crash recovery keys: everything needed to resume a recording after the app is closed
export const RECOVERY_KEYS = ['aura_startTime', 'aura_status', 'aura_startDateReadable', 'aura_startTimeReadable', 'aura_laps', 'aura_notes'];

export function useEventTimer() {
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState(EMPTY_LAPS);
  const startTimeRef = useRef(null);
  const lapsRef = useRef(EMPTY_LAPS);

  useEffect(() => {
    let interval;
    if (isRunning && startTime) {
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  const startTimer = useCallback(() => {
    const now = Date.now();
    startTimeRef.current = now;
    setStartTime(now);
    setElapsed(0);
    lapsRef.current = EMPTY_LAPS;
    setLaps(EMPTY_LAPS);
    setIsRunning(true);
    try {
      localStorage.removeItem('aura_laps');
      localStorage.removeItem('aura_notes');
      localStorage.setItem('aura_startTime', now);
      localStorage.setItem('aura_status', 'RECORDING');
      localStorage.setItem('aura_startDateReadable', new Date(now).toLocaleDateString());
      localStorage.setItem('aura_startTimeReadable', new Date(now).toLocaleTimeString());
    } catch {
      // Private browsing or storage blocked — crash recovery unavailable, recording continues
    }
    return now;
  }, []);

  const stopTimer = useCallback(() => {
    if (!startTimeRef.current) {
      console.error('stopTimer called without startTime');
      return null;
    }
    setIsRunning(false);
    const endTime = Date.now();
    const duration = Math.floor((endTime - startTimeRef.current) / 1000);
    const finalLaps = { ...lapsRef.current, recovery: endTime };
    lapsRef.current = finalLaps;
    setLaps(finalLaps);
    let date, time;
    try {
      date = localStorage.getItem('aura_startDateReadable');
      time = localStorage.getItem('aura_startTimeReadable');
      RECOVERY_KEYS.forEach(k => localStorage.removeItem(k));
    } catch { /* ignore — private browsing */ }
    return { startTime: startTimeRef.current, endTime, duration, laps: finalLaps, date, time };
  }, []);

  // at: when the phase ended (default now). A seizure without an aura records the aura as ending at the start.
  const recordLap = useCallback((phase, at = Date.now()) => {
    const nextLaps = { ...lapsRef.current, [phase]: at };
    lapsRef.current = nextLaps;
    setLaps(nextLaps);
    try { localStorage.setItem('aura_laps', JSON.stringify(nextLaps)); } catch { /* private browsing */ }
    haptic(100);
  }, []);

  const restore = useCallback((savedStartTime) => {
    let savedLaps = EMPTY_LAPS;
    try { savedLaps = { ...EMPTY_LAPS, ...JSON.parse(localStorage.getItem('aura_laps') || '{}') }; } catch { /* none saved */ }
    lapsRef.current = savedLaps;
    setLaps(savedLaps);
    startTimeRef.current = savedStartTime;
    setStartTime(savedStartTime);
    setElapsed(Math.floor((Date.now() - savedStartTime) / 1000));
    setIsRunning(true);
  }, []);

  const setForEdit = useCallback((duration, eventLaps, eventStartTime) => {
    const nextLaps = eventLaps || EMPTY_LAPS;
    startTimeRef.current = eventStartTime || null;
    lapsRef.current = nextLaps;
    setElapsed(duration ?? 0);
    setLaps(nextLaps);
    setStartTime(eventStartTime || null);
  }, []);

  return { startTime, elapsed, laps, startTimer, stopTimer, recordLap, restore, setForEdit };
}
