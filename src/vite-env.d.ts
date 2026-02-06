/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SQUARE_APPLICATION_ID?: string;
  readonly VITE_SQUARE_LOCATION_ID?: string;
  readonly VITE_REALTIME_ENABLED?: string;
  readonly VITE_PUSHER_APP_KEY?: string;
  readonly VITE_PUSHER_APP_CLUSTER?: string;
  readonly VITE_PUSHER_HOST?: string;
  readonly VITE_PUSHER_PORT?: string;
  readonly VITE_PUSHER_SCHEME?: string;
  readonly VITE_PUSHER_AUTH_ENDPOINT?: string;
  readonly VITE_COMPANY_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
