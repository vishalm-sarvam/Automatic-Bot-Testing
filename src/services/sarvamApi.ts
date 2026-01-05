import type { BotConfiguration } from '@/types';

// Use proxy in development to avoid CORS issues
const BASE_URL = import.meta.env.DEV
  ? '/api/sarvam'
  : (import.meta.env.VITE_SARVAM_BASE_URL || 'https://apps.sarvam.ai/api');
const ORG_ID = import.meta.env.VITE_SARVAM_ORG_ID || 'sarvamai';
const WORKSPACE_ID = import.meta.env.VITE_SARVAM_WORKSPACE_ID || 'default';

// Bearer JWT token for Sarvam app-authoring API (from Google authentication)
const BEARER_TOKEN = import.meta.env.VITE_SARVAM_BEARER_TOKEN || '';

function getAuthToken(): string {
  return BEARER_TOKEN;
}

interface FetchBotConfigOptions {
  appId: string;
  version?: number;
  orgId?: string;
  workspaceId?: string;
}

export async function fetchBotConfiguration(options: FetchBotConfigOptions): Promise<BotConfiguration> {
  const {
    appId,
    version,
    orgId = ORG_ID,
    workspaceId = WORKSPACE_ID,
  } = options;

  const params = new URLSearchParams();
  if (version) {
    params.append('app_version', version.toString());
    params.append('version_filter', 'specific');
  }
  params.append('with_deployment_status', 'true');
  params.append('legacy', 'false');

  const url = `${BASE_URL}/app-authoring/orgs/${orgId}/workspaces/${workspaceId}/apps/${appId}?${params}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch bot configuration: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export interface BotMetadata {
  org_id: string;
  workspace_id: string;
  app_id: string;
  app_name: string;
  app_version: number;
  app_version_description: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  status: 'committed' | 'draft';
  channel_type: string;
  channel_provider: string;
  is_deployed: boolean;
  is_single_prompt_mode: boolean;
  config_version: string;
}

export interface BotSearchResult {
  items: BotMetadata[];
  total: number;
  offset: number;
  limit: number;
  next_page_uri: string | null;
  prev_page_uri: string | null;
}

interface SearchBotsOptions {
  email?: string;
  search?: string;
  offset?: number;
  limit?: number;
  orgId?: string;
  workspaceId?: string;
}

export async function searchBots(options: SearchBotsOptions = {}): Promise<BotSearchResult> {
  const {
    email,
    search,
    offset = 0,
    limit = 20,
    orgId = ORG_ID,
    workspaceId = WORKSPACE_ID,
  } = options;

  const params = new URLSearchParams();
  params.append('committed_apps_only', 'false');
  params.append('legacy', 'false');
  params.append('offset', offset.toString());
  params.append('limit', limit.toString());

  if (email) {
    params.append('created_by', email);
  }
  if (search) {
    params.append('search', search);
  }

  const url = `${BASE_URL}/app-authoring/orgs/${orgId}/workspaces/${workspaceId}/apps-metadata?${params}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to search bots: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export async function listBotApps(orgId = ORG_ID, workspaceId = WORKSPACE_ID): Promise<BotConfiguration[]> {
  const url = `${BASE_URL}/app-authoring/orgs/${orgId}/workspaces/${workspaceId}/apps`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list bot apps: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export function isApiConfigured(): boolean {
  return Boolean(getAuthToken());
}

export function getApiConfig() {
  return {
    baseUrl: BASE_URL,
    orgId: ORG_ID,
    workspaceId: WORKSPACE_ID,
    hasToken: Boolean(getAuthToken()),
  };
}
