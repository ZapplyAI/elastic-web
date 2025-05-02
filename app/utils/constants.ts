import { LLMManager } from '~/lib/modules/llm/manager';
import type { Template } from '~/types/template';

export const WORK_DIR_NAME = 'project';
export const WORK_DIR = `/home/${WORK_DIR_NAME}`;
export const MODIFICATIONS_TAG_NAME = 'elasticApp_file_modifications';
export const MODEL_REGEX = /^\[Model: (.*?)\]\n\n/;
export const PROVIDER_REGEX = /\[Provider: (.*?)\]\n\n/;
export const DEFAULT_MODEL = 'claude-3-5-sonnet-latest';
export const PROMPT_COOKIE_KEY = 'cachedPrompt';

const llmManager = LLMManager.getInstance(import.meta.env);

export const PROVIDER_LIST = llmManager.getAllProviders();
export const DEFAULT_PROVIDER = llmManager.getDefaultProvider();

export const providerBaseUrlEnvKeys: Record<string, { baseUrlKey?: string; apiTokenKey?: string }> = {};
PROVIDER_LIST.forEach((provider) => {
  providerBaseUrlEnvKeys[provider.name] = {
    baseUrlKey: provider.config.baseUrlKey,
    apiTokenKey: provider.config.apiTokenKey,
  };
});

// starter Templates

export const STARTER_TEMPLATES: Template[] = [
  {
    name: 'elasticApp-astro-basic',
    label: 'Astro Basic',
    description: 'Basic Astro.js template with TypeScript',
    githubRepo: 'thecodacus/elasticApp-astro-basic-template',
    branch: 'main',
    icon: 'i-elasticApp:astro',
  },
  {
    name: 'elasticApp-nextjs-shadcn',
    label: 'Next.js with shadcn/ui',
    description: 'Next.js template with shadcn/ui components',
    githubRepo: 'thecodacus/elasticApp-nextjs-shadcn-template',
    branch: 'main',
    icon: 'i-elasticApp:nextjs',
  },
  {
    name: 'elasticApp-qwik-ts',
    label: 'Qwik TypeScript',
    description: 'Qwik template with TypeScript',
    githubRepo: 'thecodacus/elasticApp-qwik-ts-template',
    branch: 'main',
    icon: 'i-elasticApp:qwik',
  },
  {
    name: 'elasticApp-remix-ts',
    label: 'Remix TypeScript',
    description: 'Remix template with TypeScript',
    githubRepo: 'thecodacus/elasticApp-remix-ts-template',
    branch: 'main',
    icon: 'i-elasticApp:remix',
  },
  {
    name: 'elasticApp-slidev',
    label: 'Slidev Presentation',
    description: 'Slidev presentation template',
    githubRepo: 'thecodacus/elasticApp-slidev-template',
    branch: 'main',
    icon: 'i-elasticApp:slidev',
  },
  {
    name: 'elasticApp-sveltekit',
    label: 'SvelteKit',
    description: 'SvelteKit template with TypeScript',
    githubRepo: 'elasticApp-sveltekit-template',
    branch: 'main',
    icon: 'i-elasticApp:svelte',
  },
  {
    name: 'vanilla-vite',
    label: 'Vanilla + Vite',
    description: 'Minimal Vite starter template for vanilla JavaScript projects',
    githubRepo: 'thecodacus/vanilla-vite-template',
    tags: ['vite', 'vanilla-js', 'minimal'],
    icon: 'i-elasticApp:vite',
  },
  {
    name: 'elasticApp-vite-react',
    label: 'React + Vite + typescript',
    description: 'Vite + React template with TypeScript',
    githubRepo: 'thecodacus/elasticApp-vite-react-template',
    branch: 'main',
    icon: 'i-elasticApp:vite',
  },
  {
    name: 'elasticApp-vite-ts',
    label: 'Vite + TypeScript',
    description: 'Vite starter template with TypeScript configuration for type-safe development',
    githubRepo: 'thecodacus/elasticApp-vite-ts-template',
    tags: ['vite', 'typescript', 'minimal'],
    icon: 'i-elasticApp:typescript',
  },
  {
    name: 'elasticApp-vue',
    label: 'Vue.js',
    description: 'Vue.js starter template with modern tooling and best practices',
    githubRepo: 'thecodacus/elasticApp-vue-template',
    tags: ['vue', 'typescript', 'frontend'],
    icon: 'i-elasticApp:vue',
  },
  {
    name: 'elasticApp-angular',
    label: 'Angular Starter',
    description: 'A modern Angular starter template with TypeScript support and best practices configuration',
    githubRepo: 'thecodacus/elasticApp-angular-template',
    tags: ['angular', 'typescript', 'frontend', 'spa'],
    icon: 'i-elasticApp:angular',
  },
];
