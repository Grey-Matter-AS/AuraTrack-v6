import { useCallback, useState } from 'react';

// Screens as a stack (still state-based routing, no URLs). Opening a screen pushes it; Back pops it,
// so every Back returns to where the user came from, with that screen's tab, filters and page kept
// in its entry. The header's History / Settings / Help start fresh from home. Recording and tagging
// a new seizure replace the stack: there is nothing to go back to mid-recording.
const HOME = { view: 'IDLE' };

export function useNavigation() {
  const [stack, setStack] = useState([HOME]);
  const current = stack[stack.length - 1];

  const navigate = useCallback((view, params = {}) => setStack(prev => [...prev, { view, ...params }]), []);
  const openFromHome = useCallback((view, params = {}) => setStack([HOME, { view, ...params }]), []);
  const reset = useCallback((view = 'IDLE', params = {}) => setStack(view === 'IDLE' ? [HOME] : [{ view, ...params }]), []);
  const goBack = useCallback(() => setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : [HOME])), []);
  // Remembers the current screen's own state (tab, filters, page) for when the user comes back
  const updateCurrent = useCallback(patch => setStack(prev => [
    ...prev.slice(0, -1),
    { ...prev[prev.length - 1], ...(typeof patch === 'function' ? patch(prev[prev.length - 1]) : patch) },
  ]), []);

  return { current, status: current.view, depth: stack.length, navigate, openFromHome, reset, goBack, updateCurrent };
}
