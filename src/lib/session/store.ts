import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';

export type SessionDB = PGlite;

export interface StoredSection {
  id: string;
  session_id: string;
  title: string;
  body: string;
  context_type: string;
  tool_id: string;
  doc_version: number;
  embedding: number[] | null;
  created_at: string;
}

const CONTEXT_TYPE_MAP: Record<string, string> = {
  'overview':               'intent',
  'goals':                  'intent',
  'user stories':           'requirement',
  'technical requirements': 'requirement',
  'architecture notes':     'constraint',
  'stack justification':    'decision',
  'open questions':         'risk',
  'milestones':             'milestone',
  'task breakdown':         'milestone',
  'risk assessment':        'risk',
  'gap analysis':           'risk',
  'proposed improvements':  'requirement',
  'usage':                  'example',
  'installation':           'example',
  'decision':               'decision',
  'consequences':           'constraint',
  'alternatives':           'decision',
};

export function inferContextType(title: string): string {
  const key = title.toLowerCase().trim();
  for (const [pattern, type] of Object.entries(CONTEXT_TYPE_MAP)) {
    if (key.includes(pattern)) return type;
  }
  return 'requirement'; // default
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
export async function initSessionStore(): Promise<SessionDB> {
  const db = await PGlite.create({ extensions: { vector } });

  await db.exec(`
    CREATE EXTENSION IF NOT EXISTS vector;

    CREATE TABLE IF NOT EXISTS session_meta (
      session_id   TEXT PRIMARY KEY,
      mode         TEXT,
      kit_id       TEXT,
      provider_id  TEXT,
      model_id     TEXT,
      created_at   TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS sections (
      id           TEXT PRIMARY KEY,
      session_id   TEXT NOT NULL,
      title        TEXT,
      body         TEXT,
      context_type TEXT DEFAULT 'requirement',
      tool_id      TEXT DEFAULT 'prd',
      doc_version  INT DEFAULT 1,
      embedding    vector(1024),
      created_at   TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS sections_session_idx
      ON sections (session_id);
  `);

  return db;
}

// ── Session meta ──────────────────────────────────────────────────────────────
export async function seedSessionMeta(
  db: SessionDB,
  params: {
    session_id: string;
    mode: string;
    kit_id: string | null;
    provider_id: string;
    model_id: string;
  }
): Promise<void> {
  await db.query(
    `INSERT INTO session_meta (session_id, mode, kit_id, provider_id, model_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (session_id) DO UPDATE
       SET mode=$2, kit_id=$3, provider_id=$4, model_id=$5`,
    [params.session_id, params.mode, params.kit_id, params.provider_id, params.model_id]
  );
}

// ── Section write ─────────────────────────────────────────────────────────────
export async function storeSection(
  db: SessionDB,
  params: {
    session_id: string;
    title: string;
    body: string;
    embedding?: number[];
    tool_id?: string;
  }
): Promise<string> {
  const id = crypto.randomUUID();
  const embJson = params.embedding ? JSON.stringify(params.embedding) : null;
  const context_type = inferContextType(params.title);
  const tool_id = params.tool_id || 'prd';
  
  await db.query(
    `INSERT INTO sections (id, session_id, title, body, context_type, tool_id, doc_version, embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, params.session_id, params.title, params.body, context_type, tool_id, 1, embJson]
  );
  return id;
}

// ── Cosine retrieval ──────────────────────────────────────────────────────────
export async function retrieveSections(
  db: SessionDB,
  session_id: string,
  queryEmbedding: number[],
  options: {
    limit?: number;
    context_type?: string;
    tool_id?: string;
  } = {}
): Promise<Pick<StoredSection, 'title' | 'body' | 'context_type'>[]> {
  const { limit = 5, context_type, tool_id } = options;
  const typeFilter = context_type ? `AND context_type = '${context_type}'` : '';
  const toolFilter = tool_id ? `AND tool_id = '${tool_id}'` : '';

  const result = await db.query<Pick<StoredSection, 'title' | 'body' | 'context_type'>>(
    `SELECT title, body, context_type
     FROM sections
     WHERE session_id = $1 ${typeFilter} ${toolFilter}
       AND embedding IS NOT NULL
     ORDER BY embedding <=> $2
     LIMIT $3`,
    [session_id, JSON.stringify(queryEmbedding), limit]
  );
  return result.rows;
}

// ── Clear session ─────────────────────────────────────────────────────────────
export async function clearSession(db: SessionDB, session_id: string): Promise<void> {
  await db.query(`DELETE FROM sections WHERE session_id = $1`, [session_id]);
  await db.query(`DELETE FROM session_meta WHERE session_id = $1`, [session_id]);
}
