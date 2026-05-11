export type Mode = "PRD" | "Refine" | "Plan" | "Screencast";

export interface SessionMeta {
  session_id: string;
  mode: Mode;
  kit_id: string | null;
  provider_id: string | null;
  model_id: string | null;
  created_at: string;
}

export interface PRDSection {
  id: string;
  session_id: string;
  title: string;
  body: string;
  embedding?: number[];
  created_at: string;
}

export interface IntakeRecord {
  session_id: string;
  timestamp: string;
  feature_description: string;
  kit_id: string | null;
  kit_confidence: number;
  mode: Mode;
  scope: "new" | "existing";
  field: string;
  stack_additions: string[];
  provider_id: string | null;
  model_id: string | null;
  notes: string;
  suggested_example_prompt: string;
}

export interface AuditFinding {
  section: string;
  finding: string;
  severity: "error" | "warning" | "info";
  confidence: number;
  suggestion: string | null;
}

export interface ValidationReport {
  session_id: string;
  audit_timestamp: string;
  overall_confidence: number;
  pass: boolean;
  findings: AuditFinding[];
  summary: string;
}

export interface ProviderAudit {
  provider_id: string;
  model_id: string;
  target_env: "browser" | "server" | "edge";
  cors_safe: boolean;
  cors_resolution: string | null;
  fallback_provider: string;
  fallback_model: string;
  model_suitability: string;
  required_headers: Record<string, string>;
  warnings: string[];
  ready: boolean;
}

export interface StarterKit {
  id: string;
  name: string;
  stack: string[];
  score: number;
}

export const STARTER_KITS: StarterKit[] = [
  { id: "llm-agent", name: "RubyLLM · Ohm/Redis · circuit_breaker", stack: ["rubyllm", "ohm", "redis", "circuit_breaker"], score: 0.96 },
  { id: "async-pipeline", name: "falcon · async · ruby_llm-mcp", stack: ["falcon", "async", "ruby_llm-mcp"], score: 0.91 },
  { id: "dspy-prompt", name: "dspy.rb · Sorbet · DSPy", stack: ["dspy.rb", "sorbet", "dspy"], score: 0.87 },
  { id: "nlp-semantic", name: "ruby-spacy · pgvector · RubyPKG", stack: ["ruby-spacy", "pgvector", "rubypkg"], score: 0.84 },
  { id: "dag-workflow", name: "gush · parallel · falcon", stack: ["gush", "parallel", "falcon"], score: 0.81 },
  { id: "audio-lemur", name: "assemblyai · RubyLLM · async", stack: ["assemblyai", "rubyllm", "async"], score: 0.78 },
  { id: "mcp-agent", name: "ruby_llm-mcp · rooibos · RubyLLM", stack: ["ruby_llm-mcp", "rooibos", "rubyllm"], score: 0.74 },
  { id: "tui-agent", name: "rooibos · dspy.rb · RubyLLM", stack: ["rooibos", "dspy.rb", "rubyllm"], score: 0.71 },
];
