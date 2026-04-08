import type { Service } from '@/hooks/useServices';

type MetadataRecord = Record<string, unknown>;

export interface EditorServiceRate {
  serviceId?: string;
  serviceName: string;
  rate: number;
}

const toNumber = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const toRecord = (value: unknown): MetadataRecord =>
  value && typeof value === 'object' ? (value as MetadataRecord) : {};

export const normalizeEditorServiceName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const isPhotoServiceName = (name: string) => /photo|hdr|twilight/i.test(name);

export const isVideoServiceName = (name: string) => /video/i.test(name);

export const isVirtualStagingServiceName = (name: string) =>
  /virtual\s*staging/i.test(name);

export const extractPhotoCountFromServiceName = (name: string) => {
  const match = name.match(/(\d+)\s*photo/i);
  return match ? Number(match[1]) : 0;
};

const getServiceMatchScore = (left: string, right: string) => {
  const normalizedLeft = normalizeEditorServiceName(left);
  const normalizedRight = normalizeEditorServiceName(right);

  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 3;
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return 2;
  return 0;
};

const sanitizeServiceRate = (value: unknown): EditorServiceRate | null => {
  if (!value || typeof value !== 'object') return null;

  const record = value as MetadataRecord;
  const serviceName = String(record.service_name ?? record.serviceName ?? '').trim();
  if (!serviceName) return null;

  const serviceIdValue = record.service_id ?? record.serviceId;
  const serviceId =
    serviceIdValue === undefined || serviceIdValue === null || String(serviceIdValue).trim() === ''
      ? undefined
      : String(serviceIdValue);

  return {
    serviceId,
    serviceName,
    rate: toNumber(record.rate),
  };
};

const dedupeServiceRates = (rates: EditorServiceRate[]) => {
  const seen = new Set<string>();
  return rates.filter((rate) => {
    const key = rate.serviceId || normalizeEditorServiceName(rate.serviceName);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const findPreferredService = (
  services: Service[],
  matcher: (name: string) => boolean,
) => services.find((service) => matcher(service.name));

const buildLegacyServiceRates = (
  metadata: MetadataRecord,
  services: Service[],
): EditorServiceRate[] => {
  const defaults = [
    {
      matcher: isPhotoServiceName,
      fallbackName: 'Photography',
      rate: toNumber(metadata.photo_edit_rate ?? metadata.photoEditRate),
    },
    {
      matcher: isVideoServiceName,
      fallbackName: 'Video',
      rate: toNumber(metadata.video_edit_rate ?? metadata.videoEditRate),
    },
    {
      matcher: isVirtualStagingServiceName,
      fallbackName: 'Virtual Staging',
      rate: toNumber(
        metadata.virtual_staging_rate ??
          metadata.virtualStagingRate ??
          metadata.floorplan_rate ??
          metadata.floorplanRate,
      ),
    },
  ];

  return defaults.map(({ matcher, fallbackName, rate }) => {
    const service = findPreferredService(services, matcher);
    return {
      serviceId: service?.id,
      serviceName: service?.name || fallbackName,
      rate,
    };
  });
};

export const getStoredEditorServiceRates = (metadata: unknown): EditorServiceRate[] => {
  const record = toRecord(metadata);
  const rawRates = record.service_rates ?? record.serviceRates ?? record.editing_service_rates;

  if (!Array.isArray(rawRates)) return [];

  return dedupeServiceRates(
    rawRates
      .map((value) => sanitizeServiceRate(value))
      .filter((value): value is EditorServiceRate => Boolean(value)),
  );
};

export const getEditorServiceRates = (
  metadata: unknown,
  services: Service[] = [],
): EditorServiceRate[] => {
  const record = toRecord(metadata);
  const hasExplicitStoredRates =
    Array.isArray(record.service_rates) ||
    Array.isArray(record.serviceRates) ||
    Array.isArray(record.editing_service_rates);
  const storedRates = getStoredEditorServiceRates(record);

  if (hasExplicitStoredRates) {
    return dedupeServiceRates(
      storedRates.map((rate) => {
        const matchedService = rate.serviceId
          ? services.find((service) => String(service.id) === String(rate.serviceId))
          : services.find((service) => getServiceMatchScore(service.name, rate.serviceName) > 0);

        return {
          serviceId: matchedService?.id || rate.serviceId,
          serviceName: matchedService?.name || rate.serviceName,
          rate: toNumber(rate.rate),
        };
      }),
    );
  }

  return dedupeServiceRates(buildLegacyServiceRates(record, services));
};

export const getEditorServiceName = (service: unknown) => {
  if (typeof service === 'string') return service;
  if (!service || typeof service !== 'object') return '';

  const record = service as MetadataRecord;
  return String(record.name ?? record.label ?? record.service_name ?? '').trim();
};

export const getEditorServiceId = (service: unknown) => {
  if (!service || typeof service !== 'object') return undefined;

  const record = service as MetadataRecord;
  const serviceId = record.id ?? record.service_id ?? toRecord(record.pivot).service_id;

  if (serviceId === undefined || serviceId === null || String(serviceId).trim() === '') {
    return undefined;
  }

  return String(serviceId);
};

export const getEditorServiceQuantity = (service: unknown) => {
  if (!service || typeof service !== 'object') return 1;

  const record = service as MetadataRecord;
  const pivot = toRecord(record.pivot);
  const rawQuantity = record.quantity ?? pivot.quantity ?? record.qty ?? record.count;
  const quantity = toNumber(rawQuantity);
  return quantity > 0 ? quantity : 1;
};

export const getExplicitEditorPhotoCount = (service: unknown) => {
  if (!service || typeof service !== 'object') return 0;

  const record = service as MetadataRecord;
  const pivot = toRecord(record.pivot);
  return toNumber(record.photo_count ?? record.photoCount ?? pivot.photo_count);
};

export const findMatchingEditorRate = (
  service: unknown,
  rates: EditorServiceRate[],
) => {
  const serviceId = getEditorServiceId(service);
  if (serviceId) {
    const exactIdMatch = rates.find(
      (rate) => rate.serviceId && String(rate.serviceId) === String(serviceId),
    );
    if (exactIdMatch) return exactIdMatch;
  }

  const serviceName = getEditorServiceName(service);
  if (!serviceName) return null;

  let bestMatch: EditorServiceRate | null = null;
  let bestScore = 0;

  rates.forEach((rate) => {
    const score = getServiceMatchScore(serviceName, rate.serviceName);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = rate;
    }
  });

  return bestMatch;
};

export const getEditorRatePayload = (rates: EditorServiceRate[]) => {
  const sanitizedRates = dedupeServiceRates(
    rates.map((rate) => ({
      serviceId: rate.serviceId,
      serviceName: rate.serviceName.trim(),
      rate: toNumber(rate.rate),
    })),
  ).filter((rate) => rate.serviceName);

  return {
    photo_edit_rate:
      sanitizedRates.find((rate) => isPhotoServiceName(rate.serviceName))?.rate ?? 0,
    video_edit_rate:
      sanitizedRates.find((rate) => isVideoServiceName(rate.serviceName))?.rate ?? 0,
    virtual_staging_rate:
      sanitizedRates.find((rate) => isVirtualStagingServiceName(rate.serviceName))?.rate ?? 0,
    floorplan_rate: 0,
    other_rate: 0,
    service_rates: sanitizedRates.map((rate) => ({
      service_id: rate.serviceId,
      service_name: rate.serviceName,
      rate: toNumber(rate.rate),
    })),
  };
};
