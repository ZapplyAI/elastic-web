/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import type { JSONValue, Message } from 'ai';
import React, { type RefCallback, useEffect, useState, useCallback, useMemo } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { HistoryItem } from '~/components/sidebar/HistoryItem';
import { Dialog, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { db, getAll, deleteById, type ChatHistoryItem, useChatHistory } from '~/lib/persistence';
import { binDates } from '~/components/sidebar/date-binning';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useSearchFilter } from '~/lib/hooks/useSearchFilter';
import { IconButton } from '~/components/ui/IconButton';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { PROVIDER_LIST } from '~/utils/constants';
import { ControlPanel } from '~/components/@settings';
import { Messages } from './Messages.client';
import { SendButton } from './SendButton.client';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { APIKeyManager, getApiKeysFromCookies } from './APIKeyManager';
import Cookies from 'js-cookie';
import * as Tooltip from '@radix-ui/react-tooltip';

import styles from './BaseChat.module.scss';
import { ExportChatButton } from '~/components/chat/chatExportAndImport/ExportChatButton';
import { ImportButtons } from '~/components/chat/chatExportAndImport/ImportButtons';
import { ExamplePrompts } from '~/components/chat/ExamplePrompts';
import GitCloneButton from './GitCloneButton';

import FilePreview from './FilePreview';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ModelSelector } from '~/components/chat/ModelSelector';
import { SpeechRecognitionButton } from '~/components/chat/SpeechRecognition';
import type { ProviderInfo } from '~/types/model';
import { ScreenshotStateManager } from './ScreenshotStateManager';
import { toast } from 'react-toastify';
import StarterTemplates from './StarterTemplates';
import type { ActionAlert } from '~/types/actions';
import ChatAlert from './ChatAlert';
import type { ModelInfo } from '~/lib/modules/llm/types';
import ProgressCompilation from './ProgressCompilation';
import type { ProgressAnnotation } from '~/types/context';
import type { ActionRunner } from '~/lib/runtime/action-runner';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { LOCAL_PROVIDERS } from '~/lib/stores/settings';

const TEXTAREA_MIN_HEIGHT = 76;

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  chatStarted?: boolean;
  isStreaming?: boolean;
  onStreamingChange?: (streaming: boolean) => void;
  messages?: Message[];
  description?: string;
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  model?: string;
  setModel?: (model: string) => void;
  provider?: ProviderInfo;
  setProvider?: (provider: ProviderInfo) => void;
  providerList?: ProviderInfo[];
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
  importChat?: (description: string, messages: Message[]) => Promise<void>;
  exportChat?: () => void;
  uploadedFiles?: File[];
  setUploadedFiles?: (files: File[]) => void;
  imageDataList?: string[];
  setImageDataList?: (dataList: string[]) => void;
  actionAlert?: ActionAlert;
  clearAlert?: () => void;
  data?: JSONValue[] | undefined;
  actionRunner?: ActionRunner;

  // Added properties to fix TypeScript errors
  _model?: string;
  _setModel?: (model: string) => void;
  _setProvider?: (provider: ProviderInfo) => void;
  _enhancingPrompt?: boolean;
  _enhancePrompt?: () => void;
}

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      messageRef,
      scrollRef,
      showChat = true,
      chatStarted = false,
      isStreaming = false,
      onStreamingChange,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _model: model,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _setModel: setModel,
      provider,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _setProvider: setProvider,
      providerList,
      input = '',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _enhancingPrompt: enhancingPrompt,
      handleInputChange,

      // promptEnhanced,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _enhancePrompt: enhancePrompt,
      sendMessage,
      handleStop,
      importChat,
      exportChat,
      uploadedFiles = [],
      setUploadedFiles,
      imageDataList = [],
      setImageDataList,
      messages,
      actionAlert,
      clearAlert,
      data,
      actionRunner,
    },
    ref,
  ) => {
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;
    const [apiKeys, setApiKeys] = useState<Record<string, string>>(getApiKeysFromCookies());
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [modelList, setModelList] = useState<ModelInfo[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isModelSettingsCollapsed, setIsModelSettingsCollapsed] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
    const [transcript, setTranscript] = useState('');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isModelLoading, setIsModelLoading] = useState<string | undefined>('all');
    const [progressAnnotations, setProgressAnnotations] = useState<ProgressAnnotation[]>([]);
    const [showChatHistoryModal, setShowChatHistoryModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [chatHistoryList, setChatHistoryList] = useState<ChatHistoryItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const { exportChat: exportChatHistory } = useChatHistory();

    // Filter chat history based on search term
    const filteredChatHistory = useMemo(() => {
      if (!searchTerm.trim()) {
        return chatHistoryList;
      }

      return chatHistoryList.filter((item) => {
        // Check if description contains the search term
        const descriptionMatch = item.description?.toLowerCase().includes(searchTerm.toLowerCase());

        if (descriptionMatch) {
          return true;
        }

        // Check if any message content contains the search term
        if (item.messages && Array.isArray(item.messages)) {
          return item.messages.some((msg) => {
            // Handle different message content types
            if (typeof msg.content === 'string') {
              return msg.content.toLowerCase().includes(searchTerm.toLowerCase());
            } else if (msg.content && typeof msg.content === 'object') {
              // If content is an object, try to stringify it
              try {
                const contentStr = JSON.stringify(msg.content);
                return contentStr.toLowerCase().includes(searchTerm.toLowerCase());
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
              } catch (e) {
                return false;
              }
            }

            return false;
          });
        }

        return false;
      });
    }, [chatHistoryList, searchTerm]);

    const loadChatHistory = useCallback(() => {
      if (db) {
        getAll(db)
          .then((list) => list.filter((item) => item.urlId && item.description))
          .then(setChatHistoryList)
          .catch((error) => toast.error(error.message));
      }
    }, []);

    useEffect(() => {
      if (showChatHistoryModal) {
        loadChatHistory();
      }
    }, [showChatHistoryModal, loadChatHistory]);
    useEffect(() => {
      if (data) {
        const progressList = data.filter(
          (x) => typeof x === 'object' && (x as any).type === 'progress',
        ) as ProgressAnnotation[];
        setProgressAnnotations(progressList);
      }
    }, [data]);
    useEffect(() => {
      console.log(transcript);
    }, [transcript]);

    useEffect(() => {
      onStreamingChange?.(isStreaming);
    }, [isStreaming, onStreamingChange]);

    useEffect(() => {
      if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0])
            .map((result) => result.transcript)
            .join('');

          setTranscript(transcript);

          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: transcript },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        setRecognition(recognition);
      }
    }, []);

    useEffect(() => {
      if (typeof window !== 'undefined') {
        let parsedApiKeys: Record<string, string> | undefined = {};

        try {
          parsedApiKeys = getApiKeysFromCookies();
          setApiKeys(parsedApiKeys);
        } catch (error) {
          console.error('Error loading API keys from cookies:', error);
          Cookies.remove('apiKeys');
        }

        setIsModelLoading('all');
        fetch('/api/models')
          .then((response) => response.json())
          .then((data) => {
            const typedData = data as { modelList: ModelInfo[] };
            setModelList(typedData.modelList);
          })
          .catch((error) => {
            console.error('Error fetching model list:', error);
          })
          .finally(() => {
            setIsModelLoading(undefined);
          });
      }
    }, [providerList, provider]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const onApiKeysChange = async (providerName: string, apiKey: string) => {
      const newApiKeys = { ...apiKeys, [providerName]: apiKey };
      setApiKeys(newApiKeys);
      Cookies.set('apiKeys', JSON.stringify(newApiKeys));

      setIsModelLoading(providerName);

      let providerModels: ModelInfo[] = [];

      try {
        const response = await fetch(`/api/models/${encodeURIComponent(providerName)}`);
        const data = await response.json();
        providerModels = (data as { modelList: ModelInfo[] }).modelList;
      } catch (error) {
        console.error('Error loading dynamic models for:', providerName, error);
      }

      // Only update models for the specific provider
      setModelList((prevModels) => {
        const otherModels = prevModels.filter((model) => model.provider !== providerName);
        return [...otherModels, ...providerModels];
      });
      setIsModelLoading(undefined);
    };

    const startListening = () => {
      if (recognition) {
        recognition.start();
        setIsListening(true);
      }
    };

    const stopListening = () => {
      if (recognition) {
        recognition.stop();
        setIsListening(false);
      }
    };

    const handleSendMessage = (event: React.UIEvent, messageInput?: string) => {
      if (sendMessage) {
        sendMessage(event, messageInput);

        if (recognition) {
          recognition.abort(); // Stop current recognition
          setTranscript(''); // Clear transcript
          setIsListening(false);

          // Clear the input by triggering handleInputChange with empty value
          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: '' },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        }
      }
    };

    const handleFileUpload = () => {
      if (typeof document === 'undefined') {
        return;
      }

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];

        if (file) {
          const reader = new FileReader();

          reader.onload = (e) => {
            const base64Image = e.target?.result as string;
            setUploadedFiles?.([...uploadedFiles, file]);
            setImageDataList?.([...imageDataList, base64Image]);
          };
          reader.readAsDataURL(file);
        }
      };

      input.click();
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;

      if (!items) {
        return;
      }

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();

          const file = item.getAsFile();

          if (file) {
            const reader = new FileReader();

            reader.onload = (e) => {
              const base64Image = e.target?.result as string;
              setUploadedFiles?.([...uploadedFiles, file]);
              setImageDataList?.([...imageDataList, base64Image]);
            };
            reader.readAsDataURL(file);
          }

          break;
        }
      }
    };

    const baseChat = (
      <div
        ref={ref}
        className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden')}
        data-chat-visible={showChat}
      >
        {/* Chat History Modal */}
        {/* Settings Modal */}
        <ControlPanel open={showSettingsModal} onClose={() => setShowSettingsModal(false)} />

        {/* Chat History Modal */}
        <DialogRoot open={showChatHistoryModal}>
          <Dialog onClose={() => setShowChatHistoryModal(false)} className="animate-fade-in-up">
            <div className="p-8 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-800 max-w-3xl w-full">
              <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="i-ph:chat-centered-text text-2xl text-purple-500 dark:text-purple-400"></div>
                  <span>Chat History</span>
                </div>
                <button
                  onClick={() => setShowChatHistoryModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <div className="i-ph:x text-xl"></div>
                </button>
              </DialogTitle>

              {/* Search input */}
              <div className="relative mb-6">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <div className="i-ph:magnifying-glass text-gray-400 dark:text-gray-500"></div>
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 text-gray-900 dark:text-white"
                />
              </div>

              <div className="mt-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {filteredChatHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="i-ph:chat-dots text-6xl text-gray-300 dark:text-gray-700 mb-4"></div>
                    <div className="text-gray-500 dark:text-gray-400 text-lg font-medium mb-2">
                      No previous conversations
                    </div>
                    <p className="text-gray-400 dark:text-gray-500 text-sm max-w-md">
                      Start a new chat to begin building your conversation history
                    </p>
                  </div>
                ) : (
                  binDates(filteredChatHistory).map(({ category, items }) => (
                    <div key={category} className="mt-6 first:mt-0 space-y-3 animate-fade-in animation-delay-100">
                      <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 sticky top-0 z-1 bg-white dark:bg-gray-900 py-2 backdrop-blur-sm bg-opacity-80 dark:bg-opacity-80">
                        {category}
                      </div>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="p-4 rounded-lg border border-gray-100 dark:border-gray-800 hover:border-purple-200 dark:hover:border-purple-800 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all duration-200 group"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                {item.description}
                              </h3>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    if (db) {
                                      deleteById(db, item.id)
                                        .then(loadChatHistory)
                                        .catch((_error) => toast.error('Failed to delete conversation'));
                                    }
                                  }}
                                  className="p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 rounded"
                                  title="Delete conversation"
                                >
                                  <div className="i-ph:trash text-lg"></div>
                                </button>
                                <button
                                  onClick={() => exportChatHistory(item.id)}
                                  className="p-1 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 rounded"
                                  title="Export conversation"
                                >
                                  <div className="i-ph:export text-lg"></div>
                                </button>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                              <div className="i-ph:clock text-sm"></div>
                              <span>{new Date(item.timestamp).toLocaleString()}</span>
                              <span className="mx-1">•</span>
                              <span>{item.messages.length} messages</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                <button
                  onClick={() => setShowChatHistoryModal(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors mr-2"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowChatHistoryModal(false);

                    if (typeof window !== 'undefined') {
                      window.location.href = '/';
                    }
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <div className="i-ph:plus"></div>
                  <span>New Chat</span>
                </button>
              </div>
            </div>
          </Dialog>
        </DialogRoot>
        <div ref={scrollRef} className="flex flex-col lg:flex-row overflow-y-auto w-full h-full">
          <div className={classNames(styles.Chat, 'flex flex-col flex-grow lg:min-w-[var(--chat-min-width)] h-full')}>
            {!chatStarted && (
              <div id="intro" className="mt-[16vh] max-w-chat mx-auto text-center px-4 lg:px-0 relative z-10">
                <h1 className="text-3xl lg:text-5xl font-bold mb-4 animate-fade-in tracking-tight">
                  <span className="gradient-text drop-shadow-sm">Code, Ship, Dream</span>
                </h1>
                <p className="text-md lg:text-xl mb-8 text-elasticApp-elements-textSecondary animate-fade-in animation-delay-200 font-light">
                  Idea to app in minutes
                </p>
                <div className="absolute -z-10 w-64 h-64 bg-gradient-to-r from-primary-color to-accent-color rounded-full filter blur-[100px] opacity-20 top-[-20%] left-[50%] transform -translate-x-1/2"></div>
                <div className="absolute -z-10 w-96 h-96 bg-gradient-to-tr from-accent-color to-secondary-color rounded-full filter blur-[120px] opacity-10 bottom-[-50%] right-[-10%]"></div>
                <div className="absolute -z-10 w-80 h-80 bg-gradient-to-bl from-secondary-color to-primary-color rounded-full filter blur-[120px] opacity-10 bottom-[-30%] left-[-10%]"></div>
              </div>
            )}
            <div
              className={classNames('pt-6 px-2 sm:px-6', {
                'h-full flex flex-col': chatStarted,
              })}
            >
              <ClientOnly>
                {() => {
                  return chatStarted ? (
                    <div className="flex-grow overflow-hidden chat-message-container" ref={scrollRef}>
                      {/* Chat Controls */}
                      <div className="flex justify-end gap-2 max-w-chat mx-auto mb-2">
                        <button
                          onClick={() => setShowChatHistoryModal(!showChatHistoryModal)}
                          className={classNames(
                            'flex items-center gap-1.5 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/20 rounded-lg px-3 py-1.5 transition-colors text-sm font-medium',
                            showChatHistoryModal ? 'bg-purple-100 dark:bg-purple-500/30' : '',
                          )}
                        >
                          <div className="i-ph:chat-centered-text text-lg"></div>
                          <span>History</span>
                        </button>
                        <button
                          onClick={() => setShowSettingsModal(!showSettingsModal)}
                          className={classNames(
                            'flex items-center gap-1.5 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/20 rounded-lg px-3 py-1.5 transition-colors text-sm font-medium',
                            showSettingsModal ? 'bg-purple-100 dark:bg-purple-500/30' : '',
                          )}
                        >
                          <div className="i-ph:gear text-lg"></div>
                          <span>Settings</span>
                        </button>
                        <a
                          href="/"
                          className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/20 rounded-lg px-3 py-1.5 transition-colors text-sm font-medium"
                        >
                          <div className="i-ph:plus text-lg"></div>
                          <span>New Chat</span>
                        </a>
                      </div>
                      <Messages
                        ref={messageRef}
                        className="flex flex-col w-full flex-1 max-w-chat pb-6 mx-auto"
                        messages={messages}
                        isStreaming={isStreaming}
                      />
                    </div>
                  ) : null;
                }}
              </ClientOnly>
              <div
                className={classNames('flex flex-col gap-4 w-full max-w-chat mx-auto z-prompt mb-6', {
                  'sticky bottom-2': chatStarted,
                })}
              >
                <div className="bg-elasticApp-elements-background-depth-2">
                  {actionAlert && (
                    <ChatAlert
                      alert={actionAlert}
                      clearAlert={() => clearAlert?.()}
                      postMessage={(message) => {
                        sendMessage?.({} as any, message);
                        clearAlert?.();
                      }}
                    />
                  )}
                </div>
                {progressAnnotations && <ProgressCompilation data={progressAnnotations} />}
                <div
                  className={classNames(
                    styles.chatContainer,
                    'p-4 relative w-[90%] max-w-[600px] mx-auto z-prompt',
                    'backdrop-blur-sm bg-opacity-80 transition-all duration-300',

                    /*
                     * {
                     *   'sticky bottom-2': chatStarted,
                     * },
                     */
                  )}
                >
                  {/* No floating background elements */}
                  <svg className={classNames(styles.PromptEffectContainer)}>
                    <defs>
                      <linearGradient
                        id="line-gradient"
                        x1="20%"
                        y1="0%"
                        x2="-14%"
                        y2="10%"
                        gradientUnits="userSpaceOnUse"
                        gradientTransform="rotate(-45)"
                      >
                        <stop offset="0%" stopColor="#FF4099" stopOpacity="0%"></stop>
                        <stop offset="40%" stopColor="#FF4099" stopOpacity="80%"></stop>
                        <stop offset="50%" stopColor="#D633CC" stopOpacity="80%"></stop>
                        <stop offset="100%" stopColor="#8257E5" stopOpacity="0%"></stop>
                      </linearGradient>
                      <linearGradient id="shine-gradient">
                        <stop offset="0%" stopColor="white" stopOpacity="0%"></stop>
                        <stop offset="40%" stopColor="#ffffff" stopOpacity="80%"></stop>
                        <stop offset="50%" stopColor="#ffffff" stopOpacity="80%"></stop>
                        <stop offset="100%" stopColor="white" stopOpacity="0%"></stop>
                      </linearGradient>
                    </defs>
                    <rect className={classNames(styles.PromptEffectLine)} pathLength="100" strokeLinecap="round"></rect>
                    <rect className={classNames(styles.PromptShine)} x="48" y="24" width="70" height="1"></rect>
                  </svg>
                  {/* Model selector and API key manager removed - using global Anthropic API key */}
                  <FilePreview
                    files={uploadedFiles}
                    imageDataList={imageDataList}
                    onRemove={(index) => {
                      setUploadedFiles?.(uploadedFiles.filter((_, i) => i !== index));
                      setImageDataList?.(imageDataList.filter((_, i) => i !== index));
                    }}
                  />
                  <ClientOnly>
                    {() => (
                      <ScreenshotStateManager
                        setUploadedFiles={setUploadedFiles}
                        setImageDataList={setImageDataList}
                        uploadedFiles={uploadedFiles}
                        imageDataList={imageDataList}
                      />
                    )}
                  </ClientOnly>
                  <div
                    className={classNames(
                      styles.inputContainer,
                      'relative overflow-hidden transition-all duration-300',
                    )}
                  >
                    <textarea
                      ref={textareaRef}
                      className={classNames(
                        'w-full pl-5 pt-5 pr-16 outline-none resize-none text-white placeholder-gray-400 bg-transparent text-sm',
                        'transition-all duration-300',
                        'focus:outline-none focus:ring-1 focus:ring-purple-500',
                        'rounded-lg backdrop-blur-sm',
                      )}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.border = '2px solid #1488fc';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.border = '2px solid #1488fc';
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.border = '1px solid var(--elasticApp-elements-borderColor)';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.border = '1px solid var(--elasticApp-elements-borderColor)';

                        const files = Array.from(e.dataTransfer.files);
                        files.forEach((file) => {
                          if (file.type.startsWith('image/')) {
                            const reader = new FileReader();

                            reader.onload = (e) => {
                              const base64Image = e.target?.result as string;
                              setUploadedFiles?.([...uploadedFiles, file]);
                              setImageDataList?.([...imageDataList, base64Image]);
                            };
                            reader.readAsDataURL(file);
                          }
                        });
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          if (event.shiftKey) {
                            return;
                          }

                          event.preventDefault();

                          if (isStreaming) {
                            handleStop?.();
                            return;
                          }

                          // ignore if using input method engine
                          if (event.nativeEvent.isComposing) {
                            return;
                          }

                          handleSendMessage?.(event);
                        }
                      }}
                      value={input}
                      onChange={(event) => {
                        handleInputChange?.(event);
                      }}
                      onPaste={handlePaste}
                      style={{
                        minHeight: TEXTAREA_MIN_HEIGHT,
                        maxHeight: TEXTAREA_MAX_HEIGHT,
                      }}
                      placeholder="make something with Elastic Copilot"
                      translate="no"
                    />
                    <ClientOnly>
                      {() => (
                        <SendButton
                          show={input.length > 0 || isStreaming || uploadedFiles.length > 0}
                          isStreaming={isStreaming}
                          disabled={!providerList || providerList.length === 0}
                          onClick={(event) => {
                            if (isStreaming) {
                              handleStop?.();
                              return;
                            }

                            if (input.length > 0 || uploadedFiles.length > 0) {
                              handleSendMessage?.(event);
                            }
                          }}
                        />
                      )}
                    </ClientOnly>
                    <div className="flex justify-between items-center text-sm p-4 pt-2">
                      <div className="flex gap-1 items-center">
                        <IconButton title="Upload file" className="transition-all" onClick={() => handleFileUpload()}>
                          <div className="i-ph:paperclip text-xl"></div>
                        </IconButton>

                        <SpeechRecognitionButton
                          isListening={isListening}
                          onStart={startListening}
                          onStop={stopListening}
                          disabled={isStreaming}
                        />

                        {/* Import folder button */}
                        <IconButton
                          title="Import folder"
                          className="transition-all"
                          onClick={() => {
                            if (typeof document === 'undefined') {
                              return;
                            }

                            const input = document.createElement('input');
                            input.type = 'file';
                            input.setAttribute('webkitdirectory', '');
                            input.setAttribute('directory', '');

                            input.onchange = async (e) => {
                              const target = e.target as HTMLInputElement;
                              const files = target.files;

                              if (!files || files.length === 0 || !importChat) {
                                return;
                              }

                              try {
                                const allFiles = Array.from(files) as File[];
                                const folderName = allFiles[0]?.webkitRelativePath?.split('/')[0] || 'Unknown Folder';
                                const { createChatFromFolder } = await import('~/utils/folderImport');
                                const { shouldIncludeFile, isBinaryFile, MAX_FILES } = await import(
                                  '~/utils/fileUtils'
                                );

                                const filteredFiles = allFiles.filter((file) => {
                                  const path = file.webkitRelativePath?.split('/').slice(1).join('/') || '';
                                  return shouldIncludeFile(path);
                                });

                                if (filteredFiles.length === 0) {
                                  toast.error('No valid files found in the selected folder');
                                  return;
                                }

                                if (filteredFiles.length > MAX_FILES) {
                                  toast.error(
                                    `This folder contains ${filteredFiles.length.toLocaleString()} files. Please select a folder with fewer than ${MAX_FILES.toLocaleString()} files.`,
                                  );
                                  return;
                                }

                                const loadingToast = toast.loading(`Importing ${folderName}...`);

                                const fileChecks = await Promise.all(
                                  filteredFiles.map(async (file) => ({
                                    file,
                                    isBinary: await isBinaryFile(file),
                                  })),
                                );

                                const textFiles = fileChecks.filter((f) => !f.isBinary).map((f) => f.file);
                                const binaryFilePaths = fileChecks
                                  .filter((f) => f.isBinary)
                                  .map((f) => {
                                    const file = f.file as File;
                                    return file.webkitRelativePath?.split('/').slice(1).join('/') || '';
                                  });

                                if (textFiles.length === 0) {
                                  toast.error('No text files found in the selected folder');
                                  toast.dismiss(loadingToast);

                                  return;
                                }

                                if (binaryFilePaths.length > 0) {
                                  toast.info(`Skipping ${binaryFilePaths.length} binary files`);
                                }

                                const messages = await createChatFromFolder(textFiles, binaryFilePaths, folderName);
                                await importChat(folderName, [...messages]);

                                toast.success('Folder imported successfully');
                                toast.dismiss(loadingToast);
                              } catch (error) {
                                console.error('Failed to import folder:', error);
                                toast.error('Failed to import folder');
                              }
                            };

                            input.click();
                          }}
                        >
                          <div className="i-ph:folder-simple-plus text-xl"></div>
                        </IconButton>

                        {chatStarted && <ClientOnly>{() => <ExportChatButton exportChat={exportChat} />}</ClientOnly>}
                        {/* Model settings button removed */}
                      </div>
                      {input.length > 3 ? (
                        <div className="text-xs text-elasticApp-elements-textTertiary">
                          Use{' '}
                          <kbd className="kdb px-1.5 py-0.5 rounded bg-elasticApp-elements-background-depth-2">
                            Shift
                          </kbd>{' '}
                          +{' '}
                          <kbd className="kdb px-1.5 py-0.5 rounded bg-elasticApp-elements-background-depth-2">
                            Return
                          </kbd>{' '}
                          a new line
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Empty div to maintain layout structure */}
            <div className="flex flex-col justify-center gap-5">
              {/* Hidden elements for functionality preservation */}
              {!chatStarted && (
                <div style={{ height: 0, overflow: 'hidden', opacity: 0, position: 'absolute', pointerEvents: 'none' }}>
                  {ImportButtons(importChat)}
                  <GitCloneButton importChat={importChat} />
                  {ExamplePrompts((event, messageInput) => {
                    if (isStreaming) {
                      handleStop?.();
                      return;
                    }

                    handleSendMessage?.(event, messageInput);
                  })}
                  <StarterTemplates />
                </div>
              )}
            </div>
          </div>
          <ClientOnly>
            {() => (
              <Workbench
                actionRunner={actionRunner ?? ({} as ActionRunner)}
                chatStarted={chatStarted}
                isStreaming={isStreaming}
              />
            )}
          </ClientOnly>
        </div>
      </div>
    );

    return <Tooltip.Provider delayDuration={200}>{baseChat}</Tooltip.Provider>;
  },
);
