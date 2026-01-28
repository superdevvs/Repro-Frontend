import { API_BASE_URL } from '@/config/env';

export interface RawPreviewResult {
  success: boolean;
  previewUrl?: string;
  previewPath?: string;
  filename?: string;
  width?: number;
  height?: number;
  size?: number;
  message?: string;
  error?: string;
}

export interface RawPreviewCheckResult {
  success: boolean;
  exists: boolean;
  previewUrl?: string | null;
}

export interface BatchPreviewResult {
  success: boolean;
  results?: Record<string, RawPreviewResult | null>;
  queued_count?: number;
  message?: string;
}

const RAW_EXTENSIONS = ['cr2', 'cr3', 'nef', 'arw', 'dng', 'orf', 'raf', 'rw2', 'pef', 'srw', 'x3f'];

/**
 * Check if a file is a RAW image based on extension
 */
export const isRawFile = (filename: string): boolean => {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  return RAW_EXTENSIONS.includes(extension);
};

/**
 * Get supported RAW formats
 */
export const getSupportedRawFormats = (): string[] => {
  return [...RAW_EXTENSIONS];
};

/**
 * Generate preview for a single RAW file (synchronous)
 */
export const generateRawPreview = async (
  filePath: string,
  outputName?: string,
  token?: string
): Promise<RawPreviewResult> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/raw-preview/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        file_path: filePath,
        output_name: outputName,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to generate RAW preview:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Queue preview generation (asynchronous)
 */
export const generateRawPreviewAsync = async (
  filePath: string,
  outputName?: string,
  callbackUrl?: string,
  token?: string
): Promise<RawPreviewResult> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/raw-preview/generate-async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        file_path: filePath,
        output_name: outputName,
        callback_url: callbackUrl,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to queue RAW preview:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Generate previews for multiple RAW files
 */
export const generateBatchPreviews = async (
  filePaths: string[],
  async: boolean = true,
  token?: string
): Promise<BatchPreviewResult> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/raw-preview/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        file_paths: filePaths,
        async,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to generate batch previews:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Check if preview exists for a file
 */
export const checkRawPreview = async (
  filename: string,
  token?: string
): Promise<RawPreviewCheckResult> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/raw-preview/check?filename=${encodeURIComponent(filename)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to check RAW preview:', error);
    return {
      success: false,
      exists: false,
    };
  }
};

/**
 * Delete a preview
 */
export const deleteRawPreview = async (
  filename: string,
  token?: string
): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/raw-preview/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ filename }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to delete RAW preview:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Get preview URL for a file, generating if needed
 */
export const getOrGeneratePreview = async (
  filePath: string,
  filename: string,
  token?: string
): Promise<string | null> => {
  // First check if preview exists
  const checkResult = await checkRawPreview(filename, token);
  
  if (checkResult.exists && checkResult.previewUrl) {
    return checkResult.previewUrl;
  }

  // Generate preview
  const generateResult = await generateRawPreview(filePath, undefined, token);
  
  if (generateResult.success && generateResult.previewUrl) {
    return generateResult.previewUrl;
  }

  return null;
};
