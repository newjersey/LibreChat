import { removeNullishValues } from 'librechat-data-provider';
import type { TCustomConfig, TConfigDefaults } from 'librechat-data-provider';
import type { AppConfig } from '~/types/app';
import { isMemoryEnabled } from './memory';

/**
 * Loads the default interface object.
 * @param params - The loaded custom configuration.
 * @param params.config - The loaded custom configuration.
 * @param params.configDefaults - The custom configuration default values.
 * @returns default interface object.
 */
export async function loadDefaultInterface({
  config,
  configDefaults,
}: {
  config?: Partial<TCustomConfig>;
  configDefaults: TConfigDefaults;
}): Promise<AppConfig['interfaceConfig']> {
  const { interface: interfaceConfig } = config ?? {};
  const { interface: defaults } = configDefaults;
  const hasModelSpecs = (config?.modelSpecs?.list?.length ?? 0) > 0;
  const includesAddedEndpoints = (config?.modelSpecs?.addedEndpoints?.length ?? 0) > 0;

  const memoryConfig = config?.memory;
  const memoryEnabled = isMemoryEnabled(memoryConfig);
  /** Only disable memories if memory config is present but disabled/invalid */
  const shouldDisableMemories = memoryConfig && !memoryEnabled;

  // Environment variable helper for permissions
  const getEnvBoolean = (envVar: string): boolean | undefined => {
    const value = process.env[envVar];
    if (value === undefined) return undefined;
    return value.toLowerCase().trim() === 'true';
  };

  const loadedInterface: AppConfig['interfaceConfig'] = removeNullishValues({
    // UI elements - use schema defaults
    modelSelect:
      interfaceConfig?.modelSelect ??
      (hasModelSpecs ? includesAddedEndpoints : defaults.modelSelect),
    parameters: interfaceConfig?.parameters ?? (hasModelSpecs ? false : defaults.parameters),
    presets: interfaceConfig?.presets ?? (hasModelSpecs ? false : defaults.presets),
    privacyPolicy: interfaceConfig?.privacyPolicy ?? defaults.privacyPolicy,
    termsOfService: interfaceConfig?.termsOfService ?? defaults.termsOfService,
    mcpServers: interfaceConfig?.mcpServers ?? defaults.mcpServers,
    customWelcome: interfaceConfig?.customWelcome ?? defaults.customWelcome,

    // Permissions - environment variables override YAML config
    bookmarks: getEnvBoolean('INTERFACE_BOOKMARKS') ?? interfaceConfig?.bookmarks,
    memories: shouldDisableMemories ? false : interfaceConfig?.memories,
    prompts: getEnvBoolean('INTERFACE_PROMPTS') ?? interfaceConfig?.prompts,
    multiConvo: getEnvBoolean('INTERFACE_MULTI_CONVO') ?? interfaceConfig?.multiConvo,
    agents: getEnvBoolean('INTERFACE_AGENTS') ?? interfaceConfig?.agents,
    temporaryChat: getEnvBoolean('INTERFACE_TEMPORARY_CHAT') ?? interfaceConfig?.temporaryChat,
    runCode: getEnvBoolean('INTERFACE_RUN_CODE') ?? interfaceConfig?.runCode,
    webSearch: getEnvBoolean('INTERFACE_WEB_SEARCH') ?? interfaceConfig?.webSearch,
    fileSearch: getEnvBoolean('INTERFACE_FILE_SEARCH') ?? interfaceConfig?.fileSearch,
    fileCitations: getEnvBoolean('INTERFACE_FILE_CITATIONS') ?? interfaceConfig?.fileCitations,
    peoplePicker: interfaceConfig?.peoplePicker,
    marketplace: interfaceConfig?.marketplace,
    remoteAgents: interfaceConfig?.remoteAgents,
  });

  return loadedInterface;
}
