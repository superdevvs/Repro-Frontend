import { useEffect, useState } from 'react';
import type { ShootData } from '@/types/shoots';
import { isInvoiceAdjustmentServiceItem } from '@/utils/shootServiceItems';

type Channel = 'email' | 'sms';
type Contact = { id?: unknown; name?: string; email?: string; phone?: unknown; phonenumber?: unknown };
type NotificationSummary = { sent?: number; queued?: number; failed?: number; skipped?: number; requested?: boolean };

const contact = (value: unknown): Contact => value && typeof value === 'object' ? value as Contact : {};
const hasValue = (value: unknown) => typeof value === 'string' && Boolean(value.trim());
const hasContact = (person: Contact, channels: Channel[]) => channels.some((channel) =>
  channel === 'email' ? hasValue(person.email) : hasValue(person.phone) || hasValue(person.phonenumber));

/** Match workflow notification routing: booked-service assignees, with primary as fallback only. */
export function getAssignedNotificationPhotographers(shoot: Partial<ShootData> | null): Contact[] {
  const primary = contact(shoot?.photographer);
  const bookedServices = shoot?.serviceObjects?.length
    ? shoot.serviceObjects
    : (shoot?.serviceItems ?? shoot?.service_items ?? []).filter((item) =>
      !isInvoiceAdjustmentServiceItem(item) && (item.shoot_service_id != null || item.service_id != null));
  const photographers = bookedServices.length ? bookedServices.map((item): Contact => {
    const row = item as unknown as Record<string, unknown>;
    const pivot = row.pivot && typeof row.pivot === 'object' ? row.pivot as Record<string, unknown> : {};
    const resolved = contact(row.resolved_photographer ?? row.photographer);
    const assignment = 'photographer_id' in row ? row.photographer_id
      : 'photographer_id' in pivot ? pivot.photographer_id
        : row.resolved_photographer_id ?? resolved.id;
    if (assignment == null || assignment === '') return primary;
    const assignedId = String(assignment);
    const assigned = [resolved, contact(row.photographer)].find((person) => String(person.id) === assignedId);
    // Enrich the primary fallback only when it remains assigned to this service.
    return String(primary.id) === assignedId ? {
      ...primary, ...assigned,
      email: assigned?.email || primary.email,
      phone: assigned?.phone || assigned?.phonenumber || primary.phone || primary.phonenumber,
    } : assigned ?? {};
  }) : [primary];
  return photographers.filter((person, index) => person.id != null &&
    photographers.findIndex((other) => String(other.id) === String(person.id)) === index);
}

export function getHoldNotificationAvailability(shoot: Partial<ShootData> | null, channels: Channel[]) {
  const client = contact(shoot?.client);
  const photographers = getAssignedNotificationPhotographers(shoot);
  return {
    clientAvailable: hasContact(client, channels),
    photographerAvailable: photographers.some((person) =>
      (client.id == null || String(person.id) !== String(client.id)) && hasContact(person, channels)),
  };
}

export function describeHoldNotifications(result: unknown): string {
  const summary = (result as { notifications?: NotificationSummary } | null)?.notifications;
  if (!summary) return 'Notification delivery was not confirmed.';
  if (!summary.requested) return 'No email or SMS notifications were requested.';
  const parts = [
    summary.sent ? `${summary.sent} sent` : '',
    summary.queued ? `${summary.queued} queued` : '',
    summary.failed ? `${summary.failed} failed` : '',
    summary.skipped ? `${summary.skipped} skipped` : '',
  ].filter(Boolean);
  return parts.length ? `Notifications: ${parts.join(', ')}.${summary.failed || summary.skipped ? ' Review notification history for details.' : ''}` : 'No email or SMS notifications were sent.';
}

export function useHoldNotifications(shoot: Partial<ShootData> | null, open: boolean) {
  const [clientChoice, setNotifyClient] = useState(true);
  const [photographerChoice, setNotifyPhotographer] = useState(true);
  const [channels, setChannels] = useState<Channel[]>(['email']);
  useEffect(() => {
    if (!open) {
      setNotifyClient(true);
      setNotifyPhotographer(true);
      setChannels(['email']);
    }
  }, [open, shoot?.id]);
  const availability = getHoldNotificationAvailability(shoot, channels);
  const notifyClient = clientChoice && availability.clientAvailable;
  const notifyPhotographer = photographerChoice && availability.photographerAvailable;
  const setChannel = (channel: Channel, enabled: boolean) => setChannels((current) => {
    const next = enabled ? Array.from(new Set([...current, channel])) : current.filter((value) => value !== channel);
    return next.length ? next : current;
  });
  return {
    ...availability, notifyClient, notifyPhotographer, channels, setNotifyClient, setNotifyPhotographer, setChannel,
    payload: { notify_client: notifyClient, notify_photographer: notifyPhotographer, notification_channels: channels },
  };
}

export type HoldNotificationOptions = ReturnType<typeof useHoldNotifications>;
