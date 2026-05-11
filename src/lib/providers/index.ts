import { anthropicProvider } from './anthropic';
import {
  openaiProvider,
  googleProvider,
  mistralProvider,
  openrouterProvider,
  ollamaProvider,
  huggingfaceProvider,
} from './adapters';
import type { ModelProvider } from './types';

export const providers: Record<string, ModelProvider> = {
  anthropic:   anthropicProvider,
  openai:      openaiProvider,
  google:      googleProvider,
  mistral:     mistralProvider,
  openrouter:  openrouterProvider,  // default — supportsDirectBrowser: true
  ollama:      ollamaProvider,      // local    — supportsDirectBrowser: true
  huggingface: huggingfaceProvider,
};

export type { ModelProvider };
export type ProviderId = keyof typeof providers;
