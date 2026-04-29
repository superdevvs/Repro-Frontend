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
  photos: [] as File[],
};

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
  const [editingEquipment, setEditingEquipment] = useState<PhotographerEquipment | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
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

  useEffect(() => {
    loadPhotographers();
  }, []);

  useEffect(() => {
    loadEquipments();
  }, [photographerFilter, statusFilter]);

  const filteredEquipments = useMemo(() => equipments, [equipments]);

  const submitEquipment = async () => {
    if (!form.photographer_id || !form.name.trim()) {
      toast({
        title: "Missing details",
        description: "Choose a photographer and enter the equipment name.",
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
        photos: form.photos,
      });
      toast({ title: "Equipment assigned", description: "The photographer can now verify it." });
      setDialogOpen(false);
      setForm(emptyForm);
      loadEquipments();
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
    setEditForm({
      photographer_id: String(equipment.photographer_id),
      name: equipment.name,
      serial_number: equipment.serial_number || "",
      issue_date: equipment.issue_date || "",
      photos: [],
    });
  };

  const submitEquipmentEdit = async () => {
    if (!editingEquipment || !editForm.photographer_id || !editForm.name.trim()) {
      return;
    }

    setBusyId(editingEquipment.id);
    try {
      await updateAdminPhotographerEquipment(editingEquipment.id, {
        photographer_id: editForm.photographer_id,
        name: editForm.name.trim(),
        serial_number: editForm.serial_number.trim(),
        issue_date: editForm.issue_date,
      });
      if (editForm.photos.length > 0) {
        await uploadAdminEquipmentPhotos(editingEquipment.id, editForm.photos);
      }
      toast({ title: "Equipment updated", description: "Admin reference photos were saved with the equipment." });
      setEditingEquipment(null);
      setEditForm(emptyForm);
      await loadEquipments();
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
              <Button onClick={() => setDialogOpen(true)}>
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
                        {equipment.photographer?.name || "Unassigned photographer"}{equipment.serial_number ? ` · Serial ${equipment.serial_number}` : ""}{equipment.issue_date ? ` · Issued ${equipment.issue_date}` : ""}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Equipment</DialogTitle>
            <DialogDescription>
              Assign equipment to a photographer and upload private admin reference photos now or later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Photographer</Label>
              <Select value={form.photographer_id} onValueChange={(value) => setForm((current) => ({ ...current, photographer_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select photographer" />
                </SelectTrigger>
                <SelectContent>
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
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input value={form.serial_number} onChange={(event) => setForm((current) => ({ ...current, serial_number: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Issue Date</Label>
              <Input type="date" value={form.issue_date} onChange={(event) => setForm((current) => ({ ...current, issue_date: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Admin Reference Photos</Label>
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
                These admin-uploaded photos are private and visible to the assigned photographer for verification.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitEquipment}>Add Equipment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingEquipment)} onOpenChange={(open) => !open && setEditingEquipment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Equipment</DialogTitle>
            <DialogDescription>
              Update assigned equipment details and add more private admin reference photos.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Photographer</Label>
              <Select value={editForm.photographer_id} onValueChange={(value) => setEditForm((current) => ({ ...current, photographer_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select photographer" />
                </SelectTrigger>
                <SelectContent>
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
              <Label>Add Admin Reference Photos</Label>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEquipment(null)}>Cancel</Button>
            <Button onClick={submitEquipmentEdit} disabled={busyId === editingEquipment?.id}>
              Save Equipment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
