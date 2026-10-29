import { createContext, useContext } from 'react';

export const ToastContext = createContext(() => {});

// showToast(message, tone = 'info' | 'success' | 'error')
export function useToast() {
  return useContext(ToastContext);
}
