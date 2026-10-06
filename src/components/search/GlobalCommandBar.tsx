import { sendShootToEditing } from '@/services/shootEditingDispatch';
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/components/auth/AuthProvider";
import { useOptionalShoots } from "@/context/shootsContextState";
import { useEditingRequests } from "@/hooks/useEditingRequests";
import { useShootSearch } from "@/hooks/useShootSearch";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/config/env";
import type { DashboardClientRequest } from "@/types/dashboard";
import type { EditingRequest } from "@/services/editingRequestService";
import type { ShootData } from "@/types/shoots";
import { buildFinalizeRequestBody, canFinaliseShoot } from "@/utils/shootFinalize";
import { buildShootPath } from "@/utils/shootPath";
import { finalizeShootWithProgressToast } from "@/components/shoots/finalize/finalizeShootWithProgressToast";

interface GlobalCommandBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_RESULTS = 8;

export const GlobalCommandBar: React.FC<GlobalCommandBarProps> = ({ open, onOpenChange }) => {
  const { role } = useAuth();
  const shootsContext = useOptionalShoots();
  // fetchShoots kept for post-action refresh only — do NOT filter ShootsProvider for header search.
  const fetchShoots = shootsContext?.fetchShoots;
  const isAdminExperience = ["admin", "superadmin", "super_admin"].includes(role);
  const canViewAvailability = ["admin", "superadmin", "salesRep", "sales_rep", "photographer"].includes(role);
  const canLoadEditingRequests = open && (isAdminExperience || role === "salesRep");

  const { requests: editingRequests } = useEditingRequests(canLoadEditingRequests);
  const [clientRequests, setClientRequests] = useState<DashboardClientRequest[]>([]);
  const [clientRequestsLoading, setClientRequestsLoading] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const trimmedQuery = searchValue.trim().toLowerCase();
  const shouldShowResults = trimmedQuery.length > 0;

  // Shared server search (tab=all&search=…). Empty/whitespace never hits the API.
  const {
    shoots: filteredShoots,
    isLoading: shootsSearchLoading,
    error: shootsSearchError,
    hasResolved: shootsSearchResolved,
  } = useShootSearch({
    query: searchValue,
    enabled: open && shouldShowResults,
  });

  useEffect(() => {
    if (!open) {
      setSearchValue("");
    }
  }, [open]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(true);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open || !isAdminExperience) {
      setClientRequests([]);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const fetchClientRequests = async () => {
      setClientRequestsLoading(true);
      try {
        const token = localStorage.getItem("authToken") || localStorage.getItem("token");
        if (!token) {
          setClientRequests([]);
          return;
        }
        const response = await fetch(`${API_BASE_URL}/api/client-requests`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          if (!cancelled) {
            setClientRequests([]);
          }
          return;
        }

        const json = await response.json();
        const data = Array.isArray(json.data) ? json.data : [];
        if (!cancelled) {
          setClientRequests(data as DashboardClientRequest[]);
        }
      } catch (error) {
        if (!cancelled) {
          setClientRequests([]);
        }
      } finally {
        if (!cancelled) {
          setClientRequestsLoading(false);
        }
      }
    };

    fetchClientRequests();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, isAdminExperience]);

  const matchesQuery = useCallback((value: string, query: string) => {
    if (!query) return true;
    return value.toLowerCase().includes(query);
  }, []);

  const shootSearchValue = useCallback((shoot: ShootData) => {
    const address = shoot.location?.fullAddress || `${shoot.location?.address || ""} ${shoot.location?.city || ""}`;
    return `${shoot.id} ${shoot.client?.name || ""} ${shoot.client?.company || ""} ${address}`.trim();
  }, []);

  const filteredClientRequests = useMemo(() => {
    if (!shouldShowResults || !isAdminExperience) return [];
    return clientRequests
      .filter((request) => {
        const shootInfo = request.shoot?.address || request.shoot?.id || request.shootId;
        const searchText = `${request.note} ${request.raisedBy?.name || ""} ${shootInfo || ""}`;
        return matchesQuery(searchText, trimmedQuery);
      })
      .slice(0, MAX_RESULTS);
  }, [clientRequests, trimmedQuery, matchesQuery, shouldShowResults, isAdminExperience]);

  const filteredEditingRequests = useMemo(() => {
    if (!shouldShowResults || !canLoadEditingRequests) return [];
    return editingRequests
      .filter((request) => {
        const shootInfo = request.shoot?.address || request.shoot?.id || request.shoot_id;
        const searchText = `${request.summary} ${request.tracking_code} ${request.requester?.name || ""} ${shootInfo || ""}`;
        return matchesQuery(searchText, trimmedQuery);
      })
      .slice(0, MAX_RESULTS);
  }, [editingRequests, trimmedQuery, matchesQuery, shouldShowResults, canLoadEditingRequests]);

  const actions = useMemo(() => {
    const baseActions = [
      {
        id: "new-shoot",
        label: "New shoot",
        keywords: "book shoot create",
        icon: <CalendarPlus className="h-4 w-4" />,
        onSelect: () => navigate("/book-shoot"),
      },
    ];

    if (canViewAvailability) {
      baseActions.push({
        id: "availability",
        label: "Open availability",
        keywords: "calendar availability",
        icon: <CalendarDays className="h-4 w-4" />,
        onSelect: () => navigate("/availability"),
      });
    }

    return baseActions;
  }, [navigate, canViewAvailability]);

  const filteredActions = useMemo(() => {
    if (!trimmedQuery) return actions;
    return actions.filter((action) =>
      matchesQuery(`${action.label} ${action.keywords}`, trimmedQuery),
    );
  }, [actions, matchesQuery, trimmedQuery]);

  const handleSendToEditing = useCallback(
    async (shoot: ShootData) => {
      const token = localStorage.getItem("authToken") || localStorage.getItem("token");
      if (!token) {
        toast({
          title: "Not authenticated",
          description: "Please sign in again to continue.",
          variant: "destructive",
        });
        return;
      }

      try {
        if (!await sendShootToEditing(shoot.id)) return;

        toast({
          title: "Success",
          description: "Shoot sent to editing.",
        });
        await fetchShoots?.();
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to send shoot to editing.",
          variant: "destructive",
        });
      }
    },
    [fetchShoots, toast],
  );

  const handleFinalizeShoot = useCallback(
    async (shoot: ShootData) => {
      const token = localStorage.getItem("authToken") || localStorage.getItem("token");
      if (!token) {
        toast({
          title: "Not authenticated",
          description: "Please sign in again to continue.",
          variant: "destructive",
        });
        return;
      }

      // Shared runner: progress toast for the queued background work plus the
      // success/failure copy every other finalize entry point uses.
      await finalizeShootWithProgressToast({
        shootId: shoot.id,
        shootLabel: shoot.location?.address,
        body: buildFinalizeRequestBody(shoot, "admin_verified"),
        onRefresh: () => {
          void fetchShoots?.();
        },
      });
    },
    [fetchShoots, toast],
  );

  const handleRequestManager = useCallback(
    (request: DashboardClientRequest) => {
      navigate("/dashboard", {
        state: {
          openRequestManager: true,
          selectedRequestId: request.id,
        },
      });
    },
    [navigate],
  );

  const handleEditingRequest = useCallback(
    (request: EditingRequest) => {
      navigate("/dashboard", {
        state: {
          openEditingRequest: true,
          editingRequestId: request.id,
        },
      });
    },
    [navigate],
  );

  const shouldShowEmpty =
    shouldShowResults &&
    !shootsSearchLoading &&
    !shootsSearchError &&
    shootsSearchResolved &&
    !filteredShoots.length &&
    !filteredClientRequests.length &&
    !filteredEditingRequests.length &&
    !filteredActions.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[92vw] rounded-2xl sm:rounded-2xl p-0 overflow-hidden">
        <Command shouldFilter={false} className="flex flex-col">
          <CommandInput
            placeholder="Search or run a command..."
            value={searchValue}
            onValueChange={setSearchValue}
            autoFocus
          />
          <CommandList className="max-h-[60vh]">
            {filteredActions.length > 0 && (
              <CommandGroup heading="Actions">
                {filteredActions.map((action) => (
                  <CommandItem
                    key={action.id}
                    onSelect={() => {
                      onOpenChange(false);
                      action.onSelect();
                    }}
                    value={`${action.label} ${action.keywords}`}
                  >
                    <div className="mr-2 text-muted-foreground">{action.icon}</div>
                    <span>{action.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {filteredActions.length > 0 &&
              (filteredShoots.length > 0 ||
                filteredClientRequests.length > 0 ||
                filteredEditingRequests.length > 0 ||
                shootsSearchLoading ||
                Boolean(shootsSearchError)) && <CommandSeparator />}

            {shootsSearchLoading && (
              <CommandGroup heading="Shoots">
                <CommandItem value="loading-shoots" disabled>
                  Searching shoots...
                </CommandItem>
              </CommandGroup>
            )}

            {shootsSearchError && !shootsSearchLoading && (
              <CommandGroup heading="Shoots">
                <CommandItem value="shoots-search-error" disabled>
                  Shoot search failed. Try again.
                </CommandItem>
              </CommandGroup>
            )}

            {filteredShoots.length > 0 && (
              <CommandGroup heading="Shoots">
                {filteredShoots.map((shoot) => (
                  <CommandItem
                    key={`shoot-${shoot.id}`}
                    value={shootSearchValue(shoot)}
                    onSelect={() => {
                      onOpenChange(false);
                      navigate(buildShootPath(shoot));
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">Shoot #{shoot.id}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {shoot.location?.fullAddress || shoot.location?.address}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {isAdminExperience && filteredShoots.length > 0 && (
              <CommandGroup heading="Shoot Actions">
                {filteredShoots.map((shoot) => (
                  <React.Fragment key={`actions-${shoot.id}`}>
                    <CommandItem
                      value={`send to editing ${shootSearchValue(shoot)}`}
                      onSelect={async () => {
                        onOpenChange(false);
                        await handleSendToEditing(shoot);
                      }}
                    >
                      <div className="mr-2 text-muted-foreground">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <span className="text-sm">Send to Editing · Shoot #{shoot.id}</span>
                    </CommandItem>
                    {canFinaliseShoot(shoot) && (
                      <CommandItem
                        value={`finalize shoot ${shootSearchValue(shoot)}`}
                        onSelect={async () => {
                          onOpenChange(false);
                          await handleFinalizeShoot(shoot);
                        }}
                      >
                        <div className="mr-2 text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <span className="text-sm">Finalize shoot · Shoot #{shoot.id}</span>
                      </CommandItem>
                    )}
                  </React.Fragment>
                ))}
              </CommandGroup>
            )}

            {isAdminExperience && filteredClientRequests.length > 0 && (
              <CommandGroup heading="Client Requests">
                {filteredClientRequests.map((request) => (
                  <CommandItem
                    key={`request-${request.id}`}
                    value={`${request.note} ${request.shoot?.address || ""}`}
                    onSelect={() => {
                      onOpenChange(false);
                      handleRequestManager(request);
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium truncate">{request.note}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {request.shoot?.address || `Shoot #${request.shootId}`}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {canLoadEditingRequests && filteredEditingRequests.length > 0 && (
              <CommandGroup heading="Editing Requests">
                {filteredEditingRequests.map((request) => (
                  <CommandItem
                    key={`editing-${request.id}`}
                    value={`${request.summary} ${request.tracking_code}`}
                    onSelect={() => {
                      onOpenChange(false);
                      handleEditingRequest(request);
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium truncate">{request.summary}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {request.shoot?.address || `Tracking ${request.tracking_code}`}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {clientRequestsLoading && (
              <CommandGroup heading="Requests">
                <CommandItem value="loading-requests" disabled>
                  Loading requests...
                </CommandItem>
              </CommandGroup>
            )}

            {shouldShowEmpty && <CommandEmpty>No results found.</CommandEmpty>}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
};
