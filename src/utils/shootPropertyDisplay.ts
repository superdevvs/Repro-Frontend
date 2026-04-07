export const formatPropertyMetricValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';

  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    return Number.isInteger(numericValue)
      ? numericValue.toLocaleString()
      : numericValue.toString();
  }

  return String(value);
};

export const getSplitBathroomDisplay = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;

  const fullBaths = Math.trunc(numericValue);
  const fractionalPart = Math.abs(numericValue - fullBaths);

  if (Math.abs(fractionalPart - 0.5) > 0.0001) {
    return null;
  }

  return {
    fullBaths: fullBaths.toLocaleString(),
    halfBaths: '1',
  };
};
