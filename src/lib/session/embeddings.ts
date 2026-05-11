import { Mistral } from '@mistralai/mistralai';

const EMBED_MODEL = 'mistral-embed';

// ── Single text embed ─────────────────────────────────────────────────────────
export async function embedText(text: string, apiKey: string): Promise<number[]> {
  const client = new Mistral({ apiKey });
  const res = await client.embeddings.create({
    model: EMBED_MODEL,
    inputs: [text],
  });
  return res.data[0].embedding as number[];
}

// ── Batch embed (parallel, max 32 per call) ───────────────────────────────────
export async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  const BATCH = 32;
  const results: number[][] = [];
  const client = new Mistral({ apiKey });

  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const res = await client.embeddings.create({ model: EMBED_MODEL, inputs: slice });
    results.push(...res.data.map((d) => d.embedding as number[]));
  }
  return results;
}

// ── Cosine similarity (client-side fallback, no DB needed) ────────────────────
export function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}
