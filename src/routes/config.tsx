import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import {
  Upload,
  FileJson,
  Check,
  AlertCircle,
  Loader2,
  Network,
  Variable,
  Wrench,
  Download,
  Cloud,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Settings2,
  Search,
  Bot
} from 'lucide-react';
import { fetchBotConfiguration, isApiConfigured, getApiConfig, searchBots, type BotMetadata } from '@/services/sarvamApi';
import { StateGraphFlow } from '@/components/StateGraphFlow';
import { renderPromptMarkdown } from '@/lib/promptMarkdown';
import type { BotConfiguration, BotState } from '@/types';

function ConfigPage() {
  const { isAuthenticated, user } = useAuthStore();
  const { botConfig, setBotConfig, apiConfig, setApiConfig } = useConfigStore();
  const [jsonInput, setJsonInput] = useState('');
  const [appIdInput, setAppIdInput] = useState('');
  const [versionInput, setVersionInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [expandedStates, setExpandedStates] = useState<Set<string>>(new Set());

  // Bot search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BotMetadata[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cache for pre-fetched bots
  const [cachedBots, setCachedBots] = useState<BotMetadata[]>([]);
  const [isCacheLoaded, setIsCacheLoaded] = useState(false);

  // Pre-fetch user's bots on component mount
  useEffect(() => {
    const prefetchBots = async () => {
      if (!isApiConfigured() || !user?.email) return;

      try {
        const result = await searchBots({
          email: user.email,
          limit: 50, // Fetch up to 50 bots for caching
        });
        setCachedBots(result.items || []);
        setIsCacheLoaded(true);
      } catch (err) {
        console.error('Failed to prefetch bots:', err);
      }
    };

    prefetchBots();
  }, [user?.email]);

  // Fuzzy search function for local filtering
  const fuzzyMatch = useCallback((text: string, query: string): boolean => {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Simple fuzzy match - check if all characters appear in order
    let queryIndex = 0;
    for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
      if (lowerText[i] === lowerQuery[queryIndex]) {
        queryIndex++;
      }
    }
    return queryIndex === lowerQuery.length;
  }, []);

  // Debounced search function - uses cache first, then API
  const debouncedSearch = useCallback((query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setShowSearchResults(true);

    // Instantly filter from cache for immediate feedback
    if (isCacheLoaded && cachedBots.length > 0) {
      const localResults = cachedBots.filter(bot =>
        fuzzyMatch(bot.app_name, query) ||
        fuzzyMatch(bot.app_id, query)
      );
      setSearchResults(localResults);
      setIsSearching(false);
      return;
    }

    // Fallback to API if cache not ready
    setIsSearching(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await searchBots({
          search: query.trim(),
          email: user?.email,
        });
        setSearchResults(result.items || []);
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce
  }, [user?.email, isCacheLoaded, cachedBots, fuzzyMatch]);

  // Handle search input change with debounce
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    debouncedSearch(value);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Close dropdown on click outside
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside both the input and the dropdown
      const isOutsideInput = searchInputRef.current && !searchInputRef.current.contains(event.target as Node);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(event.target as Node);

      if (isOutsideInput && isOutsideDropdown) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleStateExpanded = (stateName: string) => {
    setExpandedStates((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stateName)) {
        newSet.delete(stateName);
      } else {
        newSet.add(stateName);
      }
      return newSet;
    });
  };

  const expandAllStates = () => {
    const allStates = Object.keys(botConfig?.llm_config?.agent_config?.states || {});
    setExpandedStates(new Set(allStates));
  };

  const collapseAllStates = () => {
    setExpandedStates(new Set());
  };

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        setJsonInput(content);
        parseAndSetConfig(content);
      } catch {
        setError('Failed to read file');
      }
    };
    reader.readAsText(file);
  };

  const parseAndSetConfig = (content: string) => {
    setError(null);
    setIsLoading(true);

    try {
      // Handle case where file contains URL on first line
      const lines = content.trim().split('\n');
      let jsonContent = content;

      if (lines[0].startsWith('http')) {
        jsonContent = lines.slice(1).join('\n');
      }

      const config = JSON.parse(jsonContent) as BotConfiguration;

      // Validate required fields
      if (!config.llm_config?.agent_config?.states) {
        throw new Error('Invalid bot configuration: missing states');
      }

      setBotConfig(config);

      // Auto-set API config from bot config
      if (config.org_id && config.workspace_id && config.app_id) {
        setApiConfig({
          apiKey: import.meta.env.VITE_SARVAM_API_TOKEN || '',
          orgId: config.org_id,
          workspaceId: config.workspace_id,
          baseUrl: import.meta.env.VITE_SARVAM_BASE_URL || 'https://apps.sarvam.ai/api',
        });
      }

      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse JSON');
      setIsLoading(false);
    }
  };

  const handlePasteJson = () => {
    if (jsonInput.trim()) {
      parseAndSetConfig(jsonInput);
    }
  };

  const [loadingBotId, setLoadingBotId] = useState<string | null>(null);

  const handleSelectBot = async (bot: BotMetadata) => {
    setAppIdInput(bot.app_id);
    setShowSearchResults(false);
    setSearchQuery('');
    setLoadingBotId(bot.app_id);

    // Auto-fetch the selected bot
    setError(null);
    setIsFetching(true);

    try {
      const config = await fetchBotConfiguration({
        appId: bot.app_id,
      });

      setBotConfig(config);

      if (config.org_id && config.workspace_id && config.app_id) {
        setApiConfig({
          apiKey: import.meta.env.VITE_SARVAM_API_TOKEN || '',
          orgId: config.org_id,
          workspaceId: config.workspace_id,
          baseUrl: import.meta.env.VITE_SARVAM_BASE_URL || 'https://apps.sarvam.ai/api',
        });
      }

      setIsFetching(false);
      setLoadingBotId(null);

      // Scroll to config summary after loading
      setTimeout(() => {
        document.getElementById('config-summary')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch configuration');
      setIsFetching(false);
      setLoadingBotId(null);
    }
  };

  const handleFetchByAppId = async () => {
    if (!appIdInput.trim()) return;

    setError(null);
    setIsFetching(true);

    try {
      const config = await fetchBotConfiguration({
        appId: appIdInput.trim(),
        version: versionInput ? parseInt(versionInput, 10) : undefined,
      });

      setBotConfig(config);

      // Auto-set API config from fetched bot config
      if (config.org_id && config.workspace_id && config.app_id) {
        setApiConfig({
          apiKey: import.meta.env.VITE_SARVAM_API_TOKEN || '',
          orgId: config.org_id,
          workspaceId: config.workspace_id,
          baseUrl: import.meta.env.VITE_SARVAM_BASE_URL || 'https://apps.sarvam.ai/api',
        });
      }

      setIsFetching(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch configuration');
      setIsFetching(false);
    }
  };

  const statesCount = botConfig
    ? Object.keys(botConfig.llm_config?.agent_config?.states || {}).length
    : 0;

  const toolsCount = botConfig
    ? new Set(
        Object.values(botConfig.llm_config?.agent_config?.states || {})
          .flatMap((s) => (s as BotState).tool_names)
      ).size
    : 0;

  const variablesCount = botConfig
    ? Object.keys(botConfig.llm_config?.agent_config?.agent_variables || {}).length
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bot Configuration</h1>
        <p className="text-muted-foreground">
          Load and manage your bot configuration for testing
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Fetch from API Section */}
      {isApiConfigured() && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-primary" />
              <h2 className="card-title text-lg">Fetch from Sarvam API</h2>
            </div>
            <p className="card-description">
              Search for your bots or enter the App ID directly
            </p>
          </div>
          <div className="card-content space-y-4">
            {/* Bot Search with Fuzzy Search & Debounce */}
            <div className="relative">
              <label className="block text-sm font-medium mb-2">
                Search Your Bots
                <span className="ml-2 text-xs text-muted-foreground font-normal">(fuzzy search with debounce)</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="input w-full"
                  style={{ paddingLeft: '2.5rem', paddingRight: isSearching ? '2.5rem' : '0.75rem' }}
                  placeholder="Start typing to search bots..."
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                  onFocus={() => searchQuery && setShowSearchResults(true)}
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
                )}
                {isCacheLoaded && !isSearching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {cachedBots.length} cached
                  </span>
                )}
              </div>

              {/* Live Search Results Dropdown */}
              {showSearchResults && (
                <div ref={dropdownRef} className="absolute z-10 w-full mt-1 bg-card border-2 border-foreground shadow-brutal max-h-72 overflow-y-auto">
                  {isSearching ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                      <p className="text-sm">Searching...</p>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No bots found matching "{searchQuery}"</p>
                    </div>
                  ) : (
                    <>
                      <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/50 border-b border-foreground/10">
                        Found {searchResults.length} bot{searchResults.length !== 1 ? 's' : ''}
                      </div>
                      {searchResults.map((bot) => (
                        <button
                          key={bot.app_id}
                          className={`w-full p-3 text-left hover:bg-accent transition-colors border-b border-foreground/10 last:border-b-0 group ${loadingBotId === bot.app_id ? 'bg-accent/50' : ''}`}
                          onClick={() => handleSelectBot(bot)}
                          disabled={loadingBotId !== null}
                        >
                          <div className="flex items-center gap-3">
                            {loadingBotId === bot.app_id ? (
                              <Loader2 className="h-5 w-5 text-primary animate-spin" />
                            ) : (
                              <Bot className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{bot.app_name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {bot.app_id} • v{bot.app_version} • {bot.channel_type}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className={`badge-${bot.status === 'committed' ? 'success' : 'warning'} text-xs`}>
                                {bot.status}
                              </span>
                              {bot.is_deployed && (
                                <span className="badge-default text-xs">deployed</span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="relative flex items-center gap-4">
              <div className="flex-1 border-t border-foreground/20"></div>
              <span className="text-xs text-muted-foreground">or enter App ID directly</span>
              <div className="flex-1 border-t border-foreground/20"></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  App ID <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Restaurant--2346c23a-3842"
                  value={appIdInput}
                  onChange={(e) => setAppIdInput(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Version (optional)
                </label>
                <input
                  type="number"
                  className="input"
                  placeholder="Latest"
                  value={versionInput}
                  onChange={(e) => setVersionInput(e.target.value)}
                />
              </div>
            </div>

            <div className="text-xs text-muted-foreground p-2 rounded bg-muted/50">
              <p>Org: {getApiConfig().orgId} | Workspace: {getApiConfig().workspaceId}</p>
            </div>

            <button
              className="btn-primary w-full"
              onClick={handleFetchByAppId}
              disabled={!appIdInput.trim() || isFetching}
            >
              {isFetching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Fetch Configuration
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title text-lg">Load from File/JSON</h2>
            <p className="card-description">
              Upload a JSON file or paste the configuration
            </p>
          </div>
          <div className="card-content space-y-4">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Upload JSON File
              </label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">JSON file</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".json,.md"
                  onChange={handleFileUpload}
                />
              </label>
            </div>

            {/* JSON Textarea */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Or paste JSON directly
              </label>
              <textarea
                className="input min-h-[200px] font-mono text-sm"
                placeholder="Paste your bot configuration JSON here..."
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
              />
            </div>

            <button
              className="btn-primary w-full"
              onClick={handlePasteJson}
              disabled={!jsonInput.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <FileJson className="h-4 w-4" />
                  Load Configuration
                </>
              )}
            </button>
          </div>
        </div>

        {/* Config Summary */}
        <div id="config-summary" className="card scroll-mt-6">
          <div className="card-header">
            <h2 className="card-title text-lg">Configuration Summary</h2>
            <p className="card-description">
              {botConfig ? 'Current loaded configuration' : 'No configuration loaded'}
            </p>
          </div>
          <div className="card-content">
            {botConfig ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 text-success">
                  <Check className="h-4 w-4" />
                  <span className="text-sm font-medium">Configuration loaded successfully</span>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm">Bot Name</span>
                    <span className="font-medium">{botConfig.app_name}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm">Version</span>
                    <span className="font-medium">{botConfig.app_version}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm">Channel Type</span>
                    <span className="badge-secondary">{botConfig.channel_type}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm">Status</span>
                    <span className={`badge-${botConfig.status === 'published' ? 'success' : 'warning'}`}>
                      {botConfig.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <Network className="h-5 w-5 mx-auto mb-2 text-primary" />
                    <p className="text-2xl font-bold">{statesCount}</p>
                    <p className="text-xs text-muted-foreground">States</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <Wrench className="h-5 w-5 mx-auto mb-2 text-primary" />
                    <p className="text-2xl font-bold">{toolsCount}</p>
                    <p className="text-xs text-muted-foreground">Tools</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <Variable className="h-5 w-5 mx-auto mb-2 text-primary" />
                    <p className="text-2xl font-bold">{variablesCount}</p>
                    <p className="text-xs text-muted-foreground">Variables</p>
                  </div>
                </div>

                <div className="pt-4">
                  <h3 className="font-medium mb-2">Supported Languages</h3>
                  <div className="flex flex-wrap gap-2">
                    {botConfig.llm_config?.agent_config?.supported_languages?.map((lang) => (
                      <span key={lang} className="badge-outline">{lang}</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileJson className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Upload or paste a bot configuration to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* State Graph Flow Visualization - PRIMARY VIEW */}
      {botConfig && (
        <div className="card border-2 border-primary">
          <div className="card-header bg-primary/5">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-primary" />
              <h2 className="card-title text-lg">State Flow Graph</h2>
            </div>
            <p className="card-description">
              Click on any node to expand and see prompt, variables, and tools. Drag to reposition.
            </p>
          </div>
          <div className="card-content p-0">
            <StateGraphFlow
              states={botConfig.llm_config?.agent_config?.states || {}}
              initialStateName={botConfig.llm_config?.agent_config?.initial_state_name || ''}
            />
          </div>
        </div>
      )}

      {/* Global Prompt */}
      {botConfig?.llm_config?.agent_config?.global_prompt && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              <h2 className="card-title text-lg">Global Prompt</h2>
            </div>
            <p className="card-description">System-wide instructions for the bot</p>
          </div>
          <div className="card-content">
            <div className="text-sm bg-muted/50 p-4 rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto leading-relaxed">
              {renderPromptMarkdown(botConfig.llm_config.agent_config.global_prompt)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute('/config')({
  component: ConfigPage,
});
