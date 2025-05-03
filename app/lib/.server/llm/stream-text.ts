import { type Message } from 'ai';
import { MAX_TOKENS, type FileMap } from './constants';
import { getSystemPrompt } from '~/lib/common/prompts/prompts';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, MODIFICATIONS_TAG_NAME, PROVIDER_LIST, WORK_DIR } from '~/utils/constants';
import type { IProviderSetting } from '~/types/model';
import { PromptLibrary } from '~/lib/common/prompt-library';
import { allowedHTMLElements } from '~/utils/markdown';
import { LLMManager } from '~/lib/modules/llm/manager';
import { createScopedLogger } from '~/utils/logger';
import { createFilesContext, extractPropertiesFromMessage } from './utils';
import { getFilePaths } from './select-context';
import type { UserProfile } from '~/types/user';

export type Messages = Message[];

const logger = createScopedLogger('stream-text');
const PROXY_BASE_URL = 'https://copilot-api-staging-739610349551.europe-west2.run.app/api';
const PROXY_URL = `${PROXY_BASE_URL}/proxy/llm`;

export async function streamText(props: {
  messages: Omit<Message, 'id'>[];
  env?: Env;
  files?: FileMap;
  providerSettings?: Record<string, IProviderSetting>;
  promptId?: string;
  contextOptimization?: boolean;
  contextFiles?: FileMap;
  summary?: string;
  messageSliceId?: number;
  authToken: string;
  userProfile: UserProfile | null;
}) {
  const { messages, files, promptId, contextOptimization, contextFiles, summary, authToken, userProfile } = props;

  let currentModel = DEFAULT_MODEL;
  let currentProvider = DEFAULT_PROVIDER.name;

  let processedMessages = messages.map((message) => {
    if (message.role === 'user') {
      const { model, provider, content } = extractPropertiesFromMessage(message);
      currentModel = model;
      currentProvider = provider;

      return { ...message, content };
    } else if (message.role == 'assistant') {
      let content = message.content;
      content = content.replace(/<div class=\\"__elasticAppThought__\\">.*?<\/div>/s, '');
      content = content.replace(/<think>.*?<\/think>/s, '');

      return { ...message, content };
    }

    return message;
  });

  const provider = PROVIDER_LIST.find((p) => p.name === currentProvider) || DEFAULT_PROVIDER;
  const staticModels = LLMManager.getInstance().getStaticModelListFromProvider(provider);
  let modelDetails = staticModels.find((m) => m.name === currentModel);

  if (!modelDetails) {
    logger.warn(`Model details not found for ${currentModel}. Using default.`);
    modelDetails = provider.staticModels?.[0];

    if (!modelDetails) {
      throw new Error(`No models available for provider ${provider.name}`);
    }

    currentModel = modelDetails.name;
  }

  const dynamicMaxTokens = modelDetails?.maxTokenAllowed ?? MAX_TOKENS;

  let systemPromptText =
    PromptLibrary.getPropmtFromLibrary(promptId || 'default', {
      cwd: WORK_DIR,
      allowedHtmlElements: allowedHTMLElements,
      modificationTagName: MODIFICATIONS_TAG_NAME,
    }) ?? getSystemPrompt();

  if (files && contextFiles && contextOptimization) {
    const codeContext = createFilesContext(contextFiles, true);
    const filePaths = getFilePaths(files);
    systemPromptText = `${systemPromptText}\nBelow are all the files present in the project:\n---\n${filePaths.join('\n')}\n---\n\nBelow is the artifact containing the context loaded into context buffer for you to have knowledge of and might need changes to fullfill current user request.\nCONTEXT BUFFER:\n---\n${codeContext}\n---\n`;

    if (summary) {
      systemPromptText = `${systemPromptText}\n      below is the chat history till now\nCHAT SUMMARY:\n---\n${props.summary}\n---\n`;

      if (props.messageSliceId) {
        processedMessages = processedMessages.slice(props.messageSliceId);
      } else {
        const lastMessage = processedMessages.pop();

        if (lastMessage) {
          processedMessages = [lastMessage];
        }
      }
    }
  }

  logger.info(`Preparing proxy call for provider: ${provider.name}, model: ${currentModel}`);

  const subscriptionId = userProfile?.subscription?.id;

  if (!subscriptionId) {
    logger.error('Cannot make LLM call: Missing subscription ID in user profile.');
    throw new Error('Missing subscription ID');
  }

  let targetUrl: string;
  let targetHeaders: Record<string, string> = {};
  const providerName = provider.name;

  if (providerName === 'Anthropic') {
    targetUrl = 'https://api.anthropic.com/v1/messages';
    targetHeaders = {
      'anthropic-version': '2023-06-01',
    };
  } else {
    logger.error(`Proxy target not configured for provider: ${providerName}`);
    throw new Error(`Proxy configuration not found for provider: ${providerName}`);
  }

  const formattedMessages = processedMessages.map((message) => {
    return {
      role: message.role,
      content: message.content,
    };
  });
  const formattedSystem = [{ type: 'text', text: systemPromptText }];

  const proxyPayload = {
    provider: providerName.toUpperCase(),
    url: targetUrl,
    method: 'POST',
    stream: true,
    model: currentModel,
    headers: targetHeaders,
    subscription_id: subscriptionId,
    payload: {
      model: currentModel,
      max_tokens: dynamicMaxTokens,
      temperature: 0,
      messages: formattedMessages,
      system: formattedSystem,
      stream: true,
    },
  };

  logger.info(`Making POST request to proxy: ${PROXY_URL}`);

  try {
    // Add timeout to the fetch request to prevent hanging in Netlify functions
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout

    // Log the request details for debugging
    logger.info(`Making proxy request to: ${PROXY_URL}`, {
      provider: providerName,
      model: currentModel,
      subscriptionId,
    });

    try {
      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(proxyPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      logger.info(`Proxy request status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        const requestId = new Date().getTime().toString();

        logger.error(`Proxy request failed: ${response.status} ${response.statusText}`, {
          errorText,
          requestId,
          netlifyInfo: 'This error may be related to Netlify function timeout or network connectivity issues.',
        });

        // Provide more specific error messages based on status code
        if (response.status === 401 || response.status === 403) {
          throw new Error(`Authentication error: Please check your API credentials (${response.status})`);
        } else if (response.status === 404) {
          throw new Error(`Resource not found: The requested endpoint or model may not exist (${response.status})`);
        } else if (response.status >= 500) {
          throw new Error(
            `Server error: The API service is experiencing issues (${response.status}). Please try again later.`,
          );
        } else {
          throw new Error(
            `Proxy request failed: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`,
          );
        }
      }

      if (!response.body) {
        logger.error('Proxy response missing body');
        throw new Error('Proxy response missing body');
      }

      logger.info('Proxy request successful, returning stream.');

      return response.body;
    } catch (fetchError) {
      clearTimeout(timeoutId);

      // Check if this was a timeout abort
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        logger.error('Proxy request timed out after 25 seconds', {
          url: PROXY_URL,
          netlifyInfo:
            'This is likely a timeout issue with Netlify functions. Consider increasing the function timeout in netlify.toml.',
        });
        throw new Error('Request to AI service timed out. Please try again later.');
      }

      // Re-throw other fetch errors
      throw fetchError;
    }
  } catch (error) {
    // Enhanced error logging with more context
    logger.error('Error during proxy fetch call:', error, {
      provider: providerName,
      model: currentModel,
      url: PROXY_URL,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });

    // Rethrow with a more user-friendly message
    if (error instanceof Error) {
      // Keep original error if it's already well-formatted
      throw error;
    } else {
      throw new Error(`Failed to connect to AI service: ${String(error)}`);
    }
  }
}
