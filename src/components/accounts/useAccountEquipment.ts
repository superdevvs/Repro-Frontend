import React, { useEffect, useState } from 'react';
import type { useToast } from '@/hooks/use-toast';
import {
  createAdminPhotographerEquipment,
  listAdminPhotographerEquipments,
  type PhotographerEquipment,
  updateAdminPhotographerEquipment,
} from '@/services/photographerEquipmentService';
import {
  createEquipmentDraftRow,
  getRequestErrorMessage,
  type EquipmentDraftRow,
  type FormRole,
} from './accountFormModel';

type AccountEquipmentOptions = {
  initialDataId?: string | number;
  currentRole: FormRole;
  open: boolean;
  toast: ReturnType<typeof useToast>['toast'];
};

export const useAccountEquipment = ({
  initialDataId,
  currentRole,
  open,
  toast,
}: AccountEquipmentOptions) => {
  const [equipmentRows, setEquipmentRows] = useState<EquipmentDraftRow[]>([]);
  const [existingEquipmentOptions, setExistingEquipmentOptions] = useState<PhotographerEquipment[]>([]);
  const [assignedEquipmentOptions, setAssignedEquipmentOptions] = useState<PhotographerEquipment[]>([]);
  const [assignedEquipmentLoading, setAssignedEquipmentLoading] = useState(false);
  const [assignedEquipmentError, setAssignedEquipmentError] = useState<string | null>(null);
  const [selectedExistingEquipmentIds, setSelectedExistingEquipmentIds] = useState<string[]>([]);
  const [equipmentManageOpen, setEquipmentManageOpen] = useState(false);
  const [equipmentSaving, setEquipmentSaving] = useState(false);
  const [editingEquipmentId, setEditingEquipmentId] = useState<number | null>(null);
  const [equipmentEditValues, setEquipmentEditValues] = useState({
    name: "",
    serialNumber: "",
    issueDate: "",
  });
  const updateEquipmentRow = (rowId: string, patch: Partial<EquipmentDraftRow>) => {
    setEquipmentRows((rows) => rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  };
  const addEquipmentRow = () => {
    setEquipmentRows((rows) => [...rows, createEquipmentDraftRow()]);
  };
  const removeEquipmentRow = (rowId: string) => {
    setEquipmentRows((rows) => rows.filter((row) => row.id !== rowId));
  };
  const activeEquipmentRows = React.useMemo(
    () => equipmentRows.filter((row) => row.name.trim()),
    [equipmentRows],
  );
  useEffect(() => {
    if (!open || currentRole !== "photographer") {
      return;
    }
    listAdminPhotographerEquipments()
      .then((items) => setExistingEquipmentOptions(items.filter((item) => !item.photographer_id)))
      .catch((error) => {
        console.error("Failed to load unassigned equipment", error);
        setExistingEquipmentOptions([]);
      });
  }, [currentRole, open]);
  useEffect(() => {
    if (!open || currentRole !== "photographer" || !initialDataId) {
      setAssignedEquipmentOptions([]);
      setAssignedEquipmentLoading(false);
      setAssignedEquipmentError(null);
      return;
    }
    let cancelled = false;
    setAssignedEquipmentLoading(true);
    setAssignedEquipmentError(null);
    listAdminPhotographerEquipments({ photographer_id: String(initialDataId) })
      .then((items) => {
        if (!cancelled) {
          setAssignedEquipmentOptions(items);
        }
      })
      .catch((error) => {
        console.error("Failed to load assigned equipment", error);
        if (!cancelled) {
          setAssignedEquipmentOptions([]);
          setAssignedEquipmentError("Unable to load assigned equipment. Please try again.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAssignedEquipmentLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentRole, initialDataId, open]);
  const refreshPhotographerEquipment = async () => {
    if (!initialDataId) {
      return;
    }
    const [assigned, all] = await Promise.all([
      listAdminPhotographerEquipments({ photographer_id: String(initialDataId) }),
      listAdminPhotographerEquipments(),
    ]);
    setAssignedEquipmentOptions(assigned);
    setExistingEquipmentOptions(all.filter((item) => !item.photographer_id));
  };
  const handleSaveAccountEquipment = async () => {
    if (!initialDataId) {
      return;
    }
    if (selectedExistingEquipmentIds.length === 0 && activeEquipmentRows.length === 0) {
      toast({
        title: "No equipment selected",
        description: "Choose existing equipment or add a manual equipment row first.",
        variant: "destructive",
      });
      return;
    }
    setEquipmentSaving(true);
    try {
      await Promise.all(selectedExistingEquipmentIds.map((id) =>
        updateAdminPhotographerEquipment(Number(id), {
          photographer_id: String(initialDataId),
        })
      ));
      for (const row of activeEquipmentRows) {
        await createAdminPhotographerEquipment({
          photographer_id: String(initialDataId),
          name: row.name.trim(),
          serial_number: row.serialNumber.trim(),
          issue_date: row.issueDate,
          photos: row.photos,
        });
      }
      setEquipmentRows([]);
      setSelectedExistingEquipmentIds([]);
      setEquipmentManageOpen(false);
      await refreshPhotographerEquipment();
      toast({ title: "Equipment updated", description: "Assigned equipment is now visible to the photographer." });
    } catch (error: unknown) {
      console.error("Failed to update photographer equipment", error);
      toast({
        title: "Equipment update failed",
        description: getRequestErrorMessage(error, "Please check the equipment details and try again."),
        variant: "destructive",
      });
    } finally {
      setEquipmentSaving(false);
    }
  };
  const openEquipmentEdit = (equipment: PhotographerEquipment) => {
    setEditingEquipmentId(equipment.id);
    setEquipmentEditValues({
      name: equipment.name,
      serialNumber: equipment.serial_number || "",
      issueDate: equipment.issue_date || "",
    });
  };
  const saveEquipmentEdit = async (equipmentId: number) => {
    if (!equipmentEditValues.name.trim()) {
      toast({
        title: "Equipment name required",
        description: "Enter an equipment name before saving.",
        variant: "destructive",
      });
      return;
    }
    setEquipmentSaving(true);
    try {
      await updateAdminPhotographerEquipment(equipmentId, {
        name: equipmentEditValues.name.trim(),
        serial_number: equipmentEditValues.serialNumber.trim(),
        issue_date: equipmentEditValues.issueDate,
      });
      setEditingEquipmentId(null);
      await refreshPhotographerEquipment();
      toast({ title: "Equipment saved", description: "Equipment details were updated." });
    } catch (error: unknown) {
      console.error("Failed to save equipment details", error);
      toast({
        title: "Could not save equipment",
        description: getRequestErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setEquipmentSaving(false);
    }
  };
  return {
    equipmentRows,
    setEquipmentRows,
    existingEquipmentOptions,
    assignedEquipmentOptions,
    setAssignedEquipmentOptions,
    assignedEquipmentLoading,
    assignedEquipmentError,
    setAssignedEquipmentError,
    selectedExistingEquipmentIds,
    setSelectedExistingEquipmentIds,
    equipmentManageOpen,
    setEquipmentManageOpen,
    equipmentSaving,
    editingEquipmentId,
    setEditingEquipmentId,
    equipmentEditValues,
    setEquipmentEditValues,
    updateEquipmentRow,
    addEquipmentRow,
    removeEquipmentRow,
    activeEquipmentRows,
    handleSaveAccountEquipment,
    openEquipmentEdit,
    saveEquipmentEdit,
  };
};
