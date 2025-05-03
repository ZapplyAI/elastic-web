import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { streamText } from '~/lib/.server/llm/stream-text';
import { stripIndents } from '~/utils/stripIndent';
import type { ProviderInfo } from '~/types/model';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';
import { createScopedLogger } from '~/utils/logger';

export async function action(args: ActionFunctionArgs) {
  return enhancerAction(args);
}

const logger = createScopedLogger('api.enhancher');

async function enhancerAction({ context, request }: ActionFunctionArgs) {
  const { message, model, provider } = await request.json<{
    message: string;
    model: string;
    provider: ProviderInfo;
    apiKeys?: Record<string, string>;
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const apiKeys = getApiKeysFromCookie(cookieHeader);
  const providerSettings = getProviderSettingsFromCookie(cookieHeader);

  try {
    // Get auth token from request headers or cookies
    const authToken = request.headers.get('Authorization')?.replace('Bearer ', '') || '';

    logger.info(`Processing enhancer request for model: ${model}, provider: ${providerName}`);

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

    // Validate message content
    if (!message || typeof message !== 'string') {
      logger.error('Invalid message format', { message });
      throw new Response('Invalid or missing message content', {
        status: 400,
        statusText: 'Bad Request',
      });
    }

    logger.info('Calling streamText for prompt enhancement');

    const stream = await streamText({
      messages: [
        {
          role: 'user',
          content:
            `[Model: ${model}]\n\n[Provider: ${providerName}]\n\n` +
            stripIndents`
            You are a professional prompt engineer specializing in crafting precise, effective prompts.
            Your task is to enhance prompts by making them more specific, actionable, and effective.

            I want you to improve the user prompt that is wrapped in \`<original_prompt>\` tags.

            For valid prompts:
            - Make instructions explicit and unambiguous
            - Add relevant context and constraints
            - Remove redundant information
            - Maintain the core intent
            - Ensure the prompt is self-contained
            - Use professional language

            For invalid or unclear prompts:
            - Respond with clear, professional guidance
            - Keep responses concise and actionable
            - Maintain a helpful, constructive tone
            - Focus on what the user should provide
            - Use a standard template for consistency

            IMPORTANT: Your response must ONLY contain the enhanced prompt text.
            Do not include any explanations, metadata, or wrapper tags.

            <original_prompt>
              ${message}
            </original_prompt>
          `,
        },
      ],
      env: context.cloudflare?.env as any,
      providerSettings,
      authToken,
      userProfile,
    });

    logger.info('Stream received successfully, returning response');

    // Return the stream directly
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: unknown) {
    // Enhanced error logging
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Error in enhancer action:', {
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
}
