import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';

export function Header() {
  const chat = useStore(chatStore);

  return (
    <header
      className={classNames('flex items-center p-3 border-b h-[var(--header-height)]', {
        'border-transparent': !chat.started,
        'border-elasticApp-elements-borderColor': chat.started,
      })}
    >
      <div className="flex items-center gap-2 z-logo text-elasticApp-elements-textPrimary cursor-pointer">
        <a href="/" className="text-lg font-semibold text-accent flex items-center">
          <img src="/favicon.svg" alt="logo" className="w-[20px] h-[20px] mr-2 inline-block" />
          <span>Elastic Copilot</span>
        </a>
      </div>
      <div className="flex-1 flex items-center justify-end gap-4">
        <ThemeSwitch />
        {chat.started && ( // Display ChatDescription and HeaderActionButtons only when the chat has started.
          <>
            <span className="px-4 truncate text-center text-elasticApp-elements-textPrimary">
              <ClientOnly>{() => <ChatDescription />}</ClientOnly>
            </span>
            <ClientOnly>
              {() => (
                <div className="mr-1">
                  <HeaderActionButtons />
                </div>
              )}
            </ClientOnly>
          </>
        )}
      </div>
    </header>
  );
}
