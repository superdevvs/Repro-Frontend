import { apiClient } from "@/services/api";

export type EquipmentStatus = "pending_verification" | "submitted" | "verified" | "rejected";

export type PhotographerEquipmentPhoto = {
  id: number;
  equipment_id: number;
  type: "admin_reference" | "photographer_verification";
  original_name?: string | null;
  mime_type?: string | null;
  size?: number | null;
  created_at?: string | null;
  url: string;
};

export type PhotographerEquipment = {
  id: number;
  photographer_id: number;
  photographer?: {
    id: number;
    name: string;
    email: string;
  } | null;
  name: string;
  serial_number?: string | null;
  issue_date?: string | null;
  status: EquipmentStatus;
  verification_requested_at?: string | null;
  submitted_at?: string | null;
  verified_at?: string | null;
  rejected_at?: string | null;
  verified_by?: {
    id: number;
    name: string;
    email: string;
  } | null;
  rejection_reason?: string | null;
  photos: PhotographerEquipmentPhoto[];
  created_at?: string | null;
  updated_at?: string | null;
};

type EquipmentListResponse = {
  data: PhotographerEquipment[];
};

const appendPhotos = (formData: FormData, photos?: File[]) => {
  (photos || []).forEach((photo) => formData.append("photos[]", photo));
};

const multipartConfig = {
  headers: { "Content-Type": "multipart/form-data" },
};

export const equipmentStatusLabel = (status: EquipmentStatus) => {
  switch (status) {
    case "pending_verification":
      return "Pending Verification";
    case "submitted":
      return "Submitted";
    case "verified":
      return "Verified";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
};

export const listAdminPhotographerEquipments = async (filters?: {
  photographer_id?: string;
  status?: string;
  search?: string;
}) => {
  const response = await apiClient.get<EquipmentListResponse>("/admin/photographer-equipments", {
    params: filters,
  });
  return response.data.data;
};

export const createAdminPhotographerEquipment = async (payload: {
  photographer_id: string;
  name: string;
  serial_number?: string;
  issue_date?: string;
  photos?: File[];
}) => {
  const formData = new FormData();
  formData.append("photographer_id", payload.photographer_id);
  formData.append("name", payload.name);
  if (payload.serial_number) formData.append("serial_number", payload.serial_number);
  if (payload.issue_date) formData.append("issue_date", payload.issue_date);
  appendPhotos(formData, payload.photos);

  const response = await apiClient.post<{ data: PhotographerEquipment }>(
    "/admin/photographer-equipments",
    formData,
    multipartConfig,
  );
  return response.data.data;
};

export const updateAdminPhotographerEquipment = async (
  equipmentId: number,
  payload: Partial<Pick<PhotographerEquipment, "name" | "serial_number" | "issue_date" | "status">> & { photographer_id?: string },
) => {
  const response = await apiClient.put<{ data: PhotographerEquipment }>(
    `/admin/photographer-equipments/${equipmentId}`,
    payload,
  );
  return response.data.data;
};

export const deleteAdminPhotographerEquipment = async (equipmentId: number) => {
  await apiClient.delete(`/admin/photographer-equipments/${equipmentId}`);
};

export const uploadAdminEquipmentPhotos = async (equipmentId: number, photos: File[]) => {
  const formData = new FormData();
  appendPhotos(formData, photos);
  const response = await apiClient.post<{ data: PhotographerEquipment }>(
    `/admin/photographer-equipments/${equipmentId}/photos`,
    formData,
    multipartConfig,
  );
  return response.data.data;
};

export const approvePhotographerEquipment = async (equipmentId: number) => {
  const response = await apiClient.post<{ data: PhotographerEquipment }>(
    `/admin/photographer-equipments/${equipmentId}/approve`,
  );
  return response.data.data;
};

export const rejectPhotographerEquipment = async (equipmentId: number, rejection_reason?: string) => {
  const response = await apiClient.post<{ data: PhotographerEquipment }>(
    `/admin/photographer-equipments/${equipmentId}/reject`,
    { rejection_reason },
  );
  return response.data.data;
};

export const sendPhotographerEquipmentVerificationEmail = async (equipmentId: number) => {
  const response = await apiClient.post<{ data: PhotographerEquipment }>(
    `/admin/photographer-equipments/${equipmentId}/send-verification-email`,
  );
  return response.data.data;
};

export const listMyPhotographerEquipments = async () => {
  const response = await apiClient.get<EquipmentListResponse>("/photographer/equipments");
  return response.data.data;
};

export const uploadPhotographerVerificationPhotos = async (equipmentId: number, photos: File[]) => {
  const formData = new FormData();
  appendPhotos(formData, photos);
  const response = await apiClient.post<{ data: PhotographerEquipment }>(
    `/photographer/equipments/${equipmentId}/verification-photos`,
    formData,
    multipartConfig,
  );
  return response.data.data;
};

export const openEquipmentPhoto = async (photo: PhotographerEquipmentPhoto) => {
  const response = await apiClient.get(photo.url.replace(/^\/api/, ""), { responseType: "blob" });
  const blobUrl = URL.createObjectURL(response.data);
  window.open(blobUrl, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
};
