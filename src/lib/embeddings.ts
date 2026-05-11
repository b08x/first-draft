import { Mistral } from "@mistralai/mistralai";
import { getDb } from "./db";
import { v4 as uuidv4 } from "uuid";
import { IntakeRecord } from "../types";

export async function embedText(text: string, mistralClient: Mistral): Promise<number[]> {
  const response = await mistralClient.embeddings.create({
    model: "mistral-embed",
    inputs: [text],
  });
  return response.data[0].embedding;
}

// --- embed + store feature description ---
export async function seedSessionContext(sessionId: string, intakeRecord: IntakeRecord, mistralClient: Mistral, db: any) {
  // Store meta
  await db.query("INSERT INTO session_meta (session_id, mode, kit_id, provider_id, model_id, created_at) VALUES ($1, $2, $3, $4, $5, $6)", [
    sessionId,
    intakeRecord.mode,
    intakeRecord.kit_id,
    intakeRecord.provider_id,
    intakeRecord.model_id,
    intakeRecord.timestamp
  ]);

  // Embed feature description and suggested prompt for initial context
  const descEmbedding = await embedText(intakeRecord.feature_description, mistralClient);
  const promptEmbedding = await embedText(intakeRecord.suggested_example_prompt, mistralClient);

  const descId = uuidv4();
  const promptId = uuidv4();

  const descVec = `[${descEmbedding.join(",")}]`;
  const promptVec = `[${promptEmbedding.join(",")}]`;

  await db.query("INSERT INTO sections (id, session_id, title, body, embedding) VALUES ($1, $2, $3, $4, $5)", [
    descId, sessionId, "Initial Context: Feature Description", intakeRecord.feature_description, descVec
  ]);

  await db.query("INSERT INTO sections (id, session_id, title, body, embedding) VALUES ($1, $2, $3, $4, $5)", [
    promptId, sessionId, "Initial Context: Suggested Prompt", intakeRecord.suggested_example_prompt, promptVec
  ]);
}

// --- section write-back ---
export async function storePRDSection(sessionId: string, section: { title: string, body: string }, mistralClient: Mistral, db: any) {
  const embedding = await embedText(section.body, mistralClient);
  const id = uuidv4();
  
  const vecString = `[${embedding.join(",")}]`;

  await db.query("INSERT INTO sections (id, session_id, title, body, embedding) VALUES ($1, $2, $3, $4, $5)", [
    id, sessionId, section.title, section.body, vecString
  ]);
  
  return id;
}

// --- retrieval ---
export async function retrieveRelevantSections(sessionId: string, query: string, mistralClient: Mistral, db: any, limit = 5) {
  const queryEmbedding = await embedText(query, mistralClient);
  const queryStr = `[${queryEmbedding.join(",")}]`;

  const results = await db.query(
    "SELECT id, title, body FROM sections WHERE session_id = $1 ORDER BY embedding <=> $2 LIMIT $3",
    [sessionId, queryStr, limit]
  );
  
  return results.rows;
}

