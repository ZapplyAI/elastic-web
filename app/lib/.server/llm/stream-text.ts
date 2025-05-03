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
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(proxyPayload),
    });

    logger.info(`Proxy request status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Proxy request failed: ${response.status} ${response.statusText}`, { errorText });
      throw new Error(`Proxy request failed: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Proxy response missing body');
    }

    logger.info('Proxy request successful, returning stream.');

    return response.body;
  } catch (error) {
    logger.error('Error during proxy fetch call:', error);
    throw error;
  }
}
