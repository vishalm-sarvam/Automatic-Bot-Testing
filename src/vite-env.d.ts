/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_SARVAM_API_KEY: string;
  readonly VITE_SARVAM_ORG_ID: string;
  readonly VITE_SARVAM_WORKSPACE_ID: string;
  readonly VITE_SARVAM_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
