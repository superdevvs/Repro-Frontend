import API_ROUTES from '@/lib/api';
import {
  getEditorRatePayload,
  getEditorRatesData,
  type EditorRatesData,
  type EditorServiceRate,
} from '@/utils/editorRates';

const getAuthToken = () =>
  localStorage.getItem('authToken') ||
  localStorage.getItem('token') ||
  localStorage.getItem('access_token');

const getJsonHeaders = () => {
  const token = getAuthToken();

  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const parseErrorMessage = async (response: Response, fallbackMessage: string) => {
  const payload = await response.json().catch(() => null);
  return payload?.message || payload?.error || fallbackMessage;
};

export const fetchEditorRates = async (editorId: string): Promise<EditorRatesData> => {
  const response = await fetch(API_ROUTES.editors.rates(editorId), {
    headers: getJsonHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to load editor rates.'));
  }

  const payload = await response.json().catch(() => null);
  return getEditorRatesData(payload?.data ?? {});
};

export const updateEditorRates = async (
  editorId: string,
  rates: EditorServiceRate[],
): Promise<EditorRatesData> => {
  const response = await fetch(API_ROUTES.editors.rates(editorId), {
    method: 'PUT',
    headers: getJsonHeaders(),
    body: JSON.stringify(getEditorRatePayload(rates)),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to save editor rates.'));
  }

  const payload = await response.json().catch(() => null);
  return getEditorRatesData(payload?.data ?? {});
};
