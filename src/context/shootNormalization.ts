import { ShootData, ShootEditorAssignment, ShootServiceObject } from '@/types/shoots';
import { shootsData as mockShootsData } from '@/data/shootsData';
import { normalizeShootPaymentSummary } from '@/utils/shootPaymentSummary';
import {
  getShootInvoiceAdjustmentTotal,
  isInvoiceAdjustmentServiceItem,
} from '@/utils/shootServiceItems';
import type {
  ApiServiceRecord,
  ApiShoot,
  ApiShootPayment,
} from './shootApiTypes';
import { normalizeShootCompReshootFields } from '@/features/complimentary-reshoots/normalizeShootCompReshoot';
import { normalizeShootNotes } from './shootNotesNormalization';

export type { ApiShoot } from './shootApiTypes';

const toNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const toOptionalBoolean = (...values: unknown[]): boolean | undefined =>
  values.find((value): value is boolean => typeof value === 'boolean');

const cloneMedia = (media?: ShootData['media']): ShootData['media'] | undefined => {
  if (!media) return undefined;
  return {
    ...media,
    images: media.images ? media.images.map(image => ({ ...image })) : undefined,
    videos: media.videos ? media.videos.map(video => ({ ...video })) : undefined,
    files: media.files ? media.files.map(file => ({ ...file })) : undefined,
    photos: media.photos ? [...media.photos] : undefined,
    slideshows: media.slideshows ? media.slideshows.map(show => ({ ...show })) : undefined,
  };
};

const FALLBACK_MEDIA_TEMPLATES: ShootData['media'][] = mockShootsData
    .map(shoot => shoot.media)
    .filter((media): media is NonNullable<ShootData['media']> => Boolean(media?.images?.length))
    .slice(0, 10);
const fallbackMediaGroups = FALLBACK_MEDIA_TEMPLATES;

const isCompletedShoot = (shoot: ShootData): boolean => {
  const status = shoot.status?.toLowerCase();
  return Boolean(shoot.completedDate) || status === 'completed' || status === 'delivered' || status === 'finalized';
};

const isUpcomingShoot = (shoot: ShootData): boolean => {
  if (!shoot?.scheduledDate) return false;
  const scheduledTime = Date.parse(shoot.scheduledDate);
  if (Number.isNaN(scheduledTime)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return !isCompletedShoot(shoot) && scheduledTime >= today.getTime();
};

const getDateValue = (shoot: ShootData): number => {
  const primary = Date.parse(shoot.scheduledDate ?? '');
  if (!Number.isNaN(primary)) return primary;
  const secondary = Date.parse(shoot.completedDate ?? '');
  if (!Number.isNaN(secondary)) return secondary;
  return Number.MAX_SAFE_INTEGER;
};

export const applyFallbackMedia = (items: ShootData[]): ShootData[] => {
  if (!fallbackMediaGroups.length) {
    return items;
  }

  const upcomingNeeds = items
    .map((shoot, index) => ({ shoot, index }))
    .filter(({ shoot }) => isUpcomingShoot(shoot) && !(shoot.media?.images?.length))
    .sort((a, b) => getDateValue(a.shoot) - getDateValue(b.shoot))
    .slice(0, fallbackMediaGroups.length);

  const augmented = [...items];
  let mediaIndex = 0;

  upcomingNeeds.forEach(({ index }) => {
    if (mediaIndex >= fallbackMediaGroups.length) return;
    const template = fallbackMediaGroups[mediaIndex];
    augmented[index] = { ...augmented[index], media: cloneMedia(template) };
    mediaIndex += 1;
  });

  if (mediaIndex < fallbackMediaGroups.length) {
    const remainingSlots = fallbackMediaGroups.length - mediaIndex;
    const completedNeeds = items
      .map((shoot, index) => ({ shoot, index }))
      .filter(({ shoot }) => isCompletedShoot(shoot) && !(shoot.media?.images?.length))
      .sort((a, b) => getDateValue(b.shoot) - getDateValue(a.shoot))
      .slice(0, remainingSlots);

    completedNeeds.forEach(({ index }) => {
      if (mediaIndex >= fallbackMediaGroups.length) return;
      const template = fallbackMediaGroups[mediaIndex];
      augmented[index] = { ...augmented[index], media: cloneMedia(template) };
      mediaIndex += 1;
    });
  }

  return augmented;
};

export const getStoredShoots = (): ShootData[] => {
  // Don't use mock data - only use stored shoots from API
  // Mock data is not filtered by account and could leak data
  if (typeof window === 'undefined') return [];
  const storedShoots = localStorage.getItem('shoots');
  if (!storedShoots) return [];
  try {
    const parsed = JSON.parse(storedShoots);
    // Only return if it's an array (from API), not mock data
    if (Array.isArray(parsed) && parsed.length > 0) {
      return applyFallbackMedia(parsed);
    }
  } catch (e) {
    console.error('Failed to parse stored shoots:', e);
  }
  return [];
};

const normalizeServicePerson = (person: unknown) => {
  if (!person || typeof person !== 'object') return null;

  const source = person as Record<string, unknown>;
  const id = source.id != null ? String(source.id) : undefined;
  const name =
    (typeof source.name === 'string' && source.name.trim() ? source.name : undefined) ||
    (typeof source.full_name === 'string' && source.full_name.trim() ? source.full_name : undefined) ||
    (typeof source.display_name === 'string' && source.display_name.trim() ? source.display_name : undefined);

  if (!id && !name) {
    return null;
  }

  return {
    id,
    name: name ?? `User #${id}`,
    avatar:
      (typeof source.avatar === 'string' && source.avatar.trim() ? source.avatar : undefined) ||
      (typeof source.profile_image === 'string' && source.profile_image.trim() ? source.profile_image : undefined) ||
      (typeof source.profile_photo_url === 'string' && source.profile_photo_url.trim()
        ? source.profile_photo_url
        : undefined),
    email: typeof source.email === 'string' && source.email.trim() ? source.email : undefined,
    phone:
      (typeof source.phone === 'string' && source.phone.trim() ? source.phone : undefined) ||
      (typeof source.phonenumber === 'string' && source.phonenumber.trim() ? source.phonenumber : undefined),
  };
};

const normalizeEditorAssignments = (shoot: ApiShoot): ShootEditorAssignment[] | undefined => {
  const rawAssignments = shoot.editor_assignments ?? shoot.editorAssignments;
  if (!Array.isArray(rawAssignments)) return undefined;

  const assignments = rawAssignments
    .filter((assignment): assignment is Record<string, unknown> => Boolean(assignment) && typeof assignment === 'object')
    .map((assignment) => {
      const editor = normalizeServicePerson(assignment.editor);
      const editorId =
        assignment.editor_id != null
          ? String(assignment.editor_id)
          : assignment.editorId != null
            ? String(assignment.editorId)
            : editor?.id ?? null;

      return {
        lane:
          (typeof assignment.lane === 'string' && assignment.lane.trim()) ||
          (typeof assignment.category_key === 'string' && assignment.category_key.trim()) ||
          'photo',
        label: typeof assignment.label === 'string' && assignment.label.trim() ? assignment.label : undefined,
        editorId,
        editor,
        serviceIds: Array.isArray(assignment.service_ids)
          ? assignment.service_ids.map((id) => String(id)).filter(Boolean)
          : Array.isArray(assignment.serviceIds)
            ? assignment.serviceIds.map((id) => String(id)).filter(Boolean)
            : undefined,
        serviceNames: Array.isArray(assignment.service_names)
          ? assignment.service_names.filter((name): name is string => typeof name === 'string' && Boolean(name.trim()))
          : Array.isArray(assignment.serviceNames)
            ? assignment.serviceNames.filter((name): name is string => typeof name === 'string' && Boolean(name.trim()))
            : undefined,
        ready: Boolean(assignment.ready),
        readyAt:
          (typeof assignment.ready_at === 'string' && assignment.ready_at.trim() ? assignment.ready_at : undefined) ||
          (typeof assignment.readyAt === 'string' && assignment.readyAt.trim() ? assignment.readyAt : undefined) ||
          null,
      };
    });

  return assignments.length > 0 ? assignments : undefined;
};

export const transformShootFromApi = (shoot: ApiShoot): ShootData => {
  const client = (shoot.client ?? {}) as NonNullable<ApiShoot['client']>;
  const photographer = (shoot.photographer ?? {}) as NonNullable<ApiShoot['photographer']>;
  const service = (shoot.service ?? {}) as NonNullable<ApiShoot['service']>;
  const rawTaxRate =
    shoot.payment?.taxRate ??
    shoot.tax_rate ??
    shoot.tax_percent ??
    shoot.taxPercent;
  const editorId = (() => {
    const editorObjId = shoot.editor?.id;
    if (editorObjId) return String(editorObjId);
    if (shoot.editor_id) return String(shoot.editor_id);
    if (shoot.editorId) return String(shoot.editorId);
    return undefined;
  })();
  const address = shoot?.address || '';
  const city = shoot?.city || '';
  const state = shoot?.state || '';
  const zip = shoot?.zip || '';
  const payments: ApiShootPayment[] = Array.isArray(shoot?.payments) ? shoot.payments : [];
  const fullAddress = [address, city, state, zip].filter(Boolean).join(', ');
  const notes = normalizeShootNotes(shoot);
  const paymentSummary = normalizeShootPaymentSummary(shoot);
  const rawPayment = shoot.payment as Record<string, unknown> | undefined;
  const explicitInvoiceAdjustmentsTotal = toOptionalNumber(
    shoot.invoice_adjustments_total
      ?? shoot.invoiceAdjustmentsTotal
      ?? rawPayment?.invoice_adjustments_total
      ?? rawPayment?.invoiceAdjustmentsTotal,
  );
  const orderTotal = toNumber(
    shoot.order_total
      ?? shoot.orderTotal
      ?? rawPayment?.order_total
      ?? rawPayment?.orderTotal
      ?? paymentSummary.totalQuote,
  );
  const completedDate =
    shoot.completed_at ||
    shoot.editing_completed_at ||
    shoot.admin_verified_at ||
    shoot.completed_date;
  const scheduledAtValue =
    shoot.scheduled_at ||
    shoot.scheduledAt ||
    null;
  const normalizedScheduledDate = (() => {
    if (shoot.scheduled_date) {
      return shoot.scheduled_date;
    }
    if (shoot.scheduledDate) {
      return String(shoot.scheduledDate);
    }
    if (scheduledAtValue) {
      try {
        return new Date(String(scheduledAtValue)).toISOString().slice(0, 10);
      } catch {
        return '';
      }
    }
    return '';
  })();
  const normalizedTime = (() => {
    if (shoot.time) {
      return shoot.time;
    }
    if (scheduledAtValue) {
      try {
        return new Date(String(scheduledAtValue)).toISOString().slice(11, 16);
      } catch {
        return '';
      }
    }
    return '';
  })();
  const isPrivateListing =
    typeof shoot.is_private_listing === 'boolean'
      ? Boolean(shoot.is_private_listing)
      : Boolean(shoot.isPrivateListing);
  const isFeatured =
    typeof shoot.is_featured === 'boolean'
      ? Boolean(shoot.is_featured)
      : Boolean(shoot.isFeatured);
  const featuredPending =
    typeof shoot.featured_pending === 'boolean'
      ? Boolean(shoot.featured_pending)
      : Boolean(shoot.featuredPending);
  const featuredStatus =
    shoot.featured_status ??
    shoot.featuredStatus ??
    (isFeatured ? 'featured' : featuredPending ? 'pending' : 'none');
  const normalizedGhostUsers = (() => {
    const source = Array.isArray(shoot.ghost_users)
      ? shoot.ghost_users
      : (Array.isArray(shoot.ghostUsers) ? shoot.ghostUsers : []);

    return source
      .map((ghostUser) => ({
        id: ghostUser?.id != null ? String(ghostUser.id) : '',
        name: ghostUser?.name || 'Client',
        email: ghostUser?.email || undefined,
        company: ghostUser?.company || ghostUser?.company_name || undefined,
      }))
      .filter((ghostUser: { id: string }) => Boolean(ghostUser.id));
  })();
  const normalizedGhostUserIds = (() => {
    const source = Array.isArray(shoot.ghost_user_ids)
      ? shoot.ghost_user_ids
      : (Array.isArray(shoot.ghostUserIds) ? shoot.ghostUserIds : []);

    if (source.length > 0) {
      return source
        .map((id: string | number | null | undefined) => id != null ? String(id) : '')
        .filter(Boolean);
    }

    return normalizedGhostUsers.map((ghostUser) => ghostUser.id);
  })();

  const normalizedServices = (() => {
    if (Array.isArray(shoot.services_list) && shoot.services_list.length > 0) {
      return shoot.services_list.filter(Boolean);
    }
    if (Array.isArray(shoot.services)) {
      const names = shoot.services
        .map((serviceItem) => {
          if (typeof serviceItem === 'string') {
            return serviceItem;
          }
          if (serviceItem && typeof serviceItem === 'object') {
            return (
              serviceItem.name ||
              serviceItem.label ||
              serviceItem.service_name ||
              ''
            );
          }
          return '';
        })
        .filter(Boolean) as string[];
      if (names.length > 0) {
        return names;
      }
    }
    if (service.name) {
      return [service.name];
    }
    return [] as string[];
  })();

  const serviceObjects = (() => {
    if (Array.isArray(shoot.services)) {
      const objs: ShootServiceObject[] = shoot.services
        .filter((s): s is ApiServiceRecord => (
          s !== null
          && typeof s === 'object'
          && 'id' in s
          && !isInvoiceAdjustmentServiceItem(s)
        ))
        .map((s) => ({
          id: String(s.id),
          service_id: String(s.id),
          serviceId: String(s.id),
          shoot_service_id: (s.pivot?.id ?? s.shoot_service_id ?? s.shootServiceId) != null
            ? String(s.pivot?.id ?? s.shoot_service_id ?? s.shootServiceId)
            : null,
          shootServiceId: (s.shootServiceId ?? s.shoot_service_id ?? s.pivot?.id) != null
            ? String(s.shootServiceId ?? s.shoot_service_id ?? s.pivot?.id)
            : null,
          name: String(s.name || ''),
          price: Number(s.pivot?.price ?? s.price ?? 0),
          quantity: Number(s.pivot?.quantity ?? s.quantity ?? 1),
          // Only a positive count is a count; 0 and null both mean unspecified. This
          // shape enriches upload targets, so a fabricated count here would reach the
          // Expected figure.
          photo_count: (() => {
            const raw = s.pivot?.photo_count ?? s.photo_count ?? s.photoCount;
            if (raw === null || raw === undefined) return null;
            const parsed = Number(raw);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
          })(),
          // Capability travels with this shape too, since upload targets can be
          // enriched from whichever side carries the field.
          upload_intake_type: (() => {
            const candidate = String(s.upload_intake_type ?? s.uploadIntakeType ?? '').trim().toLowerCase();
            return ['photo', 'video', 'photo_video', 'none'].includes(candidate) ? candidate : 'none';
          })(),
          pricing_type: s.pricing_type || 'fixed',
          sqft_ranges: (s.sqft_ranges || s.sqftRanges || []).map((range) => ({
            id: range.id != null ? Number(range.id) : undefined,
            sqft_from: Number(range.sqft_from ?? 0),
            sqft_to: Number(range.sqft_to ?? 0),
            duration: range.duration != null ? Number(range.duration) : null,
            price: Number(range.price ?? 0),
            photographer_pay: range.photographer_pay != null ? Number(range.photographer_pay) : null,
            photo_count: range.photo_count != null ? Number(range.photo_count) : null,
          })),
          category: s.category || s.category_name ? {
            id: String(s.category?.id || ''),
            name: String(s.category?.name || s.category_name || ''),
          } : null,
          photographer_pay: (s.pivot?.photographer_pay ?? s.photographer_pay) != null
            ? Number(s.pivot?.photographer_pay ?? s.photographer_pay)
            : null,
          scheduled_at: s.pivot?.scheduled_at ?? s.scheduled_at ?? s.scheduledAt ?? null,
          scheduledAt: s.scheduledAt ?? s.scheduled_at ?? s.pivot?.scheduled_at ?? null,
          workflow_status: s.pivot?.workflow_status ?? s.workflow_status ?? s.workflowStatus ?? null,
          workflowStatus: s.workflowStatus ?? s.workflow_status ?? s.pivot?.workflow_status ?? null,
          delivery_status: s.pivot?.delivery_status ?? s.delivery_status ?? s.deliveryStatus ?? null,
          deliveryStatus: s.deliveryStatus ?? s.delivery_status ?? s.pivot?.delivery_status ?? null,
          ready_at: s.pivot?.ready_at ?? s.ready_at ?? s.readyAt ?? null,
          readyAt: s.readyAt ?? s.ready_at ?? s.pivot?.ready_at ?? null,
          delivered_at: s.pivot?.delivered_at ?? s.delivered_at ?? s.deliveredAt ?? null,
          deliveredAt: s.deliveredAt ?? s.delivered_at ?? s.pivot?.delivered_at ?? null,
          is_deliverable: Boolean(s.pivot?.is_deliverable ?? s.is_deliverable ?? s.isDeliverable ?? true),
          isDeliverable: Boolean(s.isDeliverable ?? s.is_deliverable ?? s.pivot?.is_deliverable ?? true),
          paid_amount: toNumber(s.pivot?.paid_amount ?? s.paid_amount ?? s.paidAmount),
          paidAmount: toNumber(s.paidAmount ?? s.paid_amount ?? s.pivot?.paid_amount),
          balance_due: toNumber(s.pivot?.balance_due ?? s.balance_due ?? s.balanceDue),
          balanceDue: toNumber(s.balanceDue ?? s.balance_due ?? s.pivot?.balance_due),
          payment_status: s.pivot?.payment_status ?? s.payment_status ?? s.paymentStatus ?? null,
          paymentStatus: s.paymentStatus ?? s.payment_status ?? s.pivot?.payment_status ?? null,
          force_unlock_delivery: Boolean(s.pivot?.force_unlock_delivery ?? s.force_unlock_delivery ?? s.forceUnlockDelivery ?? false),
          forceUnlockDelivery: Boolean(s.forceUnlockDelivery ?? s.force_unlock_delivery ?? s.pivot?.force_unlock_delivery ?? false),
          is_unlocked_for_delivery: Boolean(s.pivot?.is_unlocked_for_delivery ?? s.is_unlocked_for_delivery ?? s.isUnlockedForDelivery ?? false),
          isUnlockedForDelivery: Boolean(s.isUnlockedForDelivery ?? s.is_unlocked_for_delivery ?? s.pivot?.is_unlocked_for_delivery ?? false),
          unlock_state: s.pivot?.unlock_state ?? s.unlock_state ?? s.unlockState ?? undefined,
          unlockState: s.unlockState ?? s.unlock_state ?? s.pivot?.unlock_state ?? undefined,
          photographer_id: (s.pivot?.photographer_id ?? s.photographer_id) != null
            ? String(s.pivot?.photographer_id ?? s.photographer_id)
            : null,
          resolved_photographer_id: (s.resolved_photographer_id ?? s.pivot?.photographer_id ?? s.photographer_id) != null
            ? String(s.resolved_photographer_id ?? s.pivot?.photographer_id ?? s.photographer_id)
            : null,
          photographer: (() => {
            const servicePhotographer = s.resolved_photographer ?? s.photographer;
            const normalizedPhotographer = normalizeServicePerson(servicePhotographer);
            if (normalizedPhotographer) {
              return normalizedPhotographer;
            }

            const fallbackPhotographerId =
              s.resolved_photographer_id ??
              s.pivot?.photographer_id ??
              s.photographer_id;

            if (fallbackPhotographerId != null) {
              const fallbackId = String(fallbackPhotographerId);
              const shootPhotographerId = photographer.id ? String(photographer.id) : undefined;

              if (shootPhotographerId && shootPhotographerId === fallbackId) {
                return {
                  id: shootPhotographerId,
                  name: photographer.name || `Photographer #${fallbackId}`,
                  avatar: photographer.avatar || undefined,
                  email:
                    photographer.email ||
                    shoot.photographer_email ||
                    shoot.photographerEmail ||
                    undefined,
                };
              }

              return {
                id: fallbackId,
                name:
                  s.resolved_photographer_name ||
                  s.photographer_name ||
                  `Photographer #${fallbackId}`,
                avatar: undefined,
                email: undefined,
              };
            }

            return null;
          })(),
          editor_id: (s.pivot?.editor_id ?? s.editor_id) != null
            ? String(s.pivot?.editor_id ?? s.editor_id)
            : null,
          resolved_editor_id: (s.resolved_editor_id ?? s.pivot?.editor_id ?? s.editor_id) != null
            ? String(s.resolved_editor_id ?? s.pivot?.editor_id ?? s.editor_id)
            : null,
          editor: (() => {
            const normalizedEditor = normalizeServicePerson(s.resolved_editor ?? s.editor);
            if (normalizedEditor) {
              return normalizedEditor;
            }

            const fallbackEditorId =
              s.resolved_editor_id ??
              s.pivot?.editor_id ??
              s.editor_id;

            if (fallbackEditorId != null) {
              const fallbackId = String(fallbackEditorId);
              const shootEditorId = editorId ? String(editorId) : undefined;

              if (shootEditorId && shootEditorId === fallbackId && shoot.editor && typeof shoot.editor === 'object') {
                return {
                  id: shootEditorId,
                  name: shoot.editor?.name || `Editor #${fallbackId}`,
                  avatar: shoot.editor?.avatar || undefined,
                  email: shoot.editor?.email || undefined,
                };
              }

              return {
                id: fallbackId,
                name:
                  s.resolved_editor_name ||
                  s.editor_name ||
                  `Editor #${fallbackId}`,
                avatar: undefined,
                email: undefined,
              };
            }

            return null;
          })(),
          editing_completed_at: s.editing_completed_at != null
            ? String(s.editing_completed_at)
            : null,
          lane: s.lane != null ? String(s.lane) : null,
          category_key: (s.category_key ?? s.categoryKey ?? s.lane) != null
            ? String(s.category_key ?? s.categoryKey ?? s.lane)
            : null,
        }));
      if (objs.length > 0) return objs;
    }
    return undefined;
  })();
  // Display-only names for every booked service. Kept separate from
  // `serviceItems` because that payload is narrowed by workflow eligibility and
  // therefore cannot be relied on to name a service the viewer may see but not
  // edit. Passed through verbatim: there is nothing to normalize but the ids.
  const servicePresentation = (() => {
    const rawPresentation = Array.isArray(shoot.servicePresentation)
      ? shoot.servicePresentation
      : Array.isArray(shoot.service_presentation)
        ? shoot.service_presentation
        : [];

    return rawPresentation
      .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
      .map((item) => {
        const pivotId = item.shoot_service_id ?? item.shootServiceId ?? null;
        const serviceId = item.service_id ?? item.serviceId ?? null;
        const name = item.name ?? item.serviceName ?? null;

        return {
          shoot_service_id: pivotId as string | number | null,
          shootServiceId: pivotId as string | number | null,
          service_id: serviceId as string | number | null,
          serviceId: serviceId as string | number | null,
          name: name === null ? null : String(name),
          serviceName: name === null ? null : String(name),
        };
      });
  })();
  const serviceItems = (() => {
    const rawItems = Array.isArray(shoot.serviceItems)
      ? shoot.serviceItems
      : Array.isArray(shoot.service_items)
        ? shoot.service_items
        : [];

    if (rawItems.length === 0) {
      return serviceObjects;
    }

    const items: ShootServiceObject[] = rawItems
      .filter((item): item is ApiServiceRecord => item !== null && typeof item === 'object')
      .map((item) => {
        const service = item.service && typeof item.service === 'object' ? item.service : {};
        const isInvoiceAdjustment = isInvoiceAdjustmentServiceItem(item);
        const serviceId = isInvoiceAdjustment
          ? null
          : item.service_id ?? item.serviceId ?? service.id ?? item.id;
        const shootServiceId = isInvoiceAdjustment
          ? null
          : item.shoot_service_id ?? item.shootServiceId ?? item.id;
        const invoiceId = item.invoice_id ?? item.invoiceId;
        const invoiceItemId = item.invoice_item_id ?? item.invoiceItemId;
        const scheduledAt = item.scheduledAt ?? item.scheduled_at ?? null;
        const workflowStatus = item.workflowStatus ?? item.workflow_status ?? null;
        const deliveryStatus = item.deliveryStatus ?? item.delivery_status ?? null;
        const readyAt = item.readyAt ?? item.ready_at ?? null;
        const deliveredAt = item.deliveredAt ?? item.delivered_at ?? null;
        const price = toNumber(item.price ?? item.unit_amount ?? item.unitAmount ?? item.subtotal ?? service.price);
        const quantityValue = Number(item.quantity);
        const quantity = Math.max(1, Number.isFinite(quantityValue) ? quantityValue : 1);
        const stableId = isInvoiceAdjustment
          ? item.id ?? (invoiceItemId != null ? `invoice-adjustment-${String(invoiceItemId)}` : null)
          : serviceId ?? shootServiceId;
        const unitAmount = toNumber(item.unit_amount ?? item.unitAmount ?? item.price);
        const totalAmount = toNumber(item.total_amount ?? item.totalAmount ?? item.subtotal ?? unitAmount * quantity);
        const chargeType = typeof item.charge_type === 'string'
          ? item.charge_type
          : typeof item.chargeType === 'string'
            ? item.chargeType
            : undefined;

        // Per-service bracket state. Normalisation rebuilds each item from an
        // explicit list of fields, so anything not named here is dropped before the
        // upload panel ever sees it, which silently left every service looking like
        // it does not bracket. Booleans arrive as true, 1 or "1" depending on the
        // serializer, so an explicit false has to survive the coercion.
        const rawUsesHdrBrackets = item.uses_hdr_brackets ?? item.usesHdrBrackets
          ?? service.uses_hdr_brackets ?? service.usesHdrBrackets;
        const usesHdrBrackets = rawUsesHdrBrackets === true
          || rawUsesHdrBrackets === 1
          || rawUsesHdrBrackets === '1'
          || (typeof rawUsesHdrBrackets === 'string' && rawUsesHdrBrackets.toLowerCase() === 'true');
        const toBracketMode = (value: unknown): number | null => {
          if (value === null || value === undefined || value === '') return null;
          const parsed = Number(value);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        };
        const bracketModeSnapshot = toBracketMode(item.bracket_mode ?? item.bracketMode);
        const effectiveBracketMode = toBracketMode(item.effective_bracket_mode ?? item.effectiveBracketMode);

        // Upload capability, for the same reason as the bracket fields above: this
        // rebuild drops anything not named here, and losing the capability would make
        // every service look non-selectable. An unrecognised value normalises to
        // `none`, because unknown capability must mean "not selectable".
        const rawIntakeType = item.upload_intake_type ?? item.uploadIntakeType
          ?? service.upload_intake_type ?? service.uploadIntakeType;
        const uploadIntakeType = (() => {
          const candidate = String(rawIntakeType ?? '').trim().toLowerCase();
          return ['photo', 'video', 'photo_video', 'none'].includes(candidate) ? candidate : 'none';
        })();
        const supportsPhotoIntake = uploadIntakeType === 'photo' || uploadIntakeType === 'photo_video';
        const supportsVideoIntake = uploadIntakeType === 'video' || uploadIntakeType === 'photo_video';

        // Only a positive contracted count is a count. Zero and null both mean
        // unspecified, and booking quantity is never substituted.
        const rawPhotoCount = item.photo_count ?? item.photoCount
          ?? service.photo_count ?? service.photoCount;
        const contractedPhotoCount = (() => {
          if (rawPhotoCount === null || rawPhotoCount === undefined) return null;
          const parsed = Number(rawPhotoCount);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        })();

        return {
          id: stableId != null ? String(stableId) : '',
          invoice_id: invoiceId == null ? null : String(invoiceId),
          invoiceId: invoiceId == null ? null : String(invoiceId),
          invoice_item_id: invoiceItemId == null ? null : String(invoiceItemId),
          invoiceItemId: invoiceItemId == null ? null : String(invoiceItemId),
          source: isInvoiceAdjustment ? 'invoice_adjustment' : (typeof item.source === 'string' ? item.source : undefined),
          is_invoice_adjustment: isInvoiceAdjustment,
          isInvoiceAdjustment,
          service_id: serviceId != null ? String(serviceId) : null,
          serviceId: serviceId != null ? String(serviceId) : null,
          shoot_service_id: shootServiceId != null ? String(shootServiceId) : null,
          shootServiceId: shootServiceId != null ? String(shootServiceId) : null,
          name: String(item.name ?? item.service_name ?? item.serviceName ?? service.name ?? ''),
          price,
          unit_amount: unitAmount,
          unitAmount,
          quantity,
          subtotal: item.subtotal != null ? toNumber(item.subtotal) : price * quantity,
          total_amount: totalAmount,
          totalAmount,
          bills_client: isInvoiceAdjustment
            ? Boolean(item.bills_client ?? item.billsClient ?? true)
            : undefined,
          billsClient: isInvoiceAdjustment
            ? Boolean(item.billsClient ?? item.bills_client ?? true)
            : undefined,
          charge_type: chargeType,
          chargeType,
          photo_count: contractedPhotoCount,
          photoCount: contractedPhotoCount,
          upload_intake_type: uploadIntakeType,
          uploadIntakeType,
          supports_photo_intake: supportsPhotoIntake,
          supportsPhotoIntake,
          supports_video_intake: supportsVideoIntake,
          supportsVideoIntake,
          uses_hdr_brackets: usesHdrBrackets,
          usesHdrBrackets,
          bracket_mode: bracketModeSnapshot,
          bracketMode: bracketModeSnapshot,
          effective_bracket_mode: effectiveBracketMode,
          effectiveBracketMode,
          pricing_type: item.pricing_type ?? service.pricing_type ?? 'fixed',
          category: item.category ?? service.category ?? null,
          photographer_pay: item.photographer_pay != null || item.photographerPay != null
            ? Number(item.photographer_pay ?? item.photographerPay)
            : null,
          photographer_id: item.photographer_id != null || item.photographerId != null
            ? String(item.photographer_id ?? item.photographerId)
            : null,
          resolved_photographer_id: item.resolved_photographer_id != null || item.resolvedPhotographerId != null || item.photographer_id != null || item.photographerId != null
            ? String(item.resolved_photographer_id ?? item.resolvedPhotographerId ?? item.photographer_id ?? item.photographerId)
            : null,
          photographer: normalizeServicePerson(item.photographer ?? item.resolved_photographer),
          editor_id: item.editor_id != null || item.editorId != null
            ? String(item.editor_id ?? item.editorId)
            : null,
          resolved_editor_id: item.resolved_editor_id != null || item.resolvedEditorId != null || item.editor_id != null || item.editorId != null
            ? String(item.resolved_editor_id ?? item.resolvedEditorId ?? item.editor_id ?? item.editorId)
            : null,
          editor: normalizeServicePerson(item.editor ?? item.resolved_editor),
          scheduled_at: scheduledAt,
          scheduledAt,
          workflow_status: workflowStatus,
          workflowStatus,
          delivery_status: deliveryStatus,
          deliveryStatus,
          ready_at: readyAt,
          readyAt,
          delivered_at: deliveredAt,
          deliveredAt,
          is_deliverable: Boolean(item.is_deliverable ?? item.isDeliverable ?? true),
          isDeliverable: Boolean(item.isDeliverable ?? item.is_deliverable ?? true),
          paid_amount: toNumber(item.paid_amount ?? item.paidAmount),
          paidAmount: toNumber(item.paidAmount ?? item.paid_amount),
          balance_due: toNumber(item.balance_due ?? item.balanceDue),
          balanceDue: toNumber(item.balanceDue ?? item.balance_due),
          payment_status: item.payment_status ?? item.paymentStatus ?? null,
          paymentStatus: item.paymentStatus ?? item.payment_status ?? null,
          force_unlock_delivery: Boolean(item.force_unlock_delivery ?? item.forceUnlockDelivery ?? false),
          forceUnlockDelivery: Boolean(item.forceUnlockDelivery ?? item.force_unlock_delivery ?? false),
          is_unlocked_for_delivery: Boolean(item.is_unlocked_for_delivery ?? item.isUnlockedForDelivery ?? false),
          isUnlockedForDelivery: Boolean(item.isUnlockedForDelivery ?? item.is_unlocked_for_delivery ?? false),
          unlock_state: item.unlock_state ?? item.unlockState ?? undefined,
          unlockState: item.unlockState ?? item.unlock_state ?? undefined,
          lane: item.lane != null ? String(item.lane) : null,
          category_key: (item.category_key ?? item.categoryKey ?? item.lane) != null
            ? String(item.category_key ?? item.categoryKey ?? item.lane)
            : null,
        };
      })
      .filter((item) => Boolean(item.id || item.shoot_service_id || item.name));

    return items.length > 0 ? items : serviceObjects;
  })();
  const invoiceAdjustmentsTotal = getShootInvoiceAdjustmentTotal({
    serviceItems,
    invoiceAdjustmentsTotal: explicitInvoiceAdjustmentsTotal,
  });
  const editorAssignments = normalizeEditorAssignments(shoot);
  const resolvedEditor =
    (shoot.editor || editorId)
      ? {
          id: editorId,
          name: shoot.editor?.name ?? '',
          avatar: shoot.editor?.avatar ?? undefined,
          email: shoot.editor?.email ?? undefined,
        }
      : editorAssignments?.[0]?.editor;
  const resolvedRep =
    normalizeServicePerson(client.rep) ||
    normalizeServicePerson(shoot.rep) ||
    normalizeServicePerson(shoot.salesRep) ||
    normalizeServicePerson(shoot.sales_rep);
  const compReshootFields = normalizeShootCompReshootFields(shoot);

  return {
    id: String(shoot.id),
    scheduledDate: normalizedScheduledDate,
    time: normalizedTime,
    client: {
      id: client.id ? String(client.id) : undefined,
      name: client.name || 'Client',
      email: client.email || '',
      emailVerified: Boolean(client.emailVerified ?? client.email_verified),
      email_verified: Boolean(client.email_verified ?? client.emailVerified),
      company: client.company_name || undefined,
      phone: client.phone || client.phonenumber || undefined,
      totalShoots: client.total_shoots ?? shoot.client_shoots_count ?? 0,
      rep: resolvedRep,
    },
    rep: resolvedRep,
    location: {
      address,
      address2: shoot.address2 || undefined,
      city,
      state,
      zip,
      fullAddress,
    },
    photographer: {
      id: photographer.id ? String(photographer.id) : undefined,
      name: photographer.name || 'Unassigned',
      avatar: photographer.avatar || undefined,
      email:
        photographer.email ||
        shoot.photographer_email ||
        shoot.photographerEmail ||
        undefined,
      phone:
        photographer.phone ||
        photographer.phonenumber ||
        shoot.photographer_phone ||
        shoot.photographerPhone ||
        undefined,
    },
    editor: resolvedEditor,
    editorId: resolvedEditor?.id ? String(resolvedEditor.id) : editorId,
    services: normalizedServices,
    serviceObjects,
    serviceItems,
    service_items: serviceItems,
    servicePresentation,
    service_presentation: servicePresentation,
    editorAssignments,
    payment: {
      serviceSubtotal: paymentSummary.serviceSubtotal,
      baseQuote: paymentSummary.baseQuote,
      discountType: paymentSummary.discountType,
      discountValue: paymentSummary.discountValue,
      discountAmount: paymentSummary.discountAmount,
      discountedSubtotal: paymentSummary.discountedSubtotal,
      taxRate: paymentSummary.taxRate || toNumber(rawTaxRate),
      taxPercent: paymentSummary.taxPercent,
      taxAmount: paymentSummary.taxAmount,
      invoiceAdjustmentsTotal,
      orderTotal,
      totalQuote: paymentSummary.totalQuote,
      totalPaid: paymentSummary.totalPaid,
      overpaymentAmount: paymentSummary.overpaymentAmount,
      overpayment_amount: paymentSummary.overpaymentAmount,
      paymentStatus: paymentSummary.paymentStatus,
      lastPaymentDate: paymentSummary.lastPaymentDate ?? payments[0]?.paid_at ?? undefined,
      lastPaymentType: paymentSummary.lastPaymentType,
    },
    status: shoot.status || 'booked',
    shootType: (shoot.shoot_type || shoot.shootType || undefined) as
      | string
      | undefined,
    reshootParent: compReshootFields.reshootParent,
    reshoot_parent: compReshootFields.reshootParent,
    reshootRoot: compReshootFields.reshootRoot,
    reshoot_root: compReshootFields.reshootRoot,
    reshootChildren: compReshootFields.reshootChildren,
    reshoot_children: compReshootFields.reshootChildren,
    reshootReasonCode: compReshootFields.reshootReasonCode,
    reshoot_reason_code: compReshootFields.reshootReasonCode,
    reshootReasonNote: compReshootFields.reshootReasonNote,
    reshoot_reason_note: compReshootFields.reshootReasonNote,
    reshootServiceLinks: compReshootFields.reshootServiceLinks,
    reshoot_service_links: compReshootFields.reshootServiceLinks,
    compensationSummary: compReshootFields.compensationSummary,
    compensation_summary: compReshootFields.compensationSummary,
    workflowStatus: shoot.workflow_status || shoot.workflowStatus || undefined,
    notes,
    adminIssueNotes: shoot.admin_issue_notes ?? undefined,
    isFlagged: Boolean(shoot.is_flagged),
    issuesResolvedAt: shoot.issues_resolved_at ?? undefined,
    issuesResolvedBy: shoot.issues_resolved_by ? String(shoot.issues_resolved_by) : undefined,
    submittedForReviewAt: shoot.submitted_for_review_at ?? undefined,
    createdBy: shoot.created_by || 'System',
    completedDate: completedDate ?? undefined,
    expectedFinalCount: toNumber(shoot.expected_final_count),
    expectedRawCount: toNumber(shoot.expected_raw_count),
    bracketMode: (() => {
      const raw = shoot.bracket_mode ?? shoot.bracketMode;
      const n = Number(raw);
      return n === 3 || n === 5 ? (n as 3 | 5) : null;
    })(),
    rawPhotoCount: toNumber(shoot.raw_photo_count ?? shoot.rawPhotoCount),
    editedPhotoCount: toNumber(shoot.edited_photo_count ?? shoot.editedPhotoCount),
    extraPhotoCount: toNumber(shoot.extra_photo_count ?? shoot.extraPhotoCount),
    canSubmitRaw: Boolean(shoot.canSubmitRaw ?? shoot.can_submit_raw),
    canSubmitEdits: Boolean(shoot.canSubmitEdits ?? shoot.can_submit_edits),
    canViewInvoice: toOptionalBoolean(shoot.canViewInvoice, shoot.can_view_invoice),
    canFinalizeNoMedia: toOptionalBoolean(shoot.canFinalizeNoMedia, shoot.can_finalize_no_media),
    canRemoveAllServices: toOptionalBoolean(shoot.canRemoveAllServices, shoot.can_remove_all_services),
    can_submit_raw: Boolean(shoot.can_submit_raw ?? shoot.canSubmitRaw),
    can_submit_edits: Boolean(shoot.can_submit_edits ?? shoot.canSubmitEdits),
    can_view_invoice: toOptionalBoolean(shoot.can_view_invoice, shoot.canViewInvoice),
    can_finalize_no_media: toOptionalBoolean(shoot.can_finalize_no_media, shoot.canFinalizeNoMedia),
    can_remove_all_services: toOptionalBoolean(shoot.can_remove_all_services, shoot.canRemoveAllServices),
    overpaymentAmount: paymentSummary.overpaymentAmount,
    overpayment_amount: paymentSummary.overpaymentAmount,
    heroImage: shoot.hero_image || shoot.heroImage || undefined,
    media: shoot.media || undefined,
    tourLinks: shoot.tour_links || undefined,
    iguideTourUrl: shoot.iguide_tour_url || undefined,
    iguideFloorplans: shoot.iguide_floorplans || undefined,
    iguidePropertyId: shoot.iguide_property_id || undefined,
    iguideWorkOrderId: shoot.iguide_work_order_id || undefined,
    iguideLastSyncedAt: shoot.iguide_last_synced_at || undefined,
    iguideData: shoot.iguide_data || undefined,
    iguideManualOfflinePackage: shoot.iguide_manual_offline_package || undefined,
    // CubiCasa — mirror the iGUIDE mapping so the Tours tab can surface
    // tour/floorplan links (previously these snake_case fields never reached
    // the view-model, so CubiCasa floor plans never rendered).
    cubicasaTourUrl: shoot.cubicasa_tour_url || undefined,
    cubicasaFloorplans: shoot.cubicasa_floorplans || undefined,
    cubicasaData: shoot.cubicasa_data || undefined,
    cubicasaStatus: shoot.cubicasa_status || undefined,
    cubicasaProductType: shoot.cubicasa_product_type || undefined,
    cubicasaOrderId: shoot.cubicasa_order_id || undefined,
    cubicasaExternalId: shoot.cubicasa_external_id || undefined,
    cubicasaLastSyncedAt: shoot.cubicasa_last_synced_at || undefined,
    files: shoot.files || undefined,
    tourPurchased: shoot.tour_purchased ? Boolean(shoot.tour_purchased) : undefined,
    isPrivateListing,
    isFeatured,
    is_featured: isFeatured,
    featuredPending,
    featured_pending: featuredPending,
    featuredStatus,
    featured_status: featuredStatus,
    featuredRequestedAt: shoot.featuredRequestedAt ?? shoot.featured_requested_at ?? null,
    featured_requested_at: shoot.featured_requested_at ?? shoot.featuredRequestedAt ?? null,
    featuredRequestedBy: shoot.featuredRequestedBy ?? shoot.featured_requested_by ?? null,
    featured_requested_by: shoot.featured_requested_by ?? shoot.featuredRequestedBy ?? null,
    featuredApprovedAt: shoot.featuredApprovedAt ?? shoot.featured_approved_at ?? null,
    featured_approved_at: shoot.featured_approved_at ?? shoot.featuredApprovedAt ?? null,
    featuredApprovedBy: shoot.featuredApprovedBy ?? shoot.featured_approved_by ?? null,
    featured_approved_by: shoot.featured_approved_by ?? shoot.featuredApprovedBy ?? null,
    photographerPay: toNumber(shoot.total_photographer_pay),
    totalPhotographerPay: toNumber(shoot.total_photographer_pay),
    propertyDetails: shoot.property_details || undefined,
    cancellationRequestedAt: shoot.cancellationRequestedAt || shoot.cancellation_requested_at || undefined,
    cancellationReason: shoot.cancellationReason || shoot.cancellation_reason || undefined,
    holdRequestedAt: shoot.holdRequestedAt || shoot.hold_requested_at || undefined,
    holdRequestedBy: shoot.holdRequestedBy || shoot.hold_requested_by || undefined,
    holdReason: shoot.holdReason || shoot.hold_reason || undefined,
    mmmStatus: shoot.mmm_status || undefined,
    mmmOrderNumber: shoot.mmm_order_number || undefined,
    mmmBuyerCookie: shoot.mmm_buyer_cookie || undefined,
    mmmRedirectUrl: shoot.mmm_redirect_url || undefined,
    mmmLastPunchoutAt: shoot.mmm_last_punchout_at || undefined,
    mmmLastOrderAt: shoot.mmm_last_order_at || undefined,
    mmmLastError: shoot.mmm_last_error || undefined,
    ghostUsers: normalizedGhostUsers,
    ghostUserIds: normalizedGhostUserIds,
    isGhostVisibleForUser: typeof shoot.is_ghost_visible_for_user === 'boolean'
      ? Boolean(shoot.is_ghost_visible_for_user)
      : Boolean(shoot.isGhostVisibleForUser),
    alternate_scheduled_date:
      shoot.alternate_scheduled_date ?? shoot.alternateScheduledDate ?? null,
    alternate_time:
      shoot.alternate_time ?? shoot.alternateTime ?? null,
    alternate_scheduled_at:
      shoot.alternate_scheduled_at ?? shoot.alternateScheduledAt ?? null,
    requested_photographers:
      shoot.requested_photographers ?? shoot.requestedPhotographers ?? null,
    external_booking_payload:
      shoot.external_booking_payload ?? shoot.externalBookingPayload ?? null,
    external_booking_warnings:
      shoot.external_booking_warnings ?? shoot.externalBookingWarnings ?? null,
    external_booking_mapping_status:
      shoot.external_booking_mapping_status ?? shoot.externalBookingMappingStatus ?? null,
  };
};
