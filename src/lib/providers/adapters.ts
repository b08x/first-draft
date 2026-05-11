// ── openai.ts ─────────────────────────────────────────────────────────────────
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText, Output } from 'ai';
import { z } from 'zod';
import type { ModelProvider, GenerationPrompt, GenerationResult } from './types';

export const openaiProvider: ModelProvider = {
  id: 'openai',
  name: 'OpenAI',
  supportsDirectBrowser: false,
  models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o3-mini'],
  placeholder: 'sk-...',
  note: null,

  async generate<T extends z.ZodTypeAny = z.ZodNever>(
    prompt: GenerationPrompt<T>, apiKey: string, modelId: string
  ): Promise<GenerationResult<z.infer<T>>> {
    const client = createOpenAI({ apiKey });
    const { text, experimental_output } = await generateText({
      model: client(modelId),
      system: prompt.system,
      prompt: prompt.user,
      ...(prompt.schema ? { experimental_output: Output.object({ schema: prompt.schema }) } : {}),
    });
    return { text, object: experimental_output as z.infer<T> };
  },

  async *stream(prompt: GenerationPrompt, apiKey: string, modelId: string) {
    const client = createOpenAI({ apiKey });
    const { textStream } = streamText({ model: client(modelId), system: prompt.system, prompt: prompt.user });
    for await (const chunk of textStream) yield chunk;
  },
};


// ── google.ts ─────────────────────────────────────────────────────────────────
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export const googleProvider: ModelProvider = {
  id: 'google',
  name: 'Google Gemini',
  supportsDirectBrowser: false,
  models: ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro'],
  placeholder: 'AIza...',
  note: null,

  async generate<T extends z.ZodTypeAny = z.ZodNever>(
    prompt: GenerationPrompt<T>, apiKey: string, modelId: string
  ): Promise<GenerationResult<z.infer<T>>> {
    const client = createGoogleGenerativeAI({ apiKey });
    const { text, experimental_output } = await generateText({
      model: client(modelId),
      system: prompt.system,
      prompt: prompt.user,
      ...(prompt.schema ? { experimental_output: Output.object({ schema: prompt.schema }) } : {}),
    });
    return { text, object: experimental_output as z.infer<T> };
  },

  async *stream(prompt: GenerationPrompt, apiKey: string, modelId: string) {
    const client = createGoogleGenerativeAI({ apiKey });
    const { textStream } = streamText({ model: client(modelId), system: prompt.system, prompt: prompt.user });
    for await (const chunk of textStream) yield chunk;
  },
};


// ── mistral.ts ────────────────────────────────────────────────────────────────
import { createMistral } from '@ai-sdk/mistral';

export const mistralProvider: ModelProvider = {
  id: 'mistral',
  name: 'Mistral',
  supportsDirectBrowser: false,
  models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
  placeholder: '...',
  note: null,

  async generate<T extends z.ZodTypeAny = z.ZodNever>(
    prompt: GenerationPrompt<T>, apiKey: string, modelId: string
  ): Promise<GenerationResult<z.infer<T>>> {
    const client = createMistral({ apiKey });
    const { text, experimental_output } = await generateText({
      model: client(modelId),
      system: prompt.system,
      prompt: prompt.user,
      ...(prompt.schema ? { experimental_output: Output.object({ schema: prompt.schema }) } : {}),
    });
    return { text, object: experimental_output as z.infer<T> };
  },

  async *stream(prompt: GenerationPrompt, apiKey: string, modelId: string) {
    const client = createMistral({ apiKey });
    const { textStream } = streamText({ model: client(modelId), system: prompt.system, prompt: prompt.user });
    for await (const chunk of textStream) yield chunk;
  },
};


// ── openrouter.ts ─────────────────────────────────────────────────────────────
// supportsDirectBrowser: true — CORS-safe, default fallback provider
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

export const openrouterProvider: ModelProvider = {
  id: 'openrouter',
  name: 'OpenRouter',
  supportsDirectBrowser: true,
  models: [
    'google/gemini-2.0-flash-001',
    'meta-llama/llama-3.3-70b-instruct',
    'anthropic/claude-3.5-sonnet',
    'mistralai/mistral-large',
    'deepseek/deepseek-r1',
  ],
  placeholder: 'sk-or-...',
  note: 'Recommended default — CORS-safe in browser.',

  async generate<T extends z.ZodTypeAny = z.ZodNever>(
    prompt: GenerationPrompt<T>, apiKey: string, modelId: string
  ): Promise<GenerationResult<z.infer<T>>> {
    const client = createOpenRouter({
      apiKey,
      headers: {
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
        'X-Title': 'ruby-genai-prd',
      },
    });
    const { text, experimental_output } = await generateText({
      model: client(modelId),
      system: prompt.system,
      prompt: prompt.user,
      ...(prompt.schema ? { experimental_output: Output.object({ schema: prompt.schema }) } : {}),
    });
    return { text, object: experimental_output as z.infer<T> };
  },

  async *stream(prompt: GenerationPrompt, apiKey: string, modelId: string) {
    const client = createOpenRouter({
      apiKey,
      headers: {
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
        'X-Title': 'ruby-genai-prd',
      },
    });
    const { textStream } = streamText({ model: client(modelId), system: prompt.system, prompt: prompt.user });
    for await (const chunk of textStream) yield chunk;
  },
};


// ── ollama.ts ─────────────────────────────────────────────────────────────────
// supportsDirectBrowser: true — local inference, no API key required
import { createOllama } from 'ollama-ai-provider';

export const ollamaProvider: ModelProvider = {
  id: 'ollama',
  name: 'Ollama (local)',
  supportsDirectBrowser: true,
  models: ['llama3.2', 'mistral', 'codellama', 'qwen2.5-coder', 'gemma3'],
  placeholder: 'no key required',
  note: 'Local inference — Ollama must be running on localhost:11434.',

  async generate<T extends z.ZodTypeAny = z.ZodNever>(
    prompt: GenerationPrompt<T>, _apiKey: string, modelId: string
  ): Promise<GenerationResult<z.infer<T>>> {
    const client = createOllama({ baseURL: 'http://localhost:11434/api' });
    const { text, experimental_output } = await generateText({
      model: client(modelId) as any,
      system: prompt.system,
      prompt: prompt.user,
      ...(prompt.schema ? { experimental_output: Output.object({ schema: prompt.schema }) } : {}),
    });
    return { text, object: experimental_output as z.infer<T> };
  },

  async *stream(prompt: GenerationPrompt, _apiKey: string, modelId: string) {
    const client = createOllama({ baseURL: 'http://localhost:11434/api' });
    const { textStream } = streamText({ model: client(modelId) as any, system: prompt.system, prompt: prompt.user });
    for await (const chunk of textStream) yield chunk;
  },
};


// ── huggingface.ts ────────────────────────────────────────────────────────────
import { createHuggingFace } from '@ai-sdk/huggingface';

export const huggingfaceProvider: ModelProvider = {
  id: 'huggingface',
  name: 'Hugging Face',
  supportsDirectBrowser: false,
  models: [
    'meta-llama/Meta-Llama-3.1-8B-Instruct',
    'mistralai/Mistral-7B-Instruct-v0.3',
    'Qwen/Qwen2.5-Coder-32B-Instruct',
  ],
  placeholder: 'hf_...',
  note: 'Free tier: 1000 req/day. Requires proxy in browser.',

  async generate<T extends z.ZodTypeAny = z.ZodNever>(
    prompt: GenerationPrompt<T>, apiKey: string, modelId: string
  ): Promise<GenerationResult<z.infer<T>>> {
    const client = createHuggingFace({ apiKey });
    const { text, experimental_output } = await generateText({
      model: client(modelId) as any,
      system: prompt.system,
      prompt: prompt.user,
      ...(prompt.schema ? { experimental_output: Output.object({ schema: prompt.schema }) } : {}),
    });
    return { text, object: experimental_output as z.infer<T> };
  },

  async *stream(prompt: GenerationPrompt, apiKey: string, modelId: string) {
    const client = createHuggingFace({ apiKey });
    const { textStream } = streamText({ model: client(modelId) as any, system: prompt.system, prompt: prompt.user });
    for await (const chunk of textStream) yield chunk;
  },
};
