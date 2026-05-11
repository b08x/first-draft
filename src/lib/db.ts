import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";

let db: PGlite | null = null;

export async function initDb() {
  if (db) return db;
  db = new PGlite({
    extensions: {
      vector,
    },
  });
  
  await db.exec(`
    CREATE EXTENSION IF NOT EXISTS vector;

    CREATE TABLE IF NOT EXISTS session_meta (
      session_id TEXT PRIMARY KEY,
      mode TEXT,
      kit_id TEXT,
      provider_id TEXT,
      model_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      title TEXT,
      body TEXT,
      embedding vector(1024),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(session_id) REFERENCES session_meta(session_id)
    );
  `);
  
  return db;
}

export function getDb() {
  return db;
}

