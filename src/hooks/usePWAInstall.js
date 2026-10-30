import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const DISMISSED_KEY = 'pwa_install_dismissed';

const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const isIOSDevice = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt]               = useState(null);
  const [isVisible, setIsVisible]                         = useState(false);
  const [showManualInstructions, setShowManualInstructions] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({ onRegisteredSW() {}, onRegisterError() {} });

  const ios = isIOSDevice();

  useEffect(() => {
    if (isInstalled()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    if (ios) {
      const t = setTimeout(() => setIsVisible(true), 3000);
      return () => clearTimeout(t);
    }

    let delayTimer;
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      delayTimer = setTimeout(() => setIsVisible(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(delayTimer);
    };
  }, [ios]);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsVisible(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setIsVisible(false);
  };

  const resetDismissal = () => {
    localStorage.removeItem(DISMISSED_KEY);
    if (isInstalled()) return;
    if (deferredPrompt || ios) {
      setIsVisible(true);
    } else {
      // Browser hasn't offered the install prompt (already dismissed, or eligibility not met).
      // Show manual instructions instead.
      setShowManualInstructions(true);
      setIsVisible(true);
    }
  };

  const dismissManual = () => {
    setShowManualInstructions(false);
    setIsVisible(false);
  };

  // Show the Settings re-prompt button whenever the app isn't installed, regardless of
  // whether deferredPrompt is currently available — it may arrive in a future session.
  const canInstallManually = !isInstalled();

  return {
    isVisible,
    isIOS: ios && !deferredPrompt,
    install,
    dismiss,
    resetDismissal,
    canInstallManually,
    needRefresh,
    updateServiceWorker,
    showManualInstructions,
    dismissManual,
  };
}
