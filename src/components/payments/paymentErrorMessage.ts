import axios from 'axios';

export const getPaymentErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    if (typeof responseData === 'object' && responseData && 'errors' in responseData) {
      const validationErrors = responseData.errors;
      if (typeof validationErrors === 'object' && validationErrors) {
        for (const value of Object.values(validationErrors)) {
          if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
          if (typeof value === 'string') return value;
        }
      }
    }
    if (typeof responseData === 'object' && responseData && 'error' in responseData && typeof responseData.error === 'string') {
      return responseData.error;
    }
    if (typeof responseData === 'object' && responseData && 'message' in responseData && typeof responseData.message === 'string') {
      return responseData.message;
    }
    return error.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
};
