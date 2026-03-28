export function setNestedDraftValue<T extends Record<string, any>>(
  source: T,
  field: string,
  value: unknown,
): T {
  const keys = field.split('.').filter(Boolean);
  if (keys.length === 0) {
    return source;
  }

  const root: Record<string, any> = Array.isArray(source)
    ? [...source]
    : { ...source };

  let currentRoot: Record<string, any> = root;
  let currentSource: Record<string, any> = source;

  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    const nextSource = currentSource?.[key];
    const nextValue = Array.isArray(nextSource)
      ? [...nextSource]
      : nextSource && typeof nextSource === 'object'
        ? { ...nextSource }
        : {};

    currentRoot[key] = nextValue;
    currentRoot = nextValue;
    currentSource = nextSource ?? {};
  }

  currentRoot[keys[keys.length - 1]] = value;
  return root as T;
}
