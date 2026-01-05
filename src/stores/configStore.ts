import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ApiConfig, BotConfiguration } from '@/types';

// Always get the fresh API token from environment
const SARVAM_API_TOKEN = import.meta.env.VITE_SARVAM_API_TOKEN || '';

interface ConfigStore {
  apiConfig: ApiConfig | null;
  botConfig: BotConfiguration | null;
  setApiConfig: (config: ApiConfig) => void;
  setBotConfig: (config: BotConfiguration) => void;
  clearConfig: () => void;
  getApiConfigWithFreshToken: () => ApiConfig | null;
}

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set, get) => ({
      apiConfig: null,
      botConfig: null,

      setApiConfig: (apiConfig: ApiConfig) => set({ apiConfig }),

      setBotConfig: (botConfig: BotConfiguration) => set({ botConfig }),

      clearConfig: () => set({ apiConfig: null, botConfig: null }),

      // Always use the fresh token from environment
      getApiConfigWithFreshToken: () => {
        const config = get().apiConfig;
        if (!config) return null;
        return {
          ...config,
          apiKey: SARVAM_API_TOKEN,
        };
      },
    }),
    {
      name: 'config-storage',
      partialize: (state) => ({
        // Only persist org/workspace, not the API key
        apiConfig: state.apiConfig ? {
          orgId: state.apiConfig.orgId,
          workspaceId: state.apiConfig.workspaceId,
          baseUrl: state.apiConfig.baseUrl,
          apiKey: '', // Don't persist the API key
        } : null,
      }),
    }
  )
);
