import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { streamText } from '~/lib/.server/llm/stream-text';
import type { IProviderSetting, ProviderInfo } from '~/types/model';
import { generateText } from 'ai';
import { PROVIDER_LIST } from '~/utils/constants';
import { MAX_TOKENS } from '~/lib/.server/llm/constants';
import { LLMManager } from '~/lib/modules/llm/manager';
import type { ModelInfo } from '~/lib/modules/llm/types';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';
import { createScopedLogger } from '~/utils/logger';

export async function action(args: ActionFunctionArgs) {
  return llmCallAction(args);
}

async function getModelList(options: {
  apiKeys?: Record<string, string>;
  providerSettings?: Record<string, IProviderSetting>;
  serverEnv?: Record<string, string>;
}) {
  const llmManager = LLMManager.getInstance(import.meta.env);
  return llmManager.updateModelList(options);
}

const logger = createScopedLogger('api.llmcall');

async function llmCallAction({ context, request }: ActionFunctionArgs) {
  const { system, message, model, provider, streamOutput } = await request.json<{
    system: string;
    message: string;
    model: string;
    provider: ProviderInfo;
    streamOutput?: boolean;
  }>();

  const { name: providerName } = provider;

  // validate 'model' and 'provider' fields
  if (!model || typeof model !== 'string') {
    throw new Response('Invalid or missing model', {
      status: 400,
      statusText: 'Bad Request',
    });
  }

  if (!providerName || typeof providerName !== 'string') {
    throw new Response('Invalid or missing provider', {
      status: 400,
      statusText: 'Bad Request',
    });
  }

  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = getApiKeysFromCookie(cookieHeader);
  const providerSettings = getProviderSettingsFromCookie(cookieHeader);

  if (streamOutput) {
    try {
      // Get auth token from request headers or cookies
      const authToken = request.headers.get('Authorization')?.replace('Bearer ', '') || '';

      logger.info(`Processing LLM call request for model: ${model}, provider: ${providerName}, streamOutput: true`);

      // Validate message content
      if (!message || typeof message !== 'string') {
        logger.error('Invalid message format', { message });
        throw new Response('Invalid or missing message content', {
          status: 400,
          statusText: 'Bad Request',
        });
      }

      // Create a dummy user profile with required properties
      const userProfile = {
        id: 'dummy-user-id',
        email: 'dummy@example.com',
        email_verified: true,
        created_at: new Date().toISOString(),
        subscription: {
          id: 'default-subscription-id',
          plan: {
            id: 'default-plan-id',
            name: 'Default Plan',
            monthly_fee: '0',
            premium_calls_quota: 1000,
            overage_rate: '0',
            context_window: 100000,
            team_support: false,
            description: 'Default plan for API calls',
          },
          status: 'active',
          start_date: new Date().toISOString(),
          end_date: null,
          next_billing_date: null,
          trial_expiration_date: null,
        },
      };

      logger.info('Calling streamText for LLM call');

      const stream = await streamText({
        messages: [
          {
            role: 'user',
            content: `${message}`,
          },
        ],
        env: context.cloudflare?.env as any,
        providerSettings,
        authToken,
        userProfile,
      });

      logger.info('Stream received successfully, returning response');

      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    } catch (error: unknown) {
      // Enhanced error logging
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error('Error in LLM call action (streaming):', {
        error: errorMessage,
        stack: errorStack,
        model,
        provider: providerName,
      });

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message?.includes('API key')) {
          logger.error('API key error', { message: error.message });
          return new Response('Invalid or missing API key', {
            status: 401,
            statusText: 'Unauthorized',
          });
        } else if (error.message?.includes('Authentication error')) {
          logger.error('Authentication error', { message: error.message });
          return new Response(error.message, {
            status: 401,
            statusText: 'Unauthorized',
          });
        } else if (error.message?.includes('Resource not found')) {
          logger.error('Resource not found', { message: error.message });
          return new Response(error.message, {
            status: 404,
            statusText: 'Not Found',
          });
        } else if (error.message?.includes('Server error')) {
          logger.error('Server error', { message: error.message });
          return new Response(error.message, {
            status: 502,
            statusText: 'Bad Gateway',
          });
        }
      }

      // Default error response with more details
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: errorMessage.substring(0, 200),
          requestId: new Date().getTime().toString(),
        }),
        {
          status: 500,
          statusText: 'Internal Server Error',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }
  } else {
    try {
      logger.info(`Processing LLM call request for model: ${model}, provider: ${providerName}, streamOutput: false`);

      // Validate message content
      if (!message || typeof message !== 'string') {
        logger.error('Invalid message format', { message });
        throw new Response('Invalid or missing message content', {
          status: 400,
          statusText: 'Bad Request',
        });
      }

      // Validate system prompt
      if (!system || typeof system !== 'string') {
        logger.error('Invalid system prompt format', { system });
        throw new Response('Invalid or missing system prompt', {
          status: 400,
          statusText: 'Bad Request',
        });
      }

      logger.info('Fetching model list');

      const models = await getModelList({ apiKeys, providerSettings, serverEnv: context.cloudflare?.env as any });
      const modelDetails = models.find((m: ModelInfo) => m.name === model);

      if (!modelDetails) {
        logger.error('Model not found', { model, availableModels: models.map((m) => m.name) });
        throw new Error(`Model "${model}" not found or not available`);
      }

      const dynamicMaxTokens = modelDetails && modelDetails.maxTokenAllowed ? modelDetails.maxTokenAllowed : MAX_TOKENS;

      const providerInfo = PROVIDER_LIST.find((p) => p.name === provider.name);

      if (!providerInfo) {
        logger.error('Provider not found', { providerName, availableProviders: PROVIDER_LIST.map((p) => p.name) });
        throw new Error(`Provider "${providerName}" not found or not available`);
      }

      logger.info(
        `Generating response with Provider: ${provider.name}, Model: ${modelDetails.name}, MaxTokens: ${dynamicMaxTokens}`,
      );

      const result = await generateText({
        system,
        messages: [
          {
            role: 'user',
            content: `${message}`,
          },
        ],
        model: providerInfo.getModelInstance({
          model: modelDetails.name,
          serverEnv: context.cloudflare?.env as any,
          apiKeys,
          providerSettings,
        }),
        maxTokens: dynamicMaxTokens,
        toolChoice: 'none',
      });

      logger.info(`Generated response successfully`);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error: unknown) {
      // Enhanced error logging
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error('Error in LLM call action (non-streaming):', {
        error: errorMessage,
        stack: errorStack,
        model,
        provider: providerName,
      });

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message?.includes('API key')) {
          logger.error('API key error', { message: error.message });
          return new Response('Invalid or missing API key', {
            status: 401,
            statusText: 'Unauthorized',
          });
        } else if (error.message?.includes('Authentication error')) {
          logger.error('Authentication error', { message: error.message });
          return new Response(error.message, {
            status: 401,
            statusText: 'Unauthorized',
          });
        } else if (error.message?.includes('not found') || error.message?.includes('not available')) {
          logger.error('Resource not found', { message: error.message });
          return new Response(error.message, {
            status: 404,
            statusText: 'Not Found',
          });
        } else if (error.message?.includes('Server error')) {
          logger.error('Server error', { message: error.message });
          return new Response(error.message, {
            status: 502,
            statusText: 'Bad Gateway',
          });
        }
      }

      // Default error response with more details
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: errorMessage.substring(0, 200),
          requestId: new Date().getTime().toString(),
        }),
        {
          status: 500,
          statusText: 'Internal Server Error',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }
  }
}
