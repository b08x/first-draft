import { z } from 'zod';

export interface GenerationPrompt<T extends z.ZodTypeAny = z.ZodNever> {
  system: string;
  user: string;
  schema?: T;
}

export interface GenerationResult<T = unknown> {
  text: string;
  object?: T;
}

export interface ModelProvider {
  id: string;
  name: string;
  supportsDirectBrowser: boolean;
  models: string[];
  placeholder: string;
  note: string | null;
  generate<T extends z.ZodTypeAny = z.ZodNever>(
    prompt: GenerationPrompt<T>,
    apiKey: string,
    modelId: string
  ): Promise<GenerationResult<z.infer<T>>>;
  stream(
    prompt: GenerationPrompt,
    apiKey: string,
    modelId: string
  ): AsyncGenerator<string>;
}
