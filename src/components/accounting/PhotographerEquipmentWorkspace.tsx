import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/services/api";
import {
  approvePhotographerEquipment,
  createAdminPhotographerEquipment,
  deleteAdminPhotographerEquipment,
  equipmentStatusLabel,
  listAdminPhotographerEquipments,
  openEquipmentPhoto,
  rejectPhotographerEquipment,
  sendPhotographerEquipmentVerificationEmail,
  type EquipmentStatus,
  type PhotographerEquipment,
  updateAdminPhotographerEquipment,
  uploadAdminEquipmentPhotos,
} from "@/services/photographerEquipmentService";
import { Check, Edit, Eye, Mail, Plus, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type PhotographerOption = {
  id: string;
  name: string;
  email: string;
};

const statusOptions: Array<{ value: EquipmentStatus | "all"; label: string }> = [
  { value: "all", label: "All Statuses" },
  { value: "pending_verification", label: "Pending Verification" },
  { value: "submitted", label: "Submitted" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
];

const emptyForm = {
  photographer_id: "",
  name: "",
  serial_number: "",
  issue_date: "",
  purchase_date: "",
  purchase_cost: "",
  vendor: "",
  add_to_expense: false,
  receipt: null as File | null,
  photos: [] as File[],
};

type EquipmentFormState = typeof emptyForm;

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const apiMessage = (error as any)?.response?.data?.message;
  return typeof apiMessage === "string" && apiMessage.trim() ? apiMessage : fallback;
};

export function PhotographerEquipmentWorkspace() {
  const { toast } = useToast();
  const [equipments, setEquipments] = useState<PhotographerEquipment[]>([]);
  const [photographers, setPhotographers] = useState<PhotographerOption[]>([]);
  const [photographerFilter, setPhotographerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [unassignedEquipments, setUnassignedEquipments] = useState<PhotographerEquipment[]>([]);
  const [selectedExistingEquipmentId, setSelectedExistingEquipmentId] = useState("");
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [financePanelOpen, setFinancePanelOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<PhotographerEquipment | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editFinancePanelOpen, setEditFinancePanelOpen] = useState(false);
  const [rowPhotos, setRowPhotos] = useState<Record<number, File[]>>({});
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadPhotographers = async () => {
    const response = await apiClient.get("/admin/photographers");
    const raw = response.data?.data || response.data?.photographers || [];
    setPhotographers(raw.map((photographer: any) => ({
      id: String(photographer.id),
      name: photographer.name || photographer.email,
      email: photographer.email || "",
    })));
  };

  const loadEquipments = async () => {
    setLoading(true);
    try {
      const data = await listAdminPhotographerEquipments({
        photographer_id: photographerFilter === "all" ? undefined : photographerFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
        search: search.trim() || undefined,
      });
      setEquipments(data);
    } catch (error) {
      console.error("Failed to load photographer equipments", error);
      toast({
        title: "Unable to load equipments",
        description: getApiErrorMessage(error, "Please refresh and try again."),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUnassignedEquipments = async () => {
    try {
      const data = await listAdminPhotographerEquipments();
      setUnassignedEquipments(data.filter((equipment) => !equipment.photographer_id));
    } catch (error) {
      console.error("Failed to load unassigned photographer equipments", error);
      setUnassignedEquipments([]);
    }
  };

  useEffect(() => {
    loadPhotographers();
    loadUnassignedEquipments();
  }, []);

  useEffect(() => {
    loadEquipments();
  }, [photographerFilter, statusFilter]);

  const filteredEquipments = useMemo(() => equipments, [equipments]);
  const selectedExistingEquipment = useMemo(
    () => unassignedEquipments.find((equipment) => String(equipment.id) === selectedExistingEquipmentId) || null,
    [selectedExistingEquipmentId, unassignedEquipments],
  );

  const openAddDialog = () => {
    setForm(emptyForm);
    setSelectedExistingEquipmentId("");
    setManualEntryOpen(false);
    setFinancePanelOpen(false);
    setDialogOpen(true);
    loadUnassignedEquipments();
  };

  const handleExistingEquipmentChange = (value: string) => {
    if (value === "select") {
      setSelectedExistingEquipmentId("");
      setManualEntryOpen(false);
      return;
    }

    if (value === "new") {
      setSelectedExistingEquipmentId("");
      setManualEntryOpen(true);
      setForm((current) => ({
        ...emptyForm,
        photographer_id: current.photographer_id,
        issue_date: current.issue_date,
      }));
      return;
    }

    const equipment = unassignedEquipments.find((item) => String(item.id) === value);
    setSelectedExistingEquipmentId(value);
    setManualEntryOpen(false);
    if (equipment) {
      setForm((current) => ({
        ...current,
        name: equipment.name,
        serial_number: equipment.serial_number || "",
        issue_date: equipment.issue_date || current.issue_date,
        purchase_date: equipment.purchase_date || "",
        purchase_cost: equipment.purchase_cost != null ? String(equipment.purchase_cost) : "",
        vendor: equipment.vendor || "",
        add_to_expense: Boolean(equipment.expense_id),
        receipt: null,
        photos: [],
      }));
    }
  };

  const submitEquipment = async () => {
    if (selectedExistingEquipment) {
      if (!form.photographer_id) {
        toast({
          title: "Choose a photographer",
          description: "Select the photographer who will receive this equipment.",
          variant: "destructive",
        });
        return;
      }

      setBusyId(selectedExistingEquipment.id);
      try {
        await updateAdminPhotographerEquipment(selectedExistingEquipment.id, {
          photographer_id: form.photographer_id,
          issue_date: form.issue_date,
          ...(financePanelOpen
            ? {
              purchase_date: form.purchase_date,
              purchase_cost: form.purchase_cost,
              vendor: form.vendor,
              add_to_expense: form.add_to_expense,
              receipt: form.receipt,
            }
            : {}),
        });
        if (form.photos.length > 0) {
          await uploadAdminEquipmentPhotos(selectedExistingEquipment.id, form.photos);
        }
        toast({ title: "Equipment assigned", description: "The photographer can now verify it." });
        setDialogOpen(false);
        setForm(emptyForm);
        setSelectedExistingEquipmentId("");
        setManualEntryOpen(false);
        setFinancePanelOpen(false);
        await loadEquipments();
        await loadUnassignedEquipments();
      } catch (error) {
        console.error("Failed to assign existing photographer equipment", error);
        toast({
          title: "Could not assign equipment",
          description: getApiErrorMessage(error, "Please check the fields and try again."),
          variant: "destructive",
        });
      } finally {
        setBusyId(null);
      }
      return;
    }

    if (!manualEntryOpen || !form.name.trim()) {
      toast({
        title: "Missing details",
        description: "Choose an existing equipment or add a new equipment name.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createAdminPhotographerEquipment({
        photographer_id: form.photographer_id,
        name: form.name.trim(),
        serial_number: form.serial_number.trim(),
        issue_date: form.issue_date,
        ...(financePanelOpen
          ? {
            purchase_date: form.purchase_date,
            purchase_cost: form.purchase_cost,
            vendor: form.vendor,
            add_to_expense: form.add_to_expense,
            receipt: form.receipt,
          }
          : {}),
        photos: form.photos,
      });
      toast({ title: "Equipment assigned", description: "The photographer can now verify it." });
      setDialogOpen(false);
      setForm(emptyForm);
      setManualEntryOpen(false);
      setFinancePanelOpen(false);
      await loadEquipments();
      await loadUnassignedEquipments();
    } catch (error) {
      console.error("Failed to create photographer equipment", error);
      toast({
        title: "Could not assign equipment",
        description: getApiErrorMessage(error, "Please check the fields and try again."),
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (equipment: PhotographerEquipment) => {
    setEditingEquipment(equipment);
    setEditFinancePanelOpen(false);
    setEditForm({
      photographer_id: equipment.photographer_id ? String(equipment.photographer_id) : "",
      name: equipment.name,
      serial_number: equipment.serial_number || "",
      issue_date: equipment.issue_date || "",
      purchase_date: equipment.purchase_date || "",
      purchase_cost: equipment.purchase_cost != null ? String(equipment.purchase_cost) : "",
      vendor: equipment.vendor || "",
      add_to_expense: Boolean(equipment.expense_id),
      receipt: null,
      photos: [],
    });
  };

  const submitEquipmentEdit = async () => {
    if (!editingEquipment || !editForm.name.trim()) {
      return;
    }

    setBusyId(editingEquipment.id);
    try {
      await updateAdminPhotographerEquipment(editingEquipment.id, {
        photographer_id: editForm.photographer_id,
        name: editForm.name.trim(),
        serial_number: editForm.serial_number.trim(),
        issue_date: editForm.issue_date,
        ...(editFinancePanelOpen
          ? {
            purchase_date: editForm.purchase_date,
            purchase_cost: editForm.purchase_cost,
            vendor: editForm.vendor,
            add_to_expense: editForm.add_to_expense,
            receipt: editForm.receipt,
          }
          : {}),
      });
      if (editForm.photos.length > 0) {
        await uploadAdminEquipmentPhotos(editingEquipment.id, editForm.photos);
      }
      toast({ title: "Equipment updated", description: "Admin reference photos were saved with the equipment." });
      setEditingEquipment(null);
      setEditForm(emptyForm);
      setEditFinancePanelOpen(false);
      await loadEquipments();
      await loadUnassignedEquipments();
    } catch (error) {
      console.error("Failed to update photographer equipment", error);
      toast({
        title: "Could not update equipment",
        description: getApiErrorMessage(error, "Please check the fields and try again."),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const runEquipmentAction = async (equipmentId: number, action: () => Promise<unknown>, successTitle: string) => {
    setBusyId(equipmentId);
    try {
      await action();
      toast({ title: successTitle });
      await loadEquipments();
    } catch (error) {
      console.error("Equipment action failed", error);
      toast({
        title: "Action failed",
        description: getApiErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = (equipment: PhotographerEquipment) => {
    const reason = window.prompt("Rejection reason (optional)") || "";
    runEquipmentAction(
      equipment.id,
      () => rejectPhotographerEquipment(equipment.id, reason),
      "Equipment rejected",
    );
  };

  const handleReferenceUpload = (equipment: PhotographerEquipment) => {
    const photos = rowPhotos[equipment.id] || [];
    if (photos.length === 0) return;
    runEquipmentAction(
      equipment.id,
      () => uploadAdminEquipmentPhotos(equipment.id, photos),
      "Reference photos uploaded",
    );
  };

  const renderFinancialPanel = (
    values: EquipmentFormState,
    setValues: React.Dispatch<React.SetStateAction<EquipmentFormState>>,
    checkboxId: string,
    linkedExpenseLabel: string,
  ) => (
    <div className="space-y-4 rounded-md border border-border/70 bg-background/80 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Purchase & Expense</h3>
        <p className="text-xs text-muted-foreground">
          Admin-only accounting details. These fields are never shown to photographers.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Purchase Date</Label>
          <Input
            type="date"
            value={values.purchase_date}
            onChange={(event) => setValues((current) => ({ ...current, purchase_date: event.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Purchase Cost</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={values.purchase_cost}
            onChange={(event) => setValues((current) => ({ ...current, purchase_cost: event.target.value }))}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Vendor</Label>
        <Input
          value={values.vendor}
          onChange={(event) => setValues((current) => ({ ...current, vendor: event.target.value }))}
        />
      </div>
      <div className="flex items-center gap-2 rounded-md border border-border/70 p-3">
        <input
          id={checkboxId}
          type="checkbox"
          checked={values.add_to_expense}
          onChange={(event) => setValues((current) => ({ ...current, add_to_expense: event.target.checked }))}
          className="h-4 w-4"
        />
        <Label htmlFor={checkboxId}>{linkedExpenseLabel}</Label>
      </div>
      <div className="space-y-2">
        <Label>Expense Receipt</Label>
        <Input
          type="file"
          accept="image/*,.pdf"
          onChange={(event) => setValues((current) => ({
            ...current,
            receipt: event.target.files?.[0] || null,
          }))}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Equipments</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={loadEquipments} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button onClick={openAddDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Equipment
              </Button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr,220px,220px,auto]">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") loadEquipments();
              }}
              placeholder="Search equipment, serial, photographer"
            />
            <Select value={photographerFilter} onValueChange={setPhotographerFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Photographer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Photographers</SelectItem>
                {photographers.map((photographer) => (
                  <SelectItem key={photographer.id} value={photographer.id}>
                    {photographer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadEquipments}>Search</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="rounded-md border p-6 text-sm text-muted-foreground">Loading equipments...</div>
          ) : filteredEquipments.length === 0 ? (
            <div className="rounded-md border p-6 text-sm text-muted-foreground">No equipments found.</div>
          ) : (
            filteredEquipments.map((equipment) => {
              const referencePhotos = equipment.photos.filter((photo) => photo.type === "admin_reference");
              const verificationPhotos = equipment.photos.filter((photo) => photo.type === "photographer_verification");
              const rowSelectedPhotos = rowPhotos[equipment.id] || [];

              return (
                <div key={equipment.id} className="rounded-lg border bg-background p-4">
                  <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr,auto] lg:items-start">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{equipment.name}</h3>
                        <Badge variant={equipment.status === "verified" ? "default" : equipment.status === "rejected" ? "destructive" : "outline"}>
                          {equipmentStatusLabel(equipment.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {equipment.photographer?.name || "Unassigned equipment"}{equipment.serial_number ? ` · Serial ${equipment.serial_number}` : ""}{equipment.issue_date ? ` · Issued ${equipment.issue_date}` : ""}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {equipment.purchase_date ? `Purchased ${equipment.purchase_date}` : "No purchase date"}
                        {equipment.purchase_cost != null ? ` · $${equipment.purchase_cost.toLocaleString()}` : ""}
                        {equipment.vendor ? ` · ${equipment.vendor}` : ""}
                        {equipment.expense_id ? " · Expense linked" : ""}
                      </p>
                      {equipment.rejection_reason && (
                        <p className="text-sm text-destructive">{equipment.rejection_reason}</p>
                      )}
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex flex-wrap gap-2">
                        {referencePhotos.map((photo) => (
                        <Button key={photo.id} type="button" variant="outline" size="sm" onClick={() => openEquipmentPhoto(photo)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Reference
                          </Button>
                        ))}
                        {verificationPhotos.map((photo) => (
                          <Button key={photo.id} type="button" variant="outline" size="sm" onClick={() => openEquipmentPhoto(photo)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Verification
                          </Button>
                        ))}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(event) => setRowPhotos((current) => ({
                            ...current,
                            [equipment.id]: Array.from(event.target.files || []),
                          }))}
                        />
                        <Button type="button" variant="outline" onClick={() => handleReferenceUpload(equipment)} disabled={rowSelectedPhotos.length === 0 || busyId === equipment.id}>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Admin Reference
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button size="sm" variant="outline" onClick={() => openEditDialog(equipment)} disabled={busyId === equipment.id}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => runEquipmentAction(equipment.id, () => sendPhotographerEquipmentVerificationEmail(equipment.id), "Verification email sent")} disabled={busyId === equipment.id}>
                        <Mail className="mr-2 h-4 w-4" />
                        Send Mail
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => runEquipmentAction(equipment.id, () => approvePhotographerEquipment(equipment.id), "Equipment approved")} disabled={busyId === equipment.id}>
                        <Check className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleReject(equipment)} disabled={busyId === equipment.id}>
                        <X className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => runEquipmentAction(equipment.id, () => deleteAdminPhotographerEquipment(equipment.id), "Equipment deleted")} disabled={busyId === equipment.id}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setSelectedExistingEquipmentId("");
          setManualEntryOpen(false);
          setFinancePanelOpen(false);
        }
      }}>
        <DialogContent className={financePanelOpen ? "max-w-5xl" : "max-w-2xl"}>
          <DialogHeader>
            <DialogTitle>Add Equipment</DialogTitle>
            <DialogDescription>
              Assign existing inventory to a photographer, or add a new equipment record.
            </DialogDescription>
          </DialogHeader>
          <div className={financePanelOpen ? "grid gap-5 py-2 lg:grid-cols-[minmax(0,1fr)_340px]" : "grid gap-4 py-2"}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Photographer</Label>
                <Select value={form.photographer_id || "unassigned"} onValueChange={(value) => setForm((current) => ({ ...current, photographer_id: value === "unassigned" ? "" : value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select photographer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Select Photographer</SelectItem>
                    {photographers.map((photographer) => (
                      <SelectItem key={photographer.id} value={photographer.id}>
                        {photographer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Inventory Equipment</Label>
                {unassignedEquipments.length > 0 ? (
                  <Select
                    value={selectedExistingEquipmentId || (manualEntryOpen ? "new" : "select")}
                    onValueChange={handleExistingEquipmentChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose existing equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="select">Choose from unassigned inventory</SelectItem>
                      {unassignedEquipments.map((equipment) => (
                        <SelectItem key={equipment.id} value={String(equipment.id)}>
                          {equipment.name}{equipment.serial_number ? ` - ${equipment.serial_number}` : ""}
                        </SelectItem>
                      ))}
                      <SelectItem value="new">Add new equipment</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="rounded-md border border-dashed border-border/70 p-3 text-sm text-muted-foreground">
                    No unassigned equipment is available.
                  </div>
                )}
              </div>

              {selectedExistingEquipment && (
                <div className="rounded-md border border-border/70 bg-background/70 p-3 text-sm">
                  <div className="font-medium">{selectedExistingEquipment.name}</div>
                  <div className="text-muted-foreground">
                    {selectedExistingEquipment.serial_number ? `Serial ${selectedExistingEquipment.serial_number}` : "No serial number"}
                    {selectedExistingEquipment.purchase_date ? ` · Purchased ${selectedExistingEquipment.purchase_date}` : ""}
                  </div>
                </div>
              )}

              {!manualEntryOpen && !selectedExistingEquipment && (
                <Button type="button" variant="outline" onClick={() => handleExistingEquipmentChange("new")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Equipment
                </Button>
              )}

              {manualEntryOpen && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Serial Number</Label>
                    <Input value={form.serial_number} onChange={(event) => setForm((current) => ({ ...current, serial_number: event.target.value }))} />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Input type="date" value={form.issue_date} onChange={(event) => setForm((current) => ({ ...current, issue_date: event.target.value }))} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>Admin Reference Photos</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setFinancePanelOpen((open) => !open)}>
                    {financePanelOpen ? "Hide Purchase" : "Purchase / Expense"}
                  </Button>
                </div>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    photos: Array.from(event.target.files || []),
                  }))}
                />
                <p className="text-xs text-muted-foreground">
                  These private admin photos are visible to the assigned photographer for verification.
                </p>
              </div>
            </div>
            {financePanelOpen && renderFinancialPanel(
              form,
              setForm,
              "add-equipment-expense",
              "Add this equipment as an accounting expense",
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDialogOpen(false);
              setSelectedExistingEquipmentId("");
              setManualEntryOpen(false);
              setFinancePanelOpen(false);
            }}>Cancel</Button>
            <Button onClick={submitEquipment} disabled={busyId === selectedExistingEquipment?.id}>
              {selectedExistingEquipment ? "Assign Equipment" : "Add Equipment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingEquipment)} onOpenChange={(open) => {
        if (!open) {
          setEditingEquipment(null);
          setEditFinancePanelOpen(false);
        }
      }}>
        <DialogContent className={editFinancePanelOpen ? "max-w-5xl" : "max-w-2xl"}>
          <DialogHeader>
            <DialogTitle>Edit Equipment</DialogTitle>
            <DialogDescription>
              Update assigned equipment details and add more private admin reference photos.
            </DialogDescription>
          </DialogHeader>
          <div className={editFinancePanelOpen ? "grid gap-5 py-2 lg:grid-cols-[minmax(0,1fr)_340px]" : "grid gap-4 py-2"}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Photographer</Label>
                <Select value={editForm.photographer_id || "unassigned"} onValueChange={(value) => setEditForm((current) => ({ ...current, photographer_id: value === "unassigned" ? "" : value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select photographer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Select Photographer</SelectItem>
                    {photographers.map((photographer) => (
                      <SelectItem key={photographer.id} value={photographer.id}>
                        {photographer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Serial Number</Label>
                  <Input value={editForm.serial_number} onChange={(event) => setEditForm((current) => ({ ...current, serial_number: event.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Input type="date" value={editForm.issue_date} onChange={(event) => setEditForm((current) => ({ ...current, issue_date: event.target.value }))} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>Add Admin Reference Photos</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditFinancePanelOpen((open) => !open)}>
                    {editFinancePanelOpen ? "Hide Purchase" : "Purchase / Expense"}
                  </Button>
                </div>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => setEditForm((current) => ({
                    ...current,
                    photos: Array.from(event.target.files || []),
                  }))}
                />
                <p className="text-xs text-muted-foreground">
                  Admins can add more reference photos while editing equipment; existing photos stay attached.
                </p>
              </div>
            </div>
            {editFinancePanelOpen && renderFinancialPanel(
              editForm,
              setEditForm,
              "edit-equipment-expense",
              "Add or update this equipment as an accounting expense",
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingEquipment(null);
              setEditFinancePanelOpen(false);
            }}>Cancel</Button>
            <Button onClick={submitEquipmentEdit} disabled={busyId === editingEquipment?.id}>
              Save Equipment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
