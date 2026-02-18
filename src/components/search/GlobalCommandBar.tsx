import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Sparkles,
  Users,
  UserSquare2,
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
import { useOptionalShoots } from "@/context/ShootsContext";
import { useEditingRequests } from "@/hooks/useEditingRequests";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/config/env";
import type { DashboardClientRequest } from "@/types/dashboard";
import type { EditingRequest } from "@/services/editingRequestService";
import type { ShootData } from "@/types/shoots";

interface GlobalCommandBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_RESULTS = 8;

export const GlobalCommandBar: React.FC<GlobalCommandBarProps> = ({ open, onOpenChange }) => {
  const { role } = useAuth();
  const shootsContext = useOptionalShoots();
  const shoots = shootsContext?.shoots ?? [];
  const fetchShoots = shootsContext?.fetchShoots;
  const isAdminExperience = ["admin", "superadmin"].includes(role);
  const canViewAvailability = ["admin", "superadmin", "salesRep", "sales_rep", "photographer"].includes(role);
  const canLoadEditingRequests = isAdminExperience || role === "salesRep";
  const { requests: editingRequests } = useEditingRequests(canLoadEditingRequests);
  const [clientRequests, setClientRequests] = useState<DashboardClientRequest[]>([]);
  const [clientRequestsLoading, setClientRequestsLoading] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const trimmedQuery = searchValue.trim().toLowerCase();
  const shouldShowResults = trimmedQuery.length > 0;

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
    if (!isAdminExperience) {
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
  }, [isAdminExperience]);

  const matchesQuery = useCallback((value: string, query: string) => {
    if (!query) return true;
    return value.toLowerCase().includes(query);
  }, []);

  const shootSearchValue = useCallback((shoot: ShootData) => {
    const address = shoot.location?.fullAddress || `${shoot.location?.address || ""} ${shoot.location?.city || ""}`;
    return `${shoot.id} ${shoot.client?.name || ""} ${shoot.client?.company || ""} ${address}`.trim();
  }, []);

  const filteredShoots = useMemo(() => {
    if (!shouldShowResults) return [];
    return shoots
      .filter((shoot) => matchesQuery(shootSearchValue(shoot), trimmedQuery))
      .slice(0, MAX_RESULTS);
  }, [shoots, matchesQuery, shootSearchValue, trimmedQuery, shouldShowResults]);

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

  const clients = useMemo(
    () => (shootsContext ? shootsContext.getUniqueClients() : []),
    [shootsContext, shoots]
  );
  const photographers = useMemo(
    () => (shootsContext ? shootsContext.getUniquePhotographers() : []),
    [shootsContext, shoots]
  );
  const editors = useMemo(
    () => (shootsContext ? shootsContext.getUniqueEditors() : []),
    [shootsContext, shoots]
  );

  const filteredClients = useMemo(() => {
    if (!shouldShowResults) return [];
    return clients
      .filter((client) => {
        const searchText = `${client.name} ${client.email || ""} ${client.company || ""}`;
        return matchesQuery(searchText, trimmedQuery);
      })
      .slice(0, MAX_RESULTS);
  }, [clients, trimmedQuery, matchesQuery, shouldShowResults]);

  const filteredPhotographers = useMemo(() => {
    if (!shouldShowResults) return [];
    return photographers
      .filter((photographer) => matchesQuery(photographer.name, trimmedQuery))
      .slice(0, MAX_RESULTS);
  }, [photographers, trimmedQuery, matchesQuery, shouldShowResults]);

  const filteredEditors = useMemo(() => {
    if (!shouldShowResults) return [];
    return editors
      .filter((editor) => matchesQuery(editor.name, trimmedQuery))
      .slice(0, MAX_RESULTS);
  }, [editors, trimmedQuery, matchesQuery, shouldShowResults]);

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
      if (!shoot.editor?.id) {
        toast({
          title: "Editor required",
          description: "Assign an editor before sending this shoot to editing.",
          variant: "destructive",
        });
        return;
      }

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
        const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/send-to-editing`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ editor_id: shoot.editor.id }),
        });

        if (!response.ok) {
          throw new Error("Failed to send to editing");
        }

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

      try {
        const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/finalize`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ final_status: "admin_verified" }),
        });

        if (!response.ok) {
          throw new Error("Failed to finalize shoot");
        }

        toast({
          title: "Success",
          description: "Shoot finalized and delivered.",
        });
        await fetchShoots?.();
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to finalize shoot.",
          variant: "destructive",
        });
      }
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

  const handleOpenAccounts = useCallback(
    (role: "client" | "photographer" | "editor", name: string) => {
      navigate(`/accounts?role=${role}&search=${encodeURIComponent(name)}`);
    },
    [navigate],
  );

  const shouldShowEmpty =
    shouldShowResults &&
    !filteredShoots.length &&
    !filteredClientRequests.length &&
    !filteredEditingRequests.length &&
    !filteredClients.length &&
    !filteredPhotographers.length &&
    !filteredEditors.length &&
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
                filteredClients.length > 0 ||
                filteredPhotographers.length > 0 ||
                filteredEditors.length > 0) && <CommandSeparator />}

            {filteredShoots.length > 0 && (
              <CommandGroup heading="Shoots">
                {filteredShoots.map((shoot) => (
                  <CommandItem
                    key={`shoot-${shoot.id}`}
                    value={shootSearchValue(shoot)}
                    onSelect={() => {
                      onOpenChange(false);
                      navigate(`/shoots/${shoot.id}`);
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

            {filteredClients.length > 0 && (
              <CommandGroup heading="Clients">
                {filteredClients.map((client) => (
                  <CommandItem
                    key={`client-${client.name}`}
                    value={`${client.name} ${client.email || ""} ${client.company || ""}`}
                    onSelect={() => {
                      onOpenChange(false);
                      handleOpenAccounts("client", client.name);
                    }}
                  >
                    <div className="mr-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium truncate">{client.name}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {client.company || client.email || "Client"}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {filteredPhotographers.length > 0 && (
              <CommandGroup heading="Photographers">
                {filteredPhotographers.map((photographer) => (
                  <CommandItem
                    key={`photographer-${photographer.name}`}
                    value={photographer.name}
                    onSelect={() => {
                      onOpenChange(false);
                      handleOpenAccounts("photographer", photographer.name);
                    }}
                  >
                    <div className="mr-2 text-muted-foreground">
                      <UserSquare2 className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium truncate">{photographer.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {photographer.shootCount} shoot{photographer.shootCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {filteredEditors.length > 0 && (
              <CommandGroup heading="Editors">
                {filteredEditors.map((editor) => (
                  <CommandItem
                    key={`editor-${editor.name}`}
                    value={editor.name}
                    onSelect={() => {
                      onOpenChange(false);
                      handleOpenAccounts("editor", editor.name);
                    }}
                  >
                    <div className="mr-2 text-muted-foreground">
                      <UserSquare2 className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium truncate">{editor.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {editor.shootCount} shoot{editor.shootCount === 1 ? "" : "s"}
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
