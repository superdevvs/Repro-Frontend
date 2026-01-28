import { getEchoClient, isRealtimeEnabled } from './echoClient';
import { emitRealtimeEvent, logRealtimeDebug } from './realtimeEvents';

export type RealtimeListenerOptions = {
  role?: string | null;
  userId?: string | number | null;
};

type EchoChannel = ReturnType<NonNullable<typeof window.Echo>['private']>;

type EventDefinition = {
  name: string;
  resolveEvent: (payload: any) => ResolvedRealtimeEvent;
};

type ResolvedRealtimeEvent = {
  type: 'shoot.updated' | 'invoice.paid' | null;
  shootId?: string | number | null;
  invoiceId?: string | number | null;
};

const SHOOT_UPDATE_ACTIONS = new Set([
  'shoot_requested',
  'shoot_created',
  'shoot_scheduled',
  'shoot_approved',
  'shoot_started',
  'shoot_completed',
  'shoot_cancelled',
  'shoot_put_on_hold',
  'shoot_editing_started',
  'shoot_submitted_for_review',
  'media_uploaded',
  'raw_downloaded_by_editor',
  'share_link_generated',
  'shoot_resumed_from_hold',
  'shoot_delivered',
]);

const resolveShootActivityEvent = (payload: any): ResolvedRealtimeEvent => {
  const activityType = String(payload?.activityType ?? payload?.action ?? '').toLowerCase();
  const shootId = payload?.shoot?.id ?? payload?.shootId ?? payload?.id ?? null;
  const invoiceId =
    payload?.invoice?.id ??
    payload?.invoiceId ??
    payload?.metadata?.invoice_id ??
    payload?.metadata?.invoiceId ??
    null;

  if (activityType === 'payment_done') {
    return { type: 'invoice.paid', shootId, invoiceId };
  }

  if (SHOOT_UPDATE_ACTIONS.has(activityType)) {
    return { type: 'shoot.updated', shootId, invoiceId };
  }

  return { type: null, shootId, invoiceId };
};

const DEFAULT_EVENTS: EventDefinition[] = [
  {
    name: '.ShootActivity',
    resolveEvent: resolveShootActivityEvent,
  },
];

const getChannelsForRole = (role?: string | null, userId?: string | number | null): string[] => {
  if (!role) return [];

  const normalized = role.toLowerCase();

  if (normalized === 'admin' || normalized === 'superadmin') {
    return ['admin.notifications'];
  }

  if (!userId) return [];

  switch (normalized) {
    case 'client':
      return [`client.${userId}.notifications`];
    case 'photographer':
      return [`photographer.${userId}.notifications`];
    case 'editor':
      return [`editor.${userId}.notifications`];
    default:
      return [];
  }
};

const setupEchoConnectionHandlers = (echo: any) => {
  const connection = echo?.connector?.pusher?.connection;
  if (!connection) return () => undefined;

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = (reason: string) => {
    logRealtimeDebug(`realtime connection ${reason}`);
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      try {
        echo.connect?.();
        logRealtimeDebug('realtime reconnect attempt');
      } catch (error) {
        logRealtimeDebug('realtime reconnect failed', error);
      }
    }, 2000);
  };

  const handleConnected = () => {
    clearReconnectTimer();
    logRealtimeDebug('realtime connection connected');
  };

  const handleDisconnected = () => scheduleReconnect('disconnected');
  const handleError = () => scheduleReconnect('error');

  connection.bind('connected', handleConnected);
  connection.bind('disconnected', handleDisconnected);
  connection.bind('error', handleError);

  return () => {
    clearReconnectTimer();
    connection.unbind('connected', handleConnected);
    connection.unbind('disconnected', handleDisconnected);
    connection.unbind('error', handleError);
  };
};

export const startRealtimeListener = async ({ role, userId }: RealtimeListenerOptions) => {
  if (!isRealtimeEnabled()) {
    logRealtimeDebug('realtime disabled via env');
    return () => undefined;
  }

  const echo = await getEchoClient();
  if (!echo) {
    logRealtimeDebug('realtime client unavailable');
    return () => undefined;
  }

  const cleanupConnectionHandlers = setupEchoConnectionHandlers(echo);

  const channels = getChannelsForRole(role, userId)
    .map((name) => ({ name, channel: echo.private(name) as EchoChannel }))
    .filter(Boolean);

  logRealtimeDebug('realtime listener started', { role, userId, channels: channels.map(({ name }) => name) });

  const cleanups: Array<() => void> = [];

  channels.forEach(({ channel }) => {
    DEFAULT_EVENTS.forEach((event) => {
      channel.listen(event.name, (payload: any) => {
        const resolved = event.resolveEvent(payload);
        logRealtimeDebug(`realtime event ${event.name}`, { payload, resolved });
        if (!resolved.type) return;
        emitRealtimeEvent({
          type: resolved.type,
          shootId: resolved.shootId,
          invoiceId: resolved.invoiceId,
          raw: payload,
        });
      });
    });

    cleanups.push(() => {
      DEFAULT_EVENTS.forEach((event) => channel.stopListening(event.name));
      channel.unsubscribe();
    });
  });

  return () => {
    cleanupConnectionHandlers();
    cleanups.forEach((cleanup) => cleanup());
  };
};
