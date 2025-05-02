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
  const providerSettings: Record<string, IProviderSetting> = JSON.parse(cookies.providers || '{}');

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
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              logger.debug('LLM stream finished.');

              // Process any final data left in the buffer after the loop ends
              if (buffer.trim()) {
                processEventBlock(buffer, logger, streamWriter);
              }

              break;
            }

            // Append decoded chunk to buffer
            buffer += decoder.decode(value, { stream: true });

            /**
             * Split by "event:" but keep the delimiter attached to the subsequent part
             * Filter out any empty strings resulting from a leading "event:"
             */
            const potentialBlocks = buffer.split(/(?=event:)/).filter(Boolean);

            // The last block might be incomplete, so save it for the next iteration

            const lastBlockIsIncomplete =
              potentialBlocks.length > 0 &&
              !blockTerminatorAppearsComplete(potentialBlocks[potentialBlocks.length - 1]);

            const blocksToProcess = lastBlockIsIncomplete ? potentialBlocks.slice(0, -1) : potentialBlocks;
            buffer = lastBlockIsIncomplete ? potentialBlocks[potentialBlocks.length - 1] : ''; // Reset buffer with the incomplete block or empty it

            for (const block of blocksToProcess) {
              processEventBlock(block, logger, streamWriter);
            }
          }

          // Process any final data left in the buffer after the loop ends
          if (buffer.trim()) {
            processEventBlock(buffer, logger, streamWriter);
          }

          reader.releaseLock();
          logger.info('Finished processing LLM stream loop.');
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

// Helper function to process a single event block
function processEventBlock(block: string, logger: ReturnType<typeof createScopedLogger>, streamWriter: any) {
  const trimmedBlock = block.trim();

  if (!trimmedBlock) {
    return;
  }

  // Find the first occurrence of "data:" to separate event name from data
  const dataStartIndex = trimmedBlock.indexOf('data:');
  let eventName = '';
  let dataContent = '';

  if (dataStartIndex !== -1) {
    eventName = trimmedBlock
      .substring(0, dataStartIndex)
      .replace(/^event:/, '')
      .trim();
    dataContent = trimmedBlock.substring(dataStartIndex + 5).trim();
  } else if (trimmedBlock.startsWith('event:')) {
    eventName = trimmedBlock.substring(6).trim();
  } else {
    logger.warn('Could not parse event block:', trimmedBlock);
    return;
  }

  /*
   * Log extracted event and data before parsing (optional debugging)
   * console.log(`--- Processed Block Event: ${eventName}, Data: ${dataContent} ---`);
   */

  if (eventName && dataContent) {
    try {
      const parsedJson = JSON.parse(dataContent);

      switch (eventName) {
        case 'content_block_delta':
          // Log the dataContent just before parsing for this specific event type
          console.log('--- Pre-JSON Parse (content_block_delta) ---', dataContent);

          if (parsedJson.delta?.type === 'text_delta') {
            const textDelta = parsedJson.delta.text;

            if (textDelta) {
              // Log the formatted text delta ONLY
              console.log('--- Parsed Text Delta ---', textDelta);

              // Send data to client in the expected format
              streamWriter.write(`0:"${JSON.stringify(textDelta).slice(1, -1)}"\n`);
            }
          }

          break;
        case 'message_stop':
          logger.debug('Processed message_stop event.');
          break;

        // Add cases for other events if needed
        default:
          break;
      }
    } catch (e) {
      logger.error('Failed to parse JSON for event', eventName, ':', dataContent, e);
    }
  } else if (eventName === 'ping') {
    // logger.debug('Processed ping event.');
  } else if (eventName === 'message_stop' && !dataContent) {
    logger.debug('Processed message_stop event (no data).');
  }
}

/**
 * Basic check to see if a block looks complete (ends with a likely JSON terminator '}')
 * This is heuristic and might need refinement based on actual stream variability.
 */
function blockTerminatorAppearsComplete(block: string): boolean {
  const trimmed = block.trim();

  /**
   * Check if it contains 'data:' and roughly ends like a JSON object would
   * for message_stop or delta events. Ping events might not have data.
   */

  if (trimmed.startsWith('event: ping')) {
    return true;
  }

  if (trimmed.startsWith('event: message_stop') && !trimmed.includes('data:')) {
    return true;
  }

  return trimmed.includes('data:') && trimmed.endsWith('}');
}
