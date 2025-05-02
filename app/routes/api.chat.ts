import { type ActionFunctionArgs, json as remixJson } from '@remix-run/cloudflare';
import { createDataStream } from 'ai';
import { streamText, type Messages } from '~/lib/.server/llm/stream-text';
import type { IProviderSetting } from '~/types/model';
import { createScopedLogger } from '~/utils/logger';
import { fetchUserProfile } from '~/lib/api/client';

const TOKEN_COOKIE_NAME = 'elastic_authToken';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

const logger = createScopedLogger('api.chat');

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  const items = cookieHeader.split(';').map((cookie) => cookie.trim());

  items.forEach((item) => {
    const [name, ...rest] = item.split('=');
    if (name && rest.length) {
      const decodedName = decodeURIComponent(name.trim());
      const decodedValue = decodeURIComponent(rest.join('=').trim());
      cookies[decodedName] = decodedValue;
    }
  });

  return cookies;
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  const { messages, files, promptId, contextOptimization } = await request.json<{
    messages: Messages;
    files: any;
    promptId?: string;
    contextOptimization: boolean;
  }>();

  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const providerSettings: Record<string, IProviderSetting> = JSON.parse(
    cookies.providers || '{}'
  );

  const authToken = cookies[TOKEN_COOKIE_NAME];
  if (!authToken) {
    logger.error('Auth token cookie missing.');
    return remixJson({ error: 'Unauthorized: Missing authentication token.' }, { status: 401 });
  }

  const userProfile = await fetchUserProfile(authToken);
  if (!userProfile) {
    logger.error('Failed to fetch user profile or token is invalid.');
    return remixJson({ error: 'Unauthorized: Invalid token or failed to fetch profile.' }, { status: 401 });
  }

  try {
    const dataStream = createDataStream({
      async execute(streamWriter) {
        logger.info('Executing data stream for proxy call');

        try {
          const resultStream = await streamText({
            messages,
            env: context.cloudflare?.env,
            files,
            providerSettings,
            promptId,
            contextOptimization,
            authToken,
            userProfile,
          });

          const reader = resultStream.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              logger.debug('Proxy stream finished piping.');
              break;
            }
            const textChunk = decoder.decode(value, { stream: true });
            if (textChunk) {
              streamWriter.write(`0:"${JSON.stringify(textChunk).slice(1, -1)}"\n`);
            }
          }
          const remainingText = decoder.decode();
          if (remainingText) {
              streamWriter.write(`0:"${JSON.stringify(remainingText).slice(1, -1)}"\n`);
          }
          reader.releaseLock();
          logger.info('Finished piping proxy stream to client.');

        } catch (streamError: any) {
            logger.error('Error during streamText execution or piping:', streamError);
            const errorMessage = `Error generating response: ${streamError.message || 'Unknown error during generation.'}`;
            streamWriter.write(`3:"${JSON.stringify(errorMessage).slice(1, -1)}"\n`);
        } finally {
            logger.info('Data stream execute block finished.');
        }
      },
      onError: (error: any) => {
        logger.error('DataStream creation/onError:', error);
        return `3:"${JSON.stringify(`Error setting up response stream: ${error?.message || 'Unknown error'}`).slice(1, -1)}"\n`;
      },
    });

    return new Response(dataStream, {
      status: 200,
      headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          Connection: 'keep-alive',
          'Cache-Control': 'no-cache',
      },
    });

  } catch (error: any) {
    logger.error('Chat Action Error (Outer Catch):', error);
    return remixJson({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
