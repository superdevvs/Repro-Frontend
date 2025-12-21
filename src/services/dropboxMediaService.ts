import axios from 'axios';
import { API_BASE_URL } from '@/config/env';

export interface DropboxMediaFile {
  id: string;
  name: string;
  path: string;
  size: number;
  modified: string | null;
  mime_type: string;
  thumbnail_link: string | null;
}

export interface DropboxMediaResponse {
  data: DropboxMediaFile[];
  counts: {
    raw_photo_count: number;
    edited_photo_count: number;
    extra_photo_count: number;
    expected_raw_count: number;
    expected_final_count: number;
    raw_missing_count: number;
    edited_missing_count: number;
    bracket_mode: number | null;
  };
}

export interface ZipDownloadResponse {
  type: 'redirect' | 'download';
  url?: string;
}

/**
 * Fetch media files for a shoot by type
 */
export const fetchShootMedia = async (
  shootId: string,
  type: 'raw' | 'edited' | 'extra',
  token: string
): Promise<DropboxMediaResponse> => {
  const response = await axios.get(`${API_BASE_URL}/api/shoots/${shootId}/media`, {
    params: { type },
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return response.data;
};

/**
 * Upload RAW photos with bracket mode
 */
export const uploadRawPhotos = async (
  shootId: string,
  files: File[],
  bracketMode: 3 | 5 | null,
  token: string,
  onProgress?: (progress: number) => void
): Promise<any> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files[]', file);
  });
  formData.append('upload_type', 'raw');
  if (bracketMode) {
    formData.append('bracket_mode', bracketMode.toString());
  }

  const response = await axios.post(
    `${API_BASE_URL}/api/shoots/${shootId}/upload`,
    formData,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    }
  );

  return response.data;
};

/**
 * Upload extra RAW photos
 */
export const uploadExtraPhotos = async (
  shootId: string,
  files: File[],
  token: string,
  onProgress?: (progress: number) => void
): Promise<any> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files[]', file);
  });

  const response = await axios.post(
    `${API_BASE_URL}/api/shoots/${shootId}/upload-extra`,
    formData,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    }
  );

  return response.data;
};

/**
 * Upload edited photos
 */
export const uploadEditedPhotos = async (
  shootId: string,
  files: File[],
  token: string,
  onProgress?: (progress: number) => void
): Promise<any> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files[]', file);
  });
  formData.append('upload_type', 'edited');

  const response = await axios.post(
    `${API_BASE_URL}/api/shoots/${shootId}/upload`,
    formData,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    }
  );

  return response.data;
};

/**
 * Download media as ZIP
 */
export const downloadMediaZip = async (
  shootId: string,
  type: 'raw' | 'edited',
  token: string
): Promise<ZipDownloadResponse> => {
  const response = await axios.get(
    `${API_BASE_URL}/api/shoots/${shootId}/media/download-zip`,
    {
      params: { type },
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
};

/**
 * Get temporary Dropbox link for a media file thumbnail
 */
export const getMediaThumbnail = async (
  shootId: string,
  fileId: string,
  token: string
): Promise<string | null> => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/shoots/${shootId}/media/${fileId}/download`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.url || null;
  } catch (error) {
    console.error('Failed to get media thumbnail:', error);
    return null;
  }
};

/**
 * Archive a shoot manually (admin only)
 */
export const archiveShoot = async (
  shootId: string,
  token: string
): Promise<any> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/shoots/${shootId}/archive`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
};

