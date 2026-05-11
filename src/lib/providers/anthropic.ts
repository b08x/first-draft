import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, streamText, Output } from 'ai';
import { z } from 'zod';
import type { ModelProvider, GenerationPrompt, GenerationResult } from './types';

export const anthropicProvider: ModelProvider = {
  id: 'anthropic',
  name: 'Anthropic',
  supportsDirectBrowser: false,
  models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-5-20251001'],
  placeholder: 'sk-ant-...',
  note: null,

  async generate<T extends z.ZodTypeAny = z.ZodNever>(
    prompt: GenerationPrompt<T>,
    apiKey: string,
    modelId: string
  ): Promise<GenerationResult<z.infer<T>>> {
    const anthropic = createAnthropic({ apiKey });
    const { text, experimental_output } = await generateText({
      model: anthropic(modelId),
      system: prompt.system,
      prompt: prompt.user,
      ...(prompt.schema
        ? { experimental_output: Output.object({ schema: prompt.schema }) }
        : {}),
    });
    return { text, object: experimental_output as z.infer<T> };
  },

  async *stream(prompt: GenerationPrompt, apiKey: string, modelId: string) {
    const anthropic = createAnthropic({ apiKey });
    const { textStream } = streamText({
      model: anthropic(modelId),
      system: prompt.system,
      prompt: prompt.user,
    });
    for await (const chunk of textStream) {
      yield chunk;
    }
  },
};
