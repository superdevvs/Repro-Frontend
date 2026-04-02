const STORAGE_KEY = 'messaging.template-test-email';

export const getStoredTemplateTestEmail = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};

export const setStoredTemplateTestEmail = (email: string): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, email);
  } catch {
    // Ignore storage failures and keep the UI functional.
  }
};
