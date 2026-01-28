export type RefreshHandler = () => void | Promise<void>;

const editingRequestHandlers = new Set<RefreshHandler>();
const shootListHandlers = new Set<RefreshHandler>();
const shootHistoryHandlers = new Set<RefreshHandler>();
const invoiceHandlers = new Set<RefreshHandler>();
const shootDetailHandlers = new Map<string, Set<RefreshHandler>>();
const shootDetailDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

const DEFAULT_DEBOUNCE_MS = 300;

const createDebouncedTrigger = (invoke: () => void, delay = DEFAULT_DEBOUNCE_MS) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      timeout = null;
      invoke();
    }, delay);
  };
};

const safeInvoke = (handler: RefreshHandler) => {
  try {
    const result = handler();
    if (result && typeof (result as Promise<void>).catch === 'function') {
      (result as Promise<void>).catch(() => undefined);
    }
  } catch {
    // swallow refresh errors to avoid cascading failures
  }
};

export const registerEditingRequestsRefresh = (handler: RefreshHandler) => {
  editingRequestHandlers.add(handler);
  return () => {
    editingRequestHandlers.delete(handler);
  };
};

export const triggerEditingRequestsRefresh = createDebouncedTrigger(() => {
  editingRequestHandlers.forEach(safeInvoke);
});

export const registerShootListRefresh = (handler: RefreshHandler) => {
  shootListHandlers.add(handler);
  return () => {
    shootListHandlers.delete(handler);
  };
};

export const triggerShootListRefresh = createDebouncedTrigger(() => {
  shootListHandlers.forEach(safeInvoke);
});

export const registerShootHistoryRefresh = (handler: RefreshHandler) => {
  shootHistoryHandlers.add(handler);
  return () => {
    shootHistoryHandlers.delete(handler);
  };
};

export const triggerShootHistoryRefresh = createDebouncedTrigger(() => {
  shootHistoryHandlers.forEach(safeInvoke);
});

export const registerInvoicesRefresh = (handler: RefreshHandler) => {
  invoiceHandlers.add(handler);
  return () => {
    invoiceHandlers.delete(handler);
  };
};

export const triggerInvoicesRefresh = createDebouncedTrigger(() => {
  invoiceHandlers.forEach(safeInvoke);
});

export const registerShootDetailRefresh = (shootId: string | number, handler: RefreshHandler) => {
  const key = String(shootId);
  if (!key) {
    return () => undefined;
  }
  const handlers = shootDetailHandlers.get(key) ?? new Set<RefreshHandler>();
  handlers.add(handler);
  shootDetailHandlers.set(key, handlers);
  return () => {
    const nextHandlers = shootDetailHandlers.get(key);
    if (!nextHandlers) return;
    nextHandlers.delete(handler);
    if (nextHandlers.size === 0) {
      shootDetailHandlers.delete(key);
    }
  };
};

export const triggerShootDetailRefresh = (shootId?: string | number | null) => {
  if (shootId == null) return;
  const key = String(shootId);
  const handlers = shootDetailHandlers.get(key);
  if (!handlers) return;

  const existingTimer = shootDetailDebounceTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timeout = setTimeout(() => {
    shootDetailDebounceTimers.delete(key);
    const latestHandlers = shootDetailHandlers.get(key);
    if (!latestHandlers) return;
    latestHandlers.forEach(safeInvoke);
  }, DEFAULT_DEBOUNCE_MS);

  shootDetailDebounceTimers.set(key, timeout);
};
