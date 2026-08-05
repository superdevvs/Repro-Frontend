import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Camera, FileText, Loader2, Plus, Wrench, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { equipmentStatusLabel } from '@/services/photographerEquipmentService';
import { formatEquipmentMoney } from './accountFormModel';
import type { AccountFormController } from './useAccountFormController';

export function AccountEquipmentFields({ controller }: { controller: AccountFormController }) {
  const {
    initialData, assignedEquipmentLoading, assignedEquipmentOptions, assignedEquipmentError,
    addEquipmentRow, editingEquipmentId, equipmentEditValues, setEquipmentEditValues,
    saveEquipmentEdit, equipmentSaving, setEditingEquipmentId, openEquipmentEdit,
    equipmentManageOpen, setEquipmentManageOpen, existingEquipmentOptions,
    selectedExistingEquipmentIds, setSelectedExistingEquipmentIds, equipmentRows,
    setEquipmentRows,
    removeEquipmentRow, updateEquipmentRow, handleSaveAccountEquipment,
  } = controller;
  return (
                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">Equipments</h3>
                      {initialData && !assignedEquipmentLoading && (
                        <Badge variant="outline">{assignedEquipmentOptions.length}</Badge>
                      )}
                    </div>
                    {!initialData && (
                      <Button type="button" variant="outline" size="sm" onClick={addEquipmentRow}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Equipment
                      </Button>
                    )}
                  </div>

                  {initialData ? (
                    <div className="space-y-3">
                      {assignedEquipmentLoading ? (
                        <div className="flex items-center gap-2 rounded-md border border-dashed border-border/70 bg-background px-3 py-4 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading assigned equipment...
                        </div>
                      ) : assignedEquipmentError ? (
                        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-4 text-sm text-destructive">
                          {assignedEquipmentError}
                        </div>
                      ) : assignedEquipmentOptions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No equipment is assigned to this photographer yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {assignedEquipmentOptions.map((equipment) => {
                            const isEditingEquipment = editingEquipmentId === equipment.id;
                            const purchaseCost = formatEquipmentMoney(equipment.purchase_cost);
                            const referencePhotoCount = equipment.photos.filter((photo) => photo.type === "admin_reference").length;
                            const verificationPhotoCount = equipment.photos.filter((photo) => photo.type === "photographer_verification").length;

                            return (
                              <div
                                key={equipment.id}
                                className="rounded-md border border-border/70 bg-background p-3"
                              >
                                {isEditingEquipment ? (
                                  <div className="space-y-3">
                                    <div className="grid gap-3 sm:grid-cols-3">
                                      <div className="space-y-1.5">
                                        <FormLabel>Name</FormLabel>
                                        <Input
                                          value={equipmentEditValues.name}
                                          onChange={(event) => setEquipmentEditValues((current) => ({
                                            ...current,
                                            name: event.target.value,
                                          }))}
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <FormLabel>Serial Number</FormLabel>
                                        <Input
                                          value={equipmentEditValues.serialNumber}
                                          onChange={(event) => setEquipmentEditValues((current) => ({
                                            ...current,
                                            serialNumber: event.target.value,
                                          }))}
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <FormLabel>Issue Date</FormLabel>
                                        <Input
                                          type="date"
                                          value={equipmentEditValues.issueDate}
                                          onChange={(event) => setEquipmentEditValues((current) => ({
                                            ...current,
                                            issueDate: event.target.value,
                                          }))}
                                        />
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => saveEquipmentEdit(equipment.id)}
                                        disabled={equipmentSaving}
                                      >
                                        Save Equipment
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setEditingEquipmentId(null)}
                                        disabled={equipmentSaving}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                      <div className="min-w-0">
                                        <div className="truncate text-sm font-medium">{equipment.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {equipment.serial_number ? `Serial ${equipment.serial_number}` : "No serial number"}
                                          {equipment.issue_date ? ` · Issued ${equipment.issue_date}` : ""}
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={equipment.status === "verified" ? "default" : equipment.status === "rejected" ? "destructive" : "outline"}>
                                          {equipmentStatusLabel(equipment.status)}
                                        </Badge>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => openEquipmentEdit(equipment)}
                                        >
                                          Edit
                                        </Button>
                                      </div>
                                    </div>

                                    <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                                      <div className="rounded-md bg-muted/40 p-2">
                                        <div className="font-medium text-foreground">Purchase</div>
                                        <div>{equipment.purchase_date || "No purchase date"}</div>
                                      </div>
                                      <div className="rounded-md bg-muted/40 p-2">
                                        <div className="font-medium text-foreground">Cost / Rate</div>
                                        <div>{purchaseCost || "Not added"}</div>
                                      </div>
                                      <div className="rounded-md bg-muted/40 p-2">
                                        <div className="font-medium text-foreground">Vendor</div>
                                        <div>{equipment.vendor || "Not added"}</div>
                                      </div>
                                      <div className="rounded-md bg-muted/40 p-2">
                                        <div className="font-medium text-foreground">Photos</div>
                                        <div>{referencePhotoCount} admin / {verificationPhotoCount} verification</div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="rounded-md border border-border/70 bg-background p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="text-sm font-medium">Assign or add equipment</div>
                            <p className="text-xs text-muted-foreground">
                              Add company equipment here without leaving the account editor.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEquipmentManageOpen((open) => !open)}
                          >
                            {equipmentManageOpen ? "Hide" : "Manage Equipment"}
                          </Button>
                        </div>

                        {equipmentManageOpen && (
                          <div className="mt-4 space-y-4">
                            <div className="space-y-2">
                              <FormLabel>Assign Existing Unassigned Equipment</FormLabel>
                              {existingEquipmentOptions.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No unassigned equipment available.</p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {existingEquipmentOptions.map((equipment) => {
                                    const id = String(equipment.id);
                                    const active = selectedExistingEquipmentIds.includes(id);
                                    return (
                                      <button
                                        key={id}
                                        type="button"
                                        onClick={() => setSelectedExistingEquipmentIds((ids) =>
                                          active ? ids.filter((value) => value !== id) : [...ids, id]
                                        )}
                                        className={cn(
                                          "rounded-full border px-3 py-1.5 text-sm transition",
                                          active
                                            ? "border-primary/40 bg-primary/10 text-primary"
                                            : "border-border/70 bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                        )}
                                      >
                                        {equipment.name}{equipment.serial_number ? ` · ${equipment.serial_number}` : ""}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <FormLabel>New Equipment</FormLabel>
                                <Button type="button" variant="outline" size="sm" onClick={addEquipmentRow}>
                                  <Plus className="mr-2 h-4 w-4" />
                                  Add Row
                                </Button>
                              </div>
                              {equipmentRows.length === 0 ? (
                                <div className="rounded-md border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
                                  No new equipment rows added.
                                </div>
                              ) : equipmentRows.map((row, index) => (
                                <div key={row.id} className="rounded-md border border-border/70 p-3">
                                  <div className="mb-3 flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium">Equipment {index + 1}</span>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => removeEquipmentRow(row.id)}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="grid gap-3 md:grid-cols-3">
                                    <div className="space-y-1.5">
                                      <FormLabel>Name</FormLabel>
                                      <Input
                                        value={row.name}
                                        onChange={(event) => updateEquipmentRow(row.id, { name: event.target.value })}
                                        placeholder="Camera, iGUIDE machine"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <FormLabel>Serial Number</FormLabel>
                                      <Input
                                        value={row.serialNumber}
                                        onChange={(event) => updateEquipmentRow(row.id, { serialNumber: event.target.value })}
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <FormLabel>Issue Date</FormLabel>
                                      <Input
                                        type="date"
                                        value={row.issueDate}
                                        onChange={(event) => updateEquipmentRow(row.id, { issueDate: event.target.value })}
                                      />
                                    </div>
                                  </div>
                                  <div className="mt-3 space-y-1.5">
                                    <FormLabel>Admin Reference Photos</FormLabel>
                                    <Input
                                      type="file"
                                      accept="image/*"
                                      multiple
                                      onChange={(event) => updateEquipmentRow(row.id, {
                                        photos: Array.from(event.target.files || []),
                                      })}
                                    />
                                    {row.photos.length > 0 && (
                                      <p className="text-xs text-muted-foreground">
                                        {row.photos.length} photo{row.photos.length === 1 ? "" : "s"} selected
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setEquipmentRows([]);
                                  setSelectedExistingEquipmentIds([]);
                                  setEquipmentManageOpen(false);
                                }}
                                disabled={equipmentSaving}
                              >
                                Cancel Equipment Changes
                              </Button>
                              <Button type="button" onClick={handleSaveAccountEquipment} disabled={equipmentSaving}>
                                {equipmentSaving ? "Saving..." : "Save Equipment"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2 rounded-md border border-border/70 bg-background p-3">
                        <div className="space-y-1">
                          <FormLabel>Assign Existing Unassigned Equipment</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Pick company equipment that was already added in Accounting Equipments.
                          </p>
                        </div>
                        {existingEquipmentOptions.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No unassigned equipment available.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {existingEquipmentOptions.map((equipment) => {
                              const id = String(equipment.id);
                              const active = selectedExistingEquipmentIds.includes(id);
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => setSelectedExistingEquipmentIds((ids) =>
                                    active ? ids.filter((value) => value !== id) : [...ids, id]
                                  )}
                                  className={cn(
                                    "rounded-full border px-3 py-1.5 text-sm transition",
                                    active
                                      ? "border-primary/40 bg-primary/10 text-primary"
                                      : "border-border/70 bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                  )}
                                >
                                  {equipment.name}{equipment.serial_number ? ` · ${equipment.serial_number}` : ""}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {equipmentRows.length === 0 ? (
                        <div className="rounded-md border border-dashed border-border/70 bg-background px-3 py-4 text-sm text-muted-foreground">
                          No manual equipment rows added.
                        </div>
                      ) : equipmentRows.map((row, index) => (
                        <div key={row.id} className="rounded-md border border-border/70 bg-background p-3">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">Equipment {index + 1}</span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeEquipmentRow(row.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="space-y-1.5">
                              <FormLabel>Name</FormLabel>
                              <Input
                                value={row.name}
                                onChange={(event) => updateEquipmentRow(row.id, { name: event.target.value })}
                                placeholder="Camera, iGUIDE machine"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <FormLabel>Serial Number</FormLabel>
                              <Input
                                value={row.serialNumber}
                                onChange={(event) => updateEquipmentRow(row.id, { serialNumber: event.target.value })}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <FormLabel>Issue Date</FormLabel>
                              <Input
                                type="date"
                                value={row.issueDate}
                                onChange={(event) => updateEquipmentRow(row.id, { issueDate: event.target.value })}
                              />
                            </div>
                          </div>
                          <div className="mt-3 space-y-1.5">
                            <FormLabel>Admin Reference Photos</FormLabel>
                            <Input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(event) => updateEquipmentRow(row.id, {
                                photos: Array.from(event.target.files || []),
                              })}
                            />
                            <p className="text-xs text-muted-foreground">
                              Optional photos uploaded by admin now; more can be added later from Admin Accounting Equipments.
                            </p>
                            {row.photos.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {row.photos.length} photo{row.photos.length === 1 ? "" : "s"} selected
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
  );
}
