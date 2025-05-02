import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { LanguageModelV1 } from 'ai';
import type { IProviderSetting } from '~/types/model';
import { createAnthropic } from '@ai-sdk/anthropic';

export default class ProxyProvider extends BaseProvider {
  name = 'Proxy';
  getApiKeyLink = 'https://console.anthropic.com/settings/keys';

  config = {
    apiTokenKey: 'ANTHROPIC_API_KEY',
  };

  // Using the same models as Anthropic
  staticModels: ModelInfo[] = [
    {
      name: 'claude-3-7-sonnet-20250219',
      label: 'Claude 3.7 Sonnet (Proxy)',
      provider: 'Proxy',
      maxTokenAllowed: 8000,
    },
    {
      name: 'claude-3-5-sonnet-latest',
      label: 'Claude 3.5 Sonnet (Proxy)',
      provider: 'Proxy',
      maxTokenAllowed: 8000,
    },
    {
      name: 'claude-3-5-sonnet-20240620',
      label: 'Claude 3.5 Sonnet (old) (Proxy)',
      provider: 'Proxy',
      maxTokenAllowed: 8000,
    },
    {
      name: 'claude-3-5-haiku-latest',
      label: 'Claude 3.5 Haiku (Proxy)',
      provider: 'Proxy',
      maxTokenAllowed: 8000,
    },
    { name: 'claude-3-opus-latest', label: 'Claude 3 Opus (Proxy)', provider: 'Proxy', maxTokenAllowed: 8000 },
    { name: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet (Proxy)', provider: 'Proxy', maxTokenAllowed: 8000 },
    { name: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Proxy)', provider: 'Proxy', maxTokenAllowed: 8000 },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    // We'll just return the static models for now
    return [];
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { apiKeys, providerSettings, serverEnv, model } = options;
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'ANTHROPIC_API_KEY',
    });

    // Create the Anthropic model with default settings
    const anthropic = createAnthropic({
      apiKey,
    });
    
    // Get the model instance
    return anthropic(model);
  }
}
