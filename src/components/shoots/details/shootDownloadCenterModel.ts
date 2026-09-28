import type { ShootData, ShootFileData } from '@/types/shoots';
import { getShootServiceItems, type NormalizedShootServiceItem } from '@/utils/shootServiceItems';
import { buildTourUrl } from '@/features/shoot-units/unitTourData';
import { getServiceUnitId } from '@/features/shoot-units/shootUnitData';

type RecordData = Record<string, unknown>;
export type ShootDownloadItem = {
  id: string;
  label: string;
  subtitle?: string;
  href?: string;
  fileId?: string | number;
  kind: 'video' | 'floorplan' | 'file';
  action?: 'link' | 'download';
  format?: 'jpg';
  page?: number;
};
export type LinkDownload = ShootDownloadItem;
export type ShootDownloadCenterOptions = {
  isClient: boolean;
  canDownloadWholeShoot: boolean;
  canAccessTours: boolean;
  baseUrl: string;
  unitId?: string | number | null;
};

const record = (value: unknown): RecordData => value && typeof value === 'object' ? value as RecordData : {};
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const flag = (value: unknown): boolean => value === true || value === 1 || value === '1' || value === 'true';
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const ready = (value: unknown) => ['verified', 'final', 'completed', 'delivered', 'client_delivered'].includes(text(value).toLowerCase());
const extension = (value: unknown) => text(value).toLowerCase().match(/\.([a-z0-9]+)(?:$|[?#])/)?.[1] ?? '';
const safeUrl = (value: unknown, baseUrl: string): string => {
  const candidate = text(value);
  if (!candidate) return '';
  try {
    const url = new URL(candidate, baseUrl);
    const permittedProtocol = url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === new URL(baseUrl).origin);
    return permittedProtocol && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
};
const firstUrl = (baseUrl: string, ...values: unknown[]) => values.map(value => safeUrl(value, baseUrl)).find(Boolean) ?? '';
const fileName = (file: ShootFileData) => file.filename || file.stored_filename || file.storedFilename || 'Download file';
const fileLineId = (file: ShootFileData) => String(file.shoot_service_id ?? file.shootServiceId ?? '');
const classifiedType = (file: ShootFileData) => {
  const value = text(record(file).download_asset_type);
  return ['photos', 'videos', 'floorplans', 'other'].includes(value) ? value : '';
};
const serviceText = (service: NormalizedShootServiceItem) => {
  const source = record(service.source);
  const category = typeof source.category === 'string' ? source.category : record(source.category).name;
  return `${service.name} ${text(category)}`.toLowerCase();
};
const isVideo = (file: ShootFileData) => {
  const classified = classifiedType(file);
  if (classified) return classified === 'videos';
  const type = `${file.media_type ?? ''} ${file.file_type ?? file.fileType ?? ''}`.toLowerCase();
  return /\bvideo\b/.test(type) || ['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv'].includes(extension(fileName(file) || file.url));
};
const isPdf = (file: ShootFileData) => /pdf/i.test(file.file_type ?? file.fileType ?? '') || extension(fileName(file)) === 'pdf';
const isImage = (file: ShootFileData) => {
  const classified = classifiedType(file);
  if (classified === 'photos') return true;
  if (classified === 'videos' || classified === 'other') return false;
  return /image\//i.test(file.file_type ?? file.fileType ?? '')
    || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tif', 'tiff', 'heic', 'heif'].includes(extension(fileName(file)));
};
const homeReport = (value: RecordData) => /home[_ -]?report/i.test(`${text(value.provider_asset_key)} ${text(value.asset_key)} ${text(value.label)}`);

const isFloorplan = (file: ShootFileData, service?: NormalizedShootServiceItem) => {
  const classified = classifiedType(file);
  if (classified) return classified === 'floorplans';
  const data = record(file);
  if (homeReport(data) || isVideo(file)) return false;
  if (isPdf(file) || /floor[ _-]?plan/i.test(file.media_type ?? '')) return true;
  if (!isImage(file)) return false;
  if (/iguide|cubicasa/i.test(text(data.media_source)) || /^(pdf|jpg)_/i.test(text(data.provider_asset_key))) return true;
  const description = service ? serviceText(service) : '';
  return /floor[ _-]?plan|iguide|cubicasa/.test(description) && !/photo|hdr|video|drone/.test(description);
};

const isVisibleFile = (file: ShootFileData, isClient: boolean) => {
  const data = record(file);
  const scan = text(data.scan_status);
  if (scan && scan !== 'clean') return false;
  if (isClient && flag(file.is_hidden)) return false;
  const extra = data.is_extra == null
    ? file.media_type === 'extra' || /[/\\]extra[/\\]/i.test(file.path ?? '')
    : flag(data.is_extra);
  if (extra && !flag(data.required_for_editing)) return false;
  if (!isClient) return true;
  if (/^raw$/i.test(file.file_type ?? file.fileType ?? '')) return false;
  const stage = text(file.workflow_stage ?? file.workflowStage);
  if (stage) return ready(stage);
  return file.media_type === 'edited' || file.file_type === 'edited' || /[/\\]final[/\\]/i.test(file.path ?? file.url ?? '');
};

const dedupe = (items: ShootDownloadItem[]) => {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.fileId != null ? `${item.fileId}:${item.format ?? 'original'}:${item.page ?? ''}` : item.href ?? item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function buildShootDownloadCenterModel(shoot: ShootData | null | undefined, options: ShootDownloadCenterOptions) {
  const model = {
    wholeShootPhotoCount: 0,
    services: [] as Array<{ id: string; name: string; shootServiceId: string; photoCount: number }>,
    editedVideos: [] as ShootDownloadItem[],
    videoLinks: [] as ShootDownloadItem[],
    threeDLinks: [] as ShootDownloadItem[],
    floorplanPdfs: [] as ShootDownloadItem[],
    floorplanJpgs: [] as ShootDownloadItem[],
    tourLinks: [] as ShootDownloadItem[],
    totalItems: 0,
  };
  if (!shoot) return model;
  const { isClient, canDownloadWholeShoot, canAccessTours, baseUrl, unitId } = options;
  const wholeAccess = !isClient || canDownloadWholeShoot;
  const source = record(shoot);
  const allServices = getShootServiceItems(shoot).filter(service => unitId == null || getServiceUnitId(service.source) === String(unitId));
  const eligible = allServices.filter(service => service.isDeliverable && !service.isInvoiceAdjustment
    && service.workflowStatus !== 'cancelled'
    && (wholeAccess || (service.isUnlockedForDelivery && ['ready', 'delivered'].includes(service.deliveryStatus ?? ''))));
  const eligibleIds = new Set(eligible.map(service => service.id));
  const linkServices = eligible.filter(service => !isClient || !service.deliveryStatus
    || ['ready', 'delivered'].includes(service.deliveryStatus));
  const linkServiceIds = new Set(linkServices.map(service => service.id));
  const ordered = (pattern: RegExp) => linkServices.some(service => pattern.test(serviceText(service)));
  // Older single-shoot payloads can predate service-line serialization. Only
  // fully released shoots may use their existing published links as evidence.
  const legacyLinks = wholeAccess && unitId == null && allServices.length === 0;
  const generic3d = linkServices.some(service => /\b3d\b|three[ -]?dimensional/i.test(serviceText(service))
    && !/matterport|iguide|i[ -]?guide|cubicasa|zillow/i.test(serviceText(service)));
  const canUseProvider = (provider: string) => legacyLinks || ordered(new RegExp(provider, 'i')) || generic3d;
  const videoOrdered = legacyLinks || linkServices.some(service => /video/.test(serviceText(service))
    || ['video', 'photo_video'].includes(text(record(service.source).upload_intake_type ?? record(service.source).uploadIntakeType)));
  const files = array(shoot.files).map(value => value as ShootFileData).filter(file => {
    if (!isVisibleFile(file, isClient)) return false;
    const id = fileLineId(file);
    if (unitId != null && !eligibleIds.has(id)) return false;
    if (!wholeAccess && !eligibleIds.has(id)) return false;
    return !id || !allServices.some(service => service.id === id) || eligibleIds.has(id);
  });
  const photos = files.filter(file => isImage(file) && !isVideo(file)
    && !isFloorplan(file, allServices.find(service => service.id === fileLineId(file))));
  model.wholeShootPhotoCount = wholeAccess ? photos.length : 0;
  model.services = eligible.map(service => ({ id: service.id, name: service.name, shootServiceId: service.id,
    photoCount: photos.filter(file => fileLineId(file) === service.id).length })).filter(service => service.photoCount > 0);

  for (const file of files) {
    const item: ShootDownloadItem = { id: `file-${file.id}`, label: fileName(file), fileId: file.id, kind: 'file', action: 'download' };
    if (isVideo(file)) {
      const stage = text(file.workflow_stage ?? file.workflowStage);
      if (!stage || ready(stage)) model.editedVideos.push({ ...item, kind: 'video', subtitle: 'Edited video file' });
    } else if (isFloorplan(file, allServices.find(service => service.id === fileLineId(file)))) {
      if (isPdf(file)) {
        model.floorplanPdfs.push({ ...item, kind: 'floorplan', subtitle: 'Floor plan PDF' });
        array(file.preview_images ?? file.previewImages).forEach((preview, index) => {
          if (!text(preview)) return;
          model.floorplanJpgs.push({ ...item, id: `${item.id}-page-${index + 1}`, kind: 'floorplan', format: 'jpg', page: index + 1,
            label: `${fileName(file).replace(/\.pdf$/i, '')} — Page ${index + 1}.jpg`, subtitle: 'Floor plan JPG' });
        });
      } else if (isImage(file)) model.floorplanJpgs.push({ ...item, kind: 'floorplan', subtitle: 'Floor plan image' });
    }
  }

  const links = { ...record(source.tour_links), ...record(shoot.tourLinks) };
  const linkValues = Object.fromEntries(Object.entries(links).map(([key, value]) => [key, safeUrl(value, baseUrl)]));
  linkValues.genericMls ||= firstUrl(baseUrl, links.generic_mls);
  linkValues.matterport_branded ||= firstUrl(baseUrl, links.matterport);
  linkValues.iguide_branded ||= firstUrl(baseUrl, links.iGuide, links.iguide, source.iguideTourUrl, source.iguide_tour_url);
  const iguideMlsSource = text(links.iguide_mls_source);
  if (iguideMlsSource && !['unbranded_url', 'manual', 'manual_url'].includes(iguideMlsSource)) linkValues.iguide_mls = '';
  const iguideData = { ...record(source.iguide_data), ...record(source.iguideData) };
  const offlinePackage = record(source.iguideManualOfflinePackage ?? source.iguide_manual_offline_package ?? iguideData.manual_offline_package);
  // Only the server can attest that an uploaded package is publishable to an
  // audience. Status=ready alone never implies MLS approval or public access.
  const offlineAudiences = text(offlinePackage.status) === 'ready' ? array(offlinePackage.published_audiences) : [];
  const addHosted = (target: ShootDownloadItem[], key: string, label: string, kind: ShootDownloadItem['kind'], publishedOffline = false) => {
    if (!linkValues[key] && !publishedOffline) return;
    target.push({ id: `tour-${key}`, label, subtitle: kind === 'video' ? 'Hosted video page' : '3D walkthrough', kind, action: 'link',
      href: buildTourUrl(baseUrl, shoot.id, key, publishedOffline ? { ...linkValues, [key]: baseUrl } : linkValues, unitId ?? undefined) });
  };
  if (canAccessTours && videoOrdered) {
    addHosted(model.videoLinks, 'video_branded', 'Branded video', 'video');
    addHosted(model.videoLinks, 'video_mls', 'Unbranded video (MLS)', 'video');
    addHosted(model.videoLinks, 'video_generic', 'Generic video', 'video');
  }
  if (canAccessTours) {
    for (const [provider, branded, mls, label] of [
      ['matterport', 'matterport_branded', 'matterport_mls', 'Matterport'],
      ['iguide|i[ -]?guide', 'iguide_branded', 'iguide_mls', 'iGUIDE'],
    ]) {
      if (!canUseProvider(provider)) continue;
      const offlineBranded = label === 'iGUIDE' && offlineAudiences.includes('branded');
      const offlineMls = label === 'iGUIDE' && offlineAudiences.includes('mls');
      addHosted(model.threeDLinks, branded, `${label} — Branded`, 'file', offlineBranded);
      // The public endpoint rejects identical branded/unbranded destinations.
      if (offlineMls || linkValues[mls] !== linkValues[branded]) addHosted(model.threeDLinks, mls, `${label} — Unbranded`, 'file', offlineMls);
    }
    if (canUseProvider('zillow')) addHosted(model.threeDLinks, 'zillow_3d', 'Zillow 3D', 'file');
  }

  const knownProviderUrls = new Set(files.flatMap(file => [record(file).provider_source_url, file.url, file.original_url]
    .map(value => safeUrl(value, baseUrl)).filter(Boolean)));
  const addProviderAsset = (value: unknown, provider: string, index: number) => {
    // Provider URLs bypass our ingest/scan/download gates. Clients receive
    // their guarded ShootFile copies; provider originals remain staff-only.
    if (isClient) return;
    const data = typeof value === 'string' ? { url: value } : record(value);
    if (homeReport(data)) return;
    const href = firstUrl(baseUrl, data.url, data.path, data.href);
    if (!href || knownProviderUrls.has(href)) return;
    const type = `${text(data.type)} ${text(data.filename)} ${href}`.toLowerCase();
    const pdf = /\bpdf\b/.test(type);
    const jpg = /\b(jpg|jpeg|png|webp)\b/.test(type);
    if (!pdf && !jpg) return;
    const item: ShootDownloadItem = { id: `${provider}-floorplan-${index}-${href}`, label: text(data.label) || text(data.filename)
      || `${provider === 'iguide' ? 'iGUIDE' : 'CubiCasa'} floor plan ${index + 1}`, subtitle: pdf ? 'Floor plan PDF' : 'Floor plan JPG', href, kind: 'floorplan', action: 'download' };
    (pdf ? model.floorplanPdfs : model.floorplanJpgs).push(item);
  };
  const addProviderData = (data: RecordData, prefix: 'iguide' | 'cubicasa', lineId?: string) => {
    const associatedId = String(data[`${prefix}_service_line_id`] ?? lineId ?? '');
    if (!canAccessTours || !canUseProvider(prefix) || (associatedId && !linkServiceIds.has(associatedId))) return;
    if (!wholeAccess && !associatedId) return;
    const camel = prefix === 'iguide' ? 'iguideFloorplans' : 'cubicasaFloorplans';
    const assets = [...array(data[camel]), ...array(data[`${prefix}_floorplans`])];
    if (prefix === 'iguide') {
      const raw = { ...record(data.iguide_data), ...record(data.iguideData) };
      for (const units of ['metric', 'imperial']) {
        assets.push({ url: raw[`pdf_${units}_url`], type: 'pdf', label: `Floor plan (${units})` });
        assets.push(...array(raw[`jpg_${units}`]).map(value => ({ ...record(value), type: 'jpg' })));
      }
    }
    assets.forEach((asset, index) => addProviderAsset(asset, prefix, index));
    if (prefix === 'cubicasa') {
      const raw = { ...record(data.cubicasa_data), ...record(data.cubicasaData) };
      for (const [key, label] of [['cubicasa_branded', 'CubiCasa — Branded'], ['cubicasa_mls', 'CubiCasa — Unbranded']]) {
        const href = firstUrl(baseUrl, links[key], key === 'cubicasa_branded' ? record(raw.tour).link : record(raw.tour).mls_compliance_link);
        if (href && !['pdf', 'jpg', 'jpeg', 'png'].includes(extension(href))) model.threeDLinks.push({ id: key, label, href, kind: 'file', action: 'link' });
      }
    }
  };
  // projectUnitTour flattens the selected unit's provider_data onto the shoot;
  // its lines map still needs per-booked-line eligibility before exposing assets.
  for (const prefix of ['iguide', 'cubicasa'] as const) {
    addProviderData(source, prefix);
    for (const [lineId, data] of Object.entries(record(source.lines))) {
      if (linkServiceIds.has(lineId)) addProviderData(record(data), prefix, lineId);
    }
  }
  model.editedVideos = dedupe(model.editedVideos);
  model.floorplanPdfs = dedupe(model.floorplanPdfs);
  model.floorplanJpgs = dedupe(model.floorplanJpgs);
  model.threeDLinks = dedupe(model.threeDLinks);
  const hasContent = photos.length + model.editedVideos.length + model.videoLinks.length + model.threeDLinks.length
    + model.floorplanPdfs.length + model.floorplanJpgs.length > 0;
  if (canAccessTours && (hasContent || ['branded', 'mls', 'genericMls'].some(key => linkValues[key]))) {
    for (const [key, label] of [['branded', 'Branded tour'], ['mls', 'Unbranded tour (MLS)'], ['genericMls', 'Generic tour']]) {
      model.tourLinks.push({ id: `tour-${key}`, label, kind: 'file', action: 'link', href: buildTourUrl(baseUrl, shoot.id, key, linkValues, unitId ?? undefined) });
    }
  }
  model.totalItems = (model.wholeShootPhotoCount > 0 ? 1 : 0) + model.services.length
    + model.editedVideos.length + model.videoLinks.length + model.threeDLinks.length + model.floorplanPdfs.length + model.floorplanJpgs.length + model.tourLinks.length;
  return model;
}
