import { useCallback, useState } from 'react';

import type { ShootData } from '@/types/shoots';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';

import {
  BRACKET_MODE_OPTIONS,
  DEFAULT_BRACKET_MODE,
  resolveUploadServiceBracketMode,
  resolveUploadServiceExpectedCount,
  toPositiveCount,
  triggerUploadRefreshes,
  type UploadServiceTarget,
} from './mediaUploadUtils';

export type PendingRestack = { serviceId: string; mode: number } | null;

/**
 * Per-service bracket size state and the execution-row persistence behind it.
 *
 * Extracted verbatim from `RawUploadSection` to keep that component under the
 * repository file-size limit. Behaviour, request shape, toasts and the
 * restack confirmation flow are unchanged.
 */
export function useServiceBracketMode({
  shoot,
  serviceTargets,
  shootRequiresBrackets,
}: {
  shoot: ShootData;
  serviceTargets: UploadServiceTarget[];
  shootRequiresBrackets: boolean;
}) {
  const { toast } = useToast();

  /**
   * Per-service bracket overrides, keyed by service id.
   *
   * Bracket size belongs to a service's execution, not to the shoot: the same
   * shoot can be Exterior at 5x by one photographer and Interior at 3x by
   * another. Each service already arrives with its own resolved size, so this
   * only holds sizes the user has changed in this session. An absent entry means
   * "use what the service says".
   */
  const [bracketOverrides, setBracketOverrides] = useState<Record<string, number | null>>({});

  /**
   * A service whose recorded size cannot move yet because its frames are already
   * stacked. Holding it here turns the refusal into an explicit confirmation instead
   * of a dead end.
   */
  const [pendingRestack, setPendingRestack] = useState<{ serviceId: string; mode: number } | null>(null);
  const [isSavingBracketMode, setIsSavingBracketMode] = useState(false);

  /**
   * Record the size on the execution row, not just in this component.
   *
   * The picker used to be local state only, so a chosen size was never durable and the
   * UI could disagree with what stacking actually used. `serviceId` here is the
   * shoot_service row id, which is what the endpoint addresses.
   *
   * Once raws exist the server refuses with 409 `restack_required`, because moving the
   * divisor re-cuts frames that are already numbered. That is surfaced as the deliberate
   * "Change & Restack this service" confirmation rather than applied silently.
   */
  const persistServiceBracketMode = useCallback(
    async (serviceId: string, mode: number, restack: boolean): Promise<boolean> => {
      if (!serviceId) {
        // An unassigned group has no execution row to write to; keep it session-local.
        setBracketOverrides((current) => ({ ...current, [serviceId]: mode }));
        return true;
      }

      setIsSavingBracketMode(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/shoots/${shoot.id}/service-items/${serviceId}/bracket-mode`,
          {
            method: 'PATCH',
            headers: { ...getApiHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ bracket_mode: mode, restack }),
          },
        );

        const payload = await response.json().catch(() => ({}));

        if (response.status === 409 && payload?.error_type === 'restack_required') {
          setPendingRestack({ serviceId, mode });
          return false;
        }

        if (!response.ok) {
          toast({
            title: 'Bracket size not changed',
            description: payload?.message || 'The bracket size could not be updated.',
            variant: 'destructive',
          });
          return false;
        }

        // Mirror the server's resolved value so the control and the counters agree.
        const effective = Number(payload?.effective_bracket_mode ?? mode);
        setBracketOverrides((current) => ({
          ...current,
          [serviceId]: Number.isFinite(effective) && effective > 0 ? effective : mode,
        }));
        triggerUploadRefreshes(shoot.id);

        if (payload?.restacked) {
          const label = serviceTargets.find((target) => target.id === serviceId)?.label ?? 'This service';
          toast({
            title: 'Bracket size changed and restacked',
            description: `${label} is now ${mode}x. Its existing frames were re-cut into new stacks.`,
          });
        }

        return true;
      } catch (error) {
        toast({
          title: 'Bracket size not changed',
          description: error instanceof Error ? error.message : 'The request could not be completed.',
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsSavingBracketMode(false);
      }
    },
    [serviceTargets, shoot.id, toast],
  );

  const setServiceBracketMode = useCallback(
    (serviceId: string, mode: number) => {
      void persistServiceBracketMode(serviceId, mode, false);
    },
    [persistServiceBracketMode],
  );

  const confirmRestack = useCallback(async () => {
    if (!pendingRestack) return;
    const { serviceId, mode } = pendingRestack;
    const ok = await persistServiceBracketMode(serviceId, mode, true);
    if (ok) setPendingRestack(null);
  }, [pendingRestack, persistServiceBracketMode]);

  /**
   * The bracket size a group for this service submits, or `null` to omit the field
   * entirely.
   *
   * Each service resolves independently, so one upload can carry Exterior at 5x
   * and Interior at 3x. `null` for a service that does not bracket keeps the field
   * out of the request altogether rather than sending a size that has no meaning
   * for floor plans, tours or drone work.
   *
   * The value is the service's own recorded size unless the user changed it on
   * that group in this session.
   */
  const resolveBracketModeForService = useCallback(
    (serviceId: string): number | null => {
      if (!serviceId) {
        // Unassigned uploads have no service to read, so they fall back to the
        // legacy shoot-wide value.
        return shootRequiresBrackets
          ? toPositiveCount(shoot.bracketMode ?? shoot.package?.bracketMode) ?? DEFAULT_BRACKET_MODE
          : null;
      }

      return resolveUploadServiceBracketMode(
        serviceTargets.find((candidate) => candidate.id === serviceId),
        bracketOverrides[serviceId],
      );
    },
    [bracketOverrides, serviceTargets, shoot, shootRequiresBrackets],
  );

  /**
   * Bracket choices for one service, each showing the raw count it implies for
   * that service alone. Previously this showed a shoot-wide total, which is
   * meaningless once two services are shot at different sizes.
   */
  const buildBracketOptionsForService = useCallback(
    (serviceId: string) => {
      const target = serviceTargets.find((candidate) => candidate.id === serviceId);

      return BRACKET_MODE_OPTIONS.map((value) => ({
        value,
        expected: target ? resolveUploadServiceExpectedCount(target, value) : 0,
      }));
    },
    [serviceTargets],
  );

  return {
    bracketOverrides,
    setBracketOverrides,
    pendingRestack,
    setPendingRestack,
    isSavingBracketMode,
    setServiceBracketMode,
    confirmRestack,
    resolveBracketModeForService,
    buildBracketOptionsForService,
  };
}
