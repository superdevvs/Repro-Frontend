const disabledValues = new Set(['0', 'false', 'off', 'disabled']);

/**
 * Deployment kill switch. The workflow is enabled by default so existing
 * environments do not need an immediate configuration change; setting the
 * variable to false disables both the launch action and deep-link entry.
 */
export const isComplimentaryReshootEnabled = !disabledValues.has(
  String(import.meta.env.VITE_COMPLIMENTARY_RESHOOT_ENABLED ?? 'true').trim().toLowerCase(),
);
