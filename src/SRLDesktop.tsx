import {
  useState, useRef, useCallback, useEffect,
  type CSSProperties, type MouseEvent as RMouseEvent,
} from 'react';
import { providers } from './lib/providers';
import { useSettings } from './lib/context/SettingsContext';
import { initSessionStore, seedSessionMeta, storeSection, type SessionDB } from './lib/session/store';
import { embedText } from './lib/session/embeddings';

// ─────────────────────────────────────────────────────────────────────────────
// THEME
// ─────────────────────────────────────────────────────────────────────────────
const F     = "'IBM Plex Mono','Courier New',monospace";
const DESK  = '#4E7878';
const BAR   = '#8B1A1A';
const CREAM = '#EDE8D0';
const DARK  = '#1A1B2C';
const CTRL  = '#22232E';
const BD    = '#34354A';
const BC    = '#C0B89C';
const TC    = '#1A1A14';
const TD    = '#C8C8B8';
const DIM   = '#60607A';
const GOLD  = '#C8A020';
const WARN  = '#C84020';

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN DATA
// ─────────────────────────────────────────────────────────────────────────────
interface Kit {
  id: string; type: string; name: string; score: number;
  stack: string[]; ex: string;
}
const KITS: Kit[] = [
  { id:'llm-agent',      type:'KIT', name:'Ruby LLM Agent Core',           score:.96, stack:['RubyLLM','Ohm/Redis','circuit_breaker'], ex:'Build an agent that monitors a GitHub repo and summarises new issues using Claude.' },
  { id:'async-pipeline', type:'KIT', name:'Async LLM Pipeline',             score:.91, stack:['falcon','async','ruby_llm-mcp'],         ex:'Concurrent document ingestion pipeline embedding 10k records without blocking.' },
  { id:'dspy-prompt',    type:'KIT', name:'DSPy Prompt Engineering',         score:.87, stack:['dspy.rb','Sorbet','DSPy'],               ex:'Typed RAG chain that auto-optimises retrieval and generation prompts.' },
  { id:'nlp-semantic',   type:'KIT', name:'NLP Semantic Search',             score:.84, stack:['ruby-spacy','pgvector','RubyPKG'],       ex:'Semantic search over corpus with NER, entity dedup, and vector ranking.' },
  { id:'dag-workflow',   type:'KIT', name:'DAG Workflow Orchestration',      score:.81, stack:['gush','parallel','falcon'],              ex:'Research pipeline that fans out searches in parallel and synthesises results.' },
  { id:'audio-lemur',    type:'KIT', name:'Audio Intelligence + LeMUR',      score:.78, stack:['assemblyai','RubyLLM','async'],          ex:'Meeting intelligence tool: transcribe calls, extract action items, generate briefs.' },
  { id:'mcp-agent',      type:'KIT', name:'MCP Remote Agent',                score:.74, stack:['ruby_llm-mcp','rooibos','RubyLLM'],     ex:'Claude agent that reads/writes local files and reports status via rooibos TUI.' },
  { id:'tui-agent',      type:'KIT', name:'Terminal UI Agent (rooibos MVU)', score:.71, stack:['rooibos','dspy.rb','RubyLLM'],          ex:'Interactive CLI coding assistant with streaming output and typed prompt modules.' },
];
const FIELDS = ['Neuro-Symbolic Integration','Agent Architecture','Prompt Engineering','Async Patterns','NLP Pipeline','Vector Search','Audio Intelligence','MCP Integration'];
const MODES  = ['PRD','Refine','Plan','Screencast'] as const;
const STACKS = ['RubyLLM','dspy.rb','falcon','async','gush','parallel','circuit_breaker','rooibos','ruby_llm-mcp','pgvector','Ohm/Redis','ruby-spacy','assemblyai','RubyPKG','Sorbet','CrewAI'];

type Mode = typeof MODES[number];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION PARSER
// ─────────────────────────────────────────────────────────────────────────────
export interface PRDSection {
  slug: string; title: string; body: string; filename: string; bytes: number;
}

function parseSections(raw: string): PRDSection[] {
  const lines = raw.split('\n');
  const buckets: { title: string; lines: string[] }[] = [];
  let cur: { title: string; lines: string[] } | null = null;
  for (const line of lines) {
    const m = line.match(/^(#{1,3}) (.+)/);
    if (m) { if (cur) buckets.push(cur); cur = { title: m[2].trim(), lines: [line] }; }
    else   { if (!cur) cur = { title: 'Preamble', lines: [] }; cur.lines.push(line); }
  }
  if (cur) buckets.push(cur);
  if (buckets.length < 2) {
    const paras = raw.split(/\n{2,}/).filter(p => p.trim().length > 20);
    const sz = Math.ceil(paras.length / 5) || 1;
    return Array.from({ length: Math.ceil(paras.length / sz) }, (_, i) =>
      mkSec(`section_${i + 1}`, `Section ${i + 1}`, paras.slice(i * sz, (i + 1) * sz).join('\n\n'), i)
    );
  }
  return buckets.map((b, i) => {
    const slug = b.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32);
    return mkSec(slug, b.title, b.lines.join('\n').trim(), i);
  });
}
function mkSec(slug: string, title: string, body: string, i: number): PRDSection {
  return { slug, title, body, filename: `${String(i).padStart(2, '0')}_${slug}.md`, bytes: new TextEncoder().encode(body).length };
}
function fmtSize(b: number): string { return b < 1024 ? `${b}b` : `${(b / 1024).toFixed(1)}kb`; }

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI ATOMS
// ─────────────────────────────────────────────────────────────────────────────
const TYPE_COLOR: Record<string, { bg: string; tx: string; bd: string }> = {
  KIT:  { bg:'#1A3A20', tx:'#60D088', bd:'#204828' },
  NOTE: { bg:'#1A2858', tx:'#6090D0', bd:'#203080' },
};

function Badge({ type }: { type: string }) {
  const c = TYPE_COLOR[type] ?? TYPE_COLOR.NOTE;
  return <span style={{ fontFamily:F,fontSize:9,fontWeight:700,padding:'1px 5px',background:c.bg,color:c.tx,border:`1px solid ${c.bd}`,borderRadius:2,letterSpacing:1 }}>{type}</span>;
}

const TAG_COLS: Record<string, { bg: string; tx: string; bd: string }> = {
  blue:   { bg:'#1A3A60', tx:'#70B0E8', bd:'#204888' },
  orange: { bg:'#3A1E00', tx:'#D09050', bd:'#602800' },
  green:  { bg:'#1A3A1A', tx:'#60C070', bd:'#1E5020' },
  red:    { bg:'#3A0A0A', tx:'#D06050', bd:'#601010' },
};
function Tag({ label, color }: { label: string; color: keyof typeof TAG_COLS }) {
  const c = TAG_COLS[color] ?? TAG_COLS.blue;
  return <span style={{ fontFamily:F,fontSize:9,fontWeight:700,padding:'2px 8px',background:c.bg,color:c.tx,border:`1px solid ${c.bd}`,borderRadius:2,letterSpacing:1 }}>{label}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// WIN CHROME
// ─────────────────────────────────────────────────────────────────────────────
interface WinProps {
  title: string; bg: string; w: number;
  pos: { x: number; y: number }; zIdx: number;
  onTitleDown: (e: RMouseEvent<HTMLDivElement>) => void;
  onFocus: () => void;
  children: React.ReactNode;
  badge?: string;
}
function Win({ title, bg, w, pos, zIdx, onTitleDown, onFocus, children, badge }: WinProps) {
  return (
    <div onMouseDown={onFocus} style={{ position:'absolute',left:pos.x,top:pos.y,width:w,zIndex:zIdx,border:`1px solid ${BAR}`,boxShadow:'2px 2px 0 rgba(0,0,0,0.5)' }}>
      <div onMouseDown={onTitleDown} style={{ background:BAR,padding:'3px 8px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'move',userSelect:'none',borderBottom:'1px solid #6A0E0E' }}>
        <span style={{ fontFamily:F,fontSize:10,color:'#fff',letterSpacing:1.5,fontWeight:700 }}>{title}</span>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          {badge && <span style={{ fontFamily:F,fontSize:9,color:GOLD,letterSpacing:1 }}>{badge}</span>}
          <span style={{ fontFamily:F,fontSize:10,color:'rgba(255,255,255,0.4)',letterSpacing:2 }}>□ □ ×</span>
        </div>
      </div>
      <div style={{ background:bg,overflow:'hidden' }}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER.CFG
// ─────────────────────────────────────────────────────────────────────────────
interface ProviderCfgProps {
  pos: { x: number; y: number }; zIdx: number;
  onTitleDown: (e: RMouseEvent<HTMLDivElement>) => void;
  onFocus: () => void;
}
function ProviderCfg({ pos, zIdx, onTitleDown, onFocus }: ProviderCfgProps) {
  const { providerId, modelId, apiKeys, setProvider, setModel, setApiKey } = useSettings();
  const p   = providers[providerId];
  const key = apiKeys[providerId] ?? '';
  const safe = p.supportsDirectBrowser;

  return (
    <Win title="PROVIDER.CFG" bg={CTRL} w={290} pos={pos} zIdx={zIdx} onTitleDown={onTitleDown} onFocus={onFocus}>
      <div style={{ fontFamily:F }}>
        {!safe && (
          <div style={{ padding:'6px 12px',borderBottom:`1px solid #4A1A0A`,background:'#1E0A04',display:'flex',gap:8,alignItems:'flex-start' }}>
            <span style={{ color:WARN,fontSize:11,marginTop:1 }}>⚠</span>
            <span style={{ fontSize:9,color:'#C07060',lineHeight:1.5 }}>
              {p.name} requires a proxy in production browsers.<br/>
              <span style={{ color:DIM }}>Use OpenRouter for direct browser calls.</span>
            </span>
          </div>
        )}
        {safe && (
          <div style={{ padding:'5px 12px',borderBottom:`1px solid #0A2A14`,background:'#061408',display:'flex',gap:6,alignItems:'center' }}>
            <span style={{ color:'#40C060',fontSize:10 }}>✓</span>
            <span style={{ fontSize:9,color:'#40A050' }}>CORS-safe · direct browser calls enabled</span>
          </div>
        )}
        <div style={{ padding:'6px 0',borderBottom:`1px solid ${BD}` }}>
          <div style={{ padding:'0 12px 4px',fontSize:9,color:DIM,letterSpacing:2 }}>· PROVIDER</div>
          {Object.values(providers).map((pr: any) => (
            <div key={pr.id} onClick={() => setProvider(pr.id)}
              style={{ padding:'4px 12px',cursor:'pointer',fontSize:11,display:'flex',alignItems:'center',gap:6,background:providerId===pr.id?'#1A3A68':'transparent',color:providerId===pr.id?'#70A8E0':TD,borderLeft:providerId===pr.id?'2px solid #3060A8':'2px solid transparent' }}>
              {providerId===pr.id && <span style={{ fontSize:9 }}>►</span>}
              <span style={{ flex:1 }}>{pr.name}</span>
              <span style={{ fontSize:9,color:pr.supportsDirectBrowser?'#40C060':'#804030',letterSpacing:1 }}>
                {pr.supportsDirectBrowser?'DIRECT':'PROXY'}
              </span>
            </div>
          ))}
        </div>
        <div style={{ padding:'6px 0',borderBottom:`1px solid ${BD}` }}>
          <div style={{ padding:'0 12px 4px',fontSize:9,color:DIM,letterSpacing:2 }}>· MODEL</div>
          {p.models.map(m => (
            <div key={m} onClick={() => setModel(m)}
              style={{ padding:'3px 12px',cursor:'pointer',fontSize:10,background:modelId===m?'#1A2848':'transparent',color:modelId===m?'#90B8E0':DIM,borderLeft:modelId===m?'2px solid #203860':'2px solid transparent',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
              {m}
            </div>
          ))}
        </div>
        <div style={{ padding:'8px 12px' }}>
          <div style={{ fontSize:9,color:DIM,letterSpacing:2,marginBottom:5 }}>· API KEY</div>
          {providerId === 'ollama' ? (
            <div style={{ fontSize:10,color:'#40A050',padding:'4px 0' }}>No key required — local inference</div>
          ) : (
            <input type="password" value={key} onChange={e => setApiKey(providerId, e.target.value)}
              placeholder={p.placeholder}
              style={{ width:'100%',background:'rgba(255,255,255,0.04)',border:`1px solid ${BD}`,fontFamily:F,fontSize:10,color:TD,padding:'5px 8px',outline:'none',boxSizing:'border-box' as CSSProperties['boxSizing'] }} />
          )}
          <div style={{ fontSize:9,color:DIM,marginTop:5 }}>
            {p.note ?? 'Stored in sessionStorage — cleared on tab close.'}
          </div>
        </div>
      </div>
    </Win>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT.NOTE
// ─────────────────────────────────────────────────────────────────────────────
interface PromptNoteProps {
  pos: { x: number; y: number }; zIdx: number;
  onTitleDown: (e: RMouseEvent<HTMLDivElement>) => void; onFocus: () => void;
  prompt: string; setPrompt: (v: string) => void;
  mode: Mode; setMode: (m: Mode) => void;
  scope: string; setScope: (s: string) => void;
  selectedKit: Kit | null;
  onGenerate: () => void; generating: boolean;
}
function PromptNote({ pos,zIdx,onTitleDown,onFocus,prompt,setPrompt,mode,setMode,scope,setScope,selectedKit,onGenerate,generating }: PromptNoteProps) {
  const { providerId, modelId } = useSettings();
  const p = providers[providerId];
  return (
    <Win title="PROMPT.NOTE" bg={CREAM} w={400} pos={pos} zIdx={zIdx} onTitleDown={onTitleDown} onFocus={onFocus}>
      <div style={{ padding:'14px 16px 10px',fontFamily:F }}>
        <div style={{ display:'flex',gap:12,alignItems:'baseline',marginBottom:6 }}>
          <span style={{ fontSize:9,color:'#888880',letterSpacing:2 }}>NOTE</span>
          <span style={{ fontSize:9,color:'#888880' }}>{new Date().toISOString().slice(0,10)}</span>
          <span style={{ fontSize:9,color:BAR,letterSpacing:1 }}>RUBY·GENAI</span>
        </div>
        <div style={{ fontSize:22,fontWeight:700,color:TC,letterSpacing:-1,lineHeight:1.1,marginBottom:4 }}>Ruby GenAI PRD</div>
        <div style={{ fontSize:11,color:BAR,marginBottom:8 }}>× {mode}</div>
        <div style={{ display:'flex',gap:6,marginBottom:8,flexWrap:'wrap' }}>
          <Tag label={`FIELD: ${selectedKit ? 'KIT·ACTIVE' : 'UNSET'}`} color="blue" />
          <Tag label={`MODE: ${mode}`} color="green" />
          <Tag label={`SCOPE: ${scope}`} color="orange" />
          <Tag label={`VIA: ${p.name}`} color={p.supportsDirectBrowser ? 'green' : 'red'} />
        </div>
        <div style={{ fontSize:9,color:DIM,letterSpacing:.5,marginBottom:8,padding:'3px 8px',border:`1px solid ${BC}`,background:'rgba(0,0,0,0.04)',display:'inline-block' }}>
          {modelId}
        </div>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
          placeholder={'Describe your Ruby AI feature…\n\ne.g. Build an async agent that monitors Slack, extracts action items via NER, and writes summaries to Redis.'}
          style={{ width:'100%',height:100,padding:'8px 10px',background:'rgba(0,0,0,0.04)',border:`1px solid ${BC}`,outline:'none',fontFamily:F,fontSize:12,color:TC,resize:'none',lineHeight:1.6,boxSizing:'border-box' as CSSProperties['boxSizing'] }} />
        {selectedKit && (
          <div style={{ marginTop:6,padding:'6px 10px',background:'rgba(0,0,0,0.06)',border:`1px solid ${BC}` }}>
            <div style={{ fontSize:9,color:'#888',letterSpacing:2 }}>KIT·CONTEXT</div>
            <div style={{ fontSize:11,color:'#554438',marginTop:2 }}>{selectedKit.name} · {selectedKit.stack.join(' · ')}</div>
          </div>
        )}
        <div style={{ display:'flex',alignItems:'center',gap:0,marginTop:8,borderTop:`1px solid ${BC}`,paddingTop:8 }}>
          <div style={{ display:'flex',gap:3,flex:1 }}>
            {MODES.map(m => (
              <button key={m} onClick={() => setMode(m)} style={{ fontFamily:F,fontSize:10,padding:'4px 8px',cursor:'pointer',background:mode===m?'#1A3A60':'transparent',color:mode===m?'#70B0E8':DIM,border:`1px solid ${mode===m?'#204888':BC}`,letterSpacing:1 }}>{m}</button>
            ))}
          </div>
          <button onClick={onGenerate} disabled={generating || !prompt.trim()}
            style={{ fontFamily:F,fontSize:11,padding:'4px 14px',cursor:generating||!prompt.trim()?'not-allowed':'pointer',background:generating?'#1A1A14':BAR,color:'#fff',border:'none',letterSpacing:1,opacity:generating||!prompt.trim()?0.5:1 }}>
            {generating ? 'GEN…' : '→ GEN'}
          </button>
        </div>
        <div style={{ display:'flex',gap:3,marginTop:6 }}>
          {['new','existing'].map(s => (
            <button key={s} onClick={() => setScope(s)}
              style={{ fontFamily:F,fontSize:9,padding:'3px 10px',cursor:'pointer',letterSpacing:2,background:scope===s?'#4A1A00':'transparent',color:scope===s?'#E07040':DIM,border:`1px solid ${scope===s?'#702400':BC}`,textTransform:'uppercase' }}>{s}</button>
          ))}
        </div>
      </div>
    </Win>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CK --SEM
// ─────────────────────────────────────────────────────────────────────────────
interface KitSemProps {
  pos: { x: number; y: number }; zIdx: number;
  onTitleDown: (e: RMouseEvent<HTMLDivElement>) => void; onFocus: () => void;
  selectedKit: Kit | null; onSelectKit: (k: Kit) => void;
}
function KitSem({ pos,zIdx,onTitleDown,onFocus,selectedKit,onSelectKit }: KitSemProps) {
  const [q, setQ] = useState('');
  const filtered = q ? KITS.filter(k => k.name.toLowerCase().includes(q.toLowerCase()) || k.stack.some(s => s.toLowerCase().includes(q.toLowerCase()))) : KITS;
  return (
    <Win title="CK ──SEM" bg={DARK} w={360} pos={pos} zIdx={zIdx} onTitleDown={onTitleDown} onFocus={onFocus}>
      <div style={{ fontFamily:F }}>
        <div style={{ padding:'6px 10px',borderBottom:`1px solid ${BD}`,fontSize:10,color:DIM,letterSpacing:1 }}>ck ──sem · QUERY</div>
        <div style={{ padding:'6px 10px',borderBottom:`1px solid ${BD}`,display:'flex',gap:6 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="filter kits…"
            style={{ flex:1,background:'rgba(255,255,255,0.05)',border:`1px solid ${BD}`,fontFamily:F,fontSize:11,color:TD,padding:'4px 8px',outline:'none' }} />
          <span style={{ fontSize:9,color:DIM,letterSpacing:1,alignSelf:'center' }}>⌘K</span>
        </div>
        <div style={{ maxHeight:230,overflowY:'auto' }}>
          {filtered.map(kit => {
            const active = selectedKit?.id === kit.id;
            const sc = kit.score >= .9 ? GOLD : kit.score >= .8 ? '#A89040' : DIM;
            return (
              <div key={kit.id} onClick={() => onSelectKit(kit)}
                style={{ padding:'7px 12px',borderBottom:`1px solid ${BD}`,background:active?'rgba(30,90,173,0.2)':'transparent',cursor:'pointer',display:'flex',alignItems:'center',gap:8 }}>
                <Badge type={kit.type} />
                <span style={{ flex:1,fontSize:11,color:active?'#A0C8F0':TD }}>{kit.name}</span>
                <span style={{ fontSize:11,color:sc,fontWeight:700,minWidth:28,textAlign:'right' }}>{kit.score.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
        <div style={{ padding:'4px 10px',borderTop:`1px solid ${BD}`,display:'flex',justifyContent:'space-between',background:'rgba(0,0,0,0.2)' }}>
          <span style={{ fontSize:9,color:DIM,letterSpacing:1 }}>{filtered.length} RESULTS · ruby-genai</span>
          <span style={{ fontSize:9,color:DIM }}>idx: 8kit · 847n</span>
        </div>
        {selectedKit && (
          <div style={{ padding:'8px 12px',borderTop:`1px solid ${BD}`,background:'rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize:9,color:DIM,letterSpacing:2,marginBottom:4 }}>SELECTED · CONTEXT</div>
            <div style={{ fontSize:10,color:'#80C0A0',lineHeight:1.6 }}>{selectedKit.ex}</div>
            <div style={{ marginTop:4,display:'flex',gap:4,flexWrap:'wrap' }}>
              {selectedKit.stack.map(s => <span key={s} style={{ fontSize:9,padding:'1px 6px',border:'1px solid #204030',background:'#0A1810',color:'#50A060' }}>{s}</span>)}
            </div>
          </div>
        )}
      </div>
    </Win>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SRL.CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────
interface ControllerProps {
  pos: { x: number; y: number }; zIdx: number;
  onTitleDown: (e: RMouseEvent<HTMLDivElement>) => void; onFocus: () => void;
  selectedField: string; setField: (f: string) => void;
  selectedStack: string[]; toggleStack: (s: string) => void;
}
function Controller({ pos,zIdx,onTitleDown,onFocus,selectedField,setField,selectedStack,toggleStack }: ControllerProps) {
  return (
    <Win title="SRL.CONTROLLER" bg={CTRL} w={255} pos={pos} zIdx={zIdx} onTitleDown={onTitleDown} onFocus={onFocus}>
      <div style={{ fontFamily:F,padding:'6px 0' }}>
        <div style={{ padding:'0 12px 5px',borderBottom:`1px solid ${BD}` }}>
          <div style={{ fontSize:9,color:DIM,letterSpacing:2,marginBottom:5,paddingTop:2 }}>· FIELD</div>
          {FIELDS.map(f => (
            <div key={f} onClick={() => setField(f)}
              style={{ padding:'3px 10px',cursor:'pointer',fontSize:11,background:selectedField===f?'#1A3A68':'transparent',color:selectedField===f?'#70A8E0':TD,borderLeft:selectedField===f?'2px solid #3060A8':'2px solid transparent',display:'flex',alignItems:'center',gap:6 }}>
              {selectedField===f && <span style={{ fontSize:9 }}>►</span>}{f}
            </div>
          ))}
        </div>
        <div style={{ padding:'5px 12px',borderBottom:`1px solid ${BD}` }}>
          <div style={{ fontSize:9,color:DIM,letterSpacing:2,marginBottom:5 }}>· STACK</div>
          <div style={{ display:'flex',flexWrap:'wrap',gap:4 }}>
            {STACKS.map(s => {
              const on = selectedStack.includes(s);
              return <span key={s} onClick={() => toggleStack(s)} style={{ fontSize:9,padding:'2px 6px',cursor:'pointer',border:`1px solid ${on?'#204830':BD}`,background:on?'#0A2010':'transparent',color:on?'#60C070':DIM }}>{s}</span>;
            })}
          </div>
        </div>
        <div style={{ padding:'5px 12px' }}>
          <div style={{ fontSize:9,color:DIM,letterSpacing:2,marginBottom:5 }}>· MODE</div>
          {MODES.map(m => <div key={m} style={{ padding:'3px 10px',fontSize:11,color:DIM }}>{m}</div>)}
        </div>
      </div>
    </Win>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRD.OUTPUT
// ─────────────────────────────────────────────────────────────────────────────
interface OutputWinProps {
  pos: { x: number; y: number }; zIdx: number;
  onTitleDown: (e: RMouseEvent<HTMLDivElement>) => void; onFocus: () => void;
  text: string; generating: boolean; mode: Mode; selectedKit: Kit | null;
}
function OutputWin({ pos,zIdx,onTitleDown,onFocus,text,generating,mode,selectedKit }: OutputWinProps) {
  const { providerId, modelId } = useSettings();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [text]);
  return (
    <Win title="PRD.OUTPUT" bg={DARK} w={420} pos={pos} zIdx={zIdx} onTitleDown={onTitleDown} onFocus={onFocus}>
      <div style={{ fontFamily:F }}>
        <div style={{ padding:'5px 12px',borderBottom:`1px solid ${BD}`,display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(0,0,0,0.3)' }}>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            <span style={{ width:6,height:6,borderRadius:'50%',display:'inline-block',background:generating?'#20C060':'#3060A8',boxShadow:generating?'0 0 6px #20C060':'none' }} />
            <span style={{ fontSize:9,color:DIM,letterSpacing:1 }}>
              {generating ? 'STREAMING…' : `${mode} · ${providers[providerId]?.name ?? providerId} · ${modelId.split('/').pop()}`}
            </span>
          </div>
          {text && !generating && (
            <button onClick={() => navigator.clipboard.writeText(text)}
              style={{ fontFamily:F,fontSize:9,color:DIM,background:'transparent',border:`1px solid ${BD}`,padding:'1px 6px',cursor:'pointer',letterSpacing:1 }}>COPY ⎘</button>
          )}
        </div>
        <div ref={ref} style={{ padding:'12px 14px',maxHeight:220,overflowY:'auto',fontFamily:F,fontSize:11,color:TD,lineHeight:1.75,whiteSpace:'pre-wrap',wordBreak:'break-word' }}>
          {text || <span style={{ color:DIM }}>awaiting generation…</span>}
          {generating && <span style={{ color:'#3060A8' }}>▋</span>}
        </div>
      </div>
    </Win>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRD.DIR
// ─────────────────────────────────────────────────────────────────────────────
interface FolderWinProps {
  pos: { x: number; y: number }; zIdx: number;
  onTitleDown: (e: RMouseEvent<HTMLDivElement>) => void; onFocus: () => void;
  sections: PRDSection[]; activeFile: PRDSection | null;
  onFileClick: (s: PRDSection) => void; onDownloadAll: () => void;
}
function FolderWin({ pos,zIdx,onTitleDown,onFocus,sections,activeFile,onFileClick,onDownloadAll }: FolderWinProps) {
  const total = sections.reduce((s, f) => s + f.bytes, 0);
  const dlOne = (sec: PRDSection) => {
    const blob = new Blob([sec.body], { type:'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = sec.filename; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <Win title="PRD.DIR" bg={DARK} w={330} pos={pos} zIdx={zIdx} onTitleDown={onTitleDown} onFocus={onFocus} badge={`${sections.length} FILES`}>
      <div style={{ fontFamily:F }}>
        <div style={{ padding:'4px 12px',borderBottom:`1px solid ${BD}`,display:'flex',gap:8,background:'rgba(0,0,0,0.3)' }}>
          <span style={{ fontSize:9,color:DIM,letterSpacing:2,flex:1 }}>NAME</span>
          <span style={{ fontSize:9,color:DIM,width:38,textAlign:'right' }}>SIZE</span>
          <span style={{ width:20 }} />
        </div>
        <div style={{ maxHeight:240,overflowY:'auto' }}>
          {sections.map((sec, i) => {
            const active = activeFile?.filename === sec.filename;
            return (
              <div key={i} onClick={() => onFileClick(sec)}
                style={{ padding:'6px 12px',borderBottom:`1px solid ${BD}`,background:active?'rgba(30,90,173,0.25)':'transparent',cursor:'pointer',display:'flex',alignItems:'center',gap:8 }}>
                <span style={{ fontSize:9,padding:'1px 5px',fontWeight:700,border:'1px solid #384830',background:'#0A1A08',color:'#50A060' }}>MD</span>
                <span style={{ flex:1,fontSize:10,color:active?'#A0C8F0':TD,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{sec.filename}</span>
                <span style={{ fontSize:9,color:DIM,width:38,textAlign:'right' }}>{fmtSize(sec.bytes)}</span>
                <button onClick={e => { e.stopPropagation(); dlOne(sec); }}
                  style={{ fontFamily:F,fontSize:11,padding:'0 5px',lineHeight:'18px',border:`1px solid ${BD}`,background:'transparent',color:'#90C080',cursor:'pointer' }}>↓</button>
              </div>
            );
          })}
        </div>
        <div style={{ padding:'7px 12px',borderTop:`1px solid ${BD}`,display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(0,0,0,0.35)' }}>
          <span style={{ fontSize:9,color:DIM }}>{sections.length} files · {fmtSize(total)}</span>
          <button onClick={onDownloadAll} style={{ fontFamily:F,fontSize:9,padding:'4px 14px',letterSpacing:1,border:'1px solid #4A3800',background:'#1A1200',color:GOLD,cursor:'pointer' }}>↓ BUNDLE.ZIP</button>
        </div>
      </div>
    </Win>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE.VIEW
// ─────────────────────────────────────────────────────────────────────────────
interface FileViewProps {
  pos: { x: number; y: number }; zIdx: number;
  onTitleDown: (e: RMouseEvent<HTMLDivElement>) => void; onFocus: () => void;
  section: PRDSection | null;
}
function FileView({ pos,zIdx,onTitleDown,onFocus,section }: FileViewProps) {
  if (!section) return null;
  return (
    <Win title={`FILE.VIEW · ${section.filename}`} bg={DARK} w={400} pos={pos} zIdx={zIdx} onTitleDown={onTitleDown} onFocus={onFocus}>
      <div style={{ fontFamily:F }}>
        <div style={{ padding:'4px 12px',borderBottom:`1px solid ${BD}`,display:'flex',gap:12,background:'rgba(0,0,0,0.3)' }}>
          <span style={{ fontSize:9,color:GOLD,letterSpacing:1 }}>{section.title}</span>
          <span style={{ fontSize:9,color:DIM }}>{fmtSize(section.bytes)}</span>
        </div>
        <div style={{ padding:'12px 14px',maxHeight:280,overflowY:'auto',fontSize:11,color:TD,lineHeight:1.8,whiteSpace:'pre-wrap',wordBreak:'break-word' }}>
          {section.body}
        </div>
      </div>
    </Win>
  );
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  appliedToSection?: string;
}

interface PRDChatProps {
  pos: { x: number; y: number }; zIdx: number;
  onTitleDown: (e: RMouseEvent<HTMLDivElement>) => void; onFocus: () => void;
  messages: ChatMessage[];
  input: string; setInput: (v: string) => void;
  onSend: () => void; busy: boolean;
  sections: PRDSection[];
}

function PRDChat({ pos,zIdx,onTitleDown,onFocus,messages,input,setInput,onSend,busy,sections }: PRDChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  return (
    <Win title="PRD.CHAT" bg={DARK} w={420} pos={pos} zIdx={zIdx}
      onTitleDown={onTitleDown} onFocus={onFocus}
      badge={sections.length ? `${sections.length} SECTIONS` : undefined}>
      <div style={{ fontFamily:F }}>

        {/* section quick-ref bar */}
        <div style={{ padding:'4px 10px', borderBottom:`1px solid ${BD}`,
          display:'flex', gap:4, flexWrap:'wrap', background:'rgba(0,0,0,0.25)' }}>
          {sections.slice(0,5).map(s => (
            <span key={s.filename}
              onClick={() => setInput(`Expand the "${s.title}" section with more detail.`)}
              style={{ fontSize:8, padding:'1px 6px', cursor:'pointer',
                border:`1px solid ${BD}`, background:'rgba(255,255,255,0.03)',
                color:DIM, letterSpacing:.5, whiteSpace:'nowrap' }}>
              {s.title}
            </span>
          ))}
          {sections.length > 5 && (
            <span style={{ fontSize:8, color:DIM }}>+{sections.length - 5} more</span>
          )}
        </div>

        {/* message history */}
        <div ref={scrollRef} style={{ padding:'10px 12px', height:240,
          overflowY:'auto', display:'flex', flexDirection:'column', gap:8 }}>
          {messages.length === 0 && (
            <div style={{ fontSize:10, color:DIM, lineHeight:1.6 }}>
              PRD loaded into context. Ask me to:<br/>
              <span style={{ color:'#50708A' }}>· "Expand the Architecture Notes section"</span><br/>
              <span style={{ color:'#50708A' }}>· "Add a caching strategy to Technical Requirements"</span><br/>
              <span style={{ color:'#50708A' }}>· "Rewrite User Stories for a solo developer"</span><br/>
              <span style={{ color:'#50708A' }}>· "Add error handling patterns for circuit_breaker"</span>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
            }}>
              <div style={{
                fontSize:11, lineHeight:1.65, padding:'6px 10px',
                background: msg.role === 'user' ? '#1A3A60' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${msg.role === 'user' ? '#204888' : BD}`,
                color: msg.role === 'user' ? '#90C0F0' : TD,
                whiteSpace:'pre-wrap', wordBreak:'break-word',
              }}>
                {msg.content.replace(/^APPLY_TO:.*\n/, '✓ Applied → ')}
              </div>
              {msg.appliedToSection && (
                <div style={{ fontSize:8, color:'#50A060', marginTop:2, paddingLeft:4, letterSpacing:.5 }}>
                  ✓ APPLIED TO {msg.appliedToSection}
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div style={{ alignSelf:'flex-start', fontSize:11, color:DIM }}>
              <span style={{ color:'#3060A8' }}>▋</span> thinking…
            </div>
          )}
        </div>

        {/* input row */}
        <div style={{ padding:'8px 10px', borderTop:`1px solid ${BD}`,
          display:'flex', gap:6, background:'rgba(0,0,0,0.2)' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder="Ask about the PRD… (Enter to send, Shift+Enter for newline)"
            rows={2}
            style={{ flex:1, background:'rgba(255,255,255,0.04)', border:`1px solid ${BD}`,
              fontFamily:F, fontSize:10, color:TD, padding:'5px 8px',
              outline:'none', resize:'none', lineHeight:1.5 }}
          />
          <button onClick={onSend} disabled={busy || !input.trim()}
            style={{ fontFamily:F, fontSize:10, padding:'0 12px',
              background: busy || !input.trim() ? '#1A1A14' : BAR,
              color:'#fff', border:'none', cursor: busy||!input.trim() ? 'not-allowed' : 'pointer',
              opacity: busy || !input.trim() ? 0.5 : 1, letterSpacing:1, alignSelf:'stretch' }}>
            {busy ? '…' : '→'}
          </button>
        </div>
      </div>
    </Win>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DESKTOP
// ─────────────────────────────────────────────────────────────────────────────
interface WinState { x: number; y: number; z: number; }

export default function SRLDesktop() {
  const { providerId, modelId, apiKeys } = useSettings();

  // ── Pglite session store ──────────────────────────────────────────────────
  const dbRef        = useRef<SessionDB | null>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    // Load JSZip
    if (!(window as any).JSZip) {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      document.head.appendChild(s);
    }
    // Boot session store
    initSessionStore().then(db => { dbRef.current = db; });
  }, []);

  // ── Window positions + z ──────────────────────────────────────────────────
  const [wins, setWins] = useState<Record<string, WinState>>({
    // Column A — Config (x=14)
    provider: { x:14,  y:6,  z:1 },   // PROVIDER.CFG  w=290
    ctrl:     { x:14,  y:290,z:2 },   // SRL.CONTROLLER w=255

    // Column B — Input (x=318)
    prompt:   { x:318, y:6,  z:3 },   // PROMPT.NOTE   w=400
    kit:      { x:318, y:310,z:4 },   // CK ──SEM      w=360

    // Column C — Output (x=730)
    output:   { x:730, y:6,  z:5 },   // PRD.OUTPUT    w=420
    folder:   { x:730, y:290,z:6 },   // PRD.DIR       w=330
    chat:     { x:730, y:6,  z:7 },   // PRD.CHAT      w=420 (hidden until generation)
    preview:  { x:200, y:80, z:8 },   // FILE.VIEW     w=400 (floats center on open)
  });
  const maxZ = useRef(7);
  const drag = useRef<{ id: string; ox: number; oy: number } | null>(null);

  const [showOutput,  setShowOutput]  = useState(false);
  const [showFolder,  setShowFolder]  = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showChat,    setShowChat]    = useState(false);

  // ── Generation state ──────────────────────────────────────────────────────
  const [prompt,        setPrompt]        = useState('');
  const [mode,          setMode]          = useState<Mode>('PRD');
  const [scope,         setScope]         = useState('new');
  const [selectedKit,   setSelectedKit]   = useState<Kit | null>(null);
  const [selectedField, setSelectedField] = useState('Agent Architecture');
  const [selectedStack, setSelectedStack] = useState<string[]>([]);
  const [outputText,    setOutputText]    = useState('');
  const [generating,    setGenerating]    = useState(false);
  const [sections,      setSections]      = useState<PRDSection[]>([]);
  const [activeFile,    setActiveFile]    = useState<PRDSection | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput,    setChatInput]    = useState('');
  const [chatBusy,     setChatBusy]     = useState(false);
  const [colCTab,      setColCTab]      = useState<'output' | 'chat'>('output');

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const focusWin = useCallback((id: string) => {
    maxZ.current++;
    setWins(w => ({ ...w, [id]: { ...w[id], z: maxZ.current } }));
  }, []);

  const onTitleDown = useCallback((id: string, e: RMouseEvent<HTMLDivElement>) => {
    e.preventDefault(); focusWin(id);
    setWins(w => { drag.current = { id, ox: e.clientX - w[id].x, oy: e.clientY - w[id].y }; return w; });
  }, [focusWin]);

  const onMouseMove = useCallback((e: RMouseEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const { id, ox, oy } = drag.current;
    setWins(w => ({ ...w, [id]: { ...w[id], x: e.clientX - ox, y: e.clientY - oy } }));
  }, []);

  const onMouseUp = useCallback(() => { drag.current = null; }, []);

  const selectKit = (kit: Kit) => { setSelectedKit(kit); if (!prompt) setPrompt(kit.ex); };
  const toggleStack = (s: string) => setSelectedStack(ss => ss.includes(s) ? ss.filter(x => x !== s) : [...ss, s]);

  // ── System prompt builder ─────────────────────────────────────────────────
  const buildSystem = (): string => {
    const modeMap: Record<Mode, string> = {
      PRD:        'Generate a comprehensive PRD. Use ## headers for: Overview, Goals, User Stories, Technical Requirements, Stack Justification, Architecture Notes, Open Questions.',
      Refine:     'Use ## headers for: Gap Analysis, Ambiguities, Proposed Improvements, Risk Flags.',
      Plan:       'Use ## headers for: Milestones, Task Breakdown, Dependency Order, Risk Assessment, Time Estimates.',
      Screencast: 'Generate a screencast script with ## headers for each scene. Include narration and timing.',
    };
    return `You are a senior Ruby AI systems architect specialising in LLM-native applications.
${modeMap[mode]}
CONTEXT: Scope=${scope === 'new' ? 'Greenfield' : 'Extension'} · Field=${selectedField}
${selectedKit ? `Kit=${selectedKit.name} · Stack=${selectedKit.stack.join(', ')}` : ''}
${selectedStack.length ? `Additional=${selectedStack.join(', ')}` : ''}
CONSTRAINTS: Ruby-native only. Prefer async/falcon. Prefer dspy.rb typed signatures. Cite specific gems.`;
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatBusy) return;
    const userMsg: ChatMessage = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatBusy(true);

    const provider = providers[providerId];
    const apiKey   = (apiKeys[providerId] || '').trim();

    if (!apiKey && provider.id !== 'ollama') {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `ERROR · Missing API key for ${provider.name}. Please configure it in PROVIDER.CFG window.` }]);
      setChatBusy(false);
      return;
    }

    const prdContext = sections.map(s => `## ${s.title}\n${s.body}`).join('\n\n');
    const history    = chatMessages.map(m =>
      `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n');

    const system = `You are a technical editor for a Ruby AI PRD document.
The current PRD content is provided below. Help the user refine, expand, or correct it.

When the user asks to rewrite or update a specific section, output ONLY that section's
new content prefixed with the exact line: APPLY_TO: <filename>
where <filename> matches one of the section filenames exactly.

Example:
APPLY_TO: 02_technical_requirements.md
## Technical Requirements
[new content here]

If no section update is needed, respond conversationally.

Available sections:
${sections.map(s => `  ${s.filename} — ${s.title}`).join('\n')}

Current PRD:
${prdContext}

Conversation so far:
${history}`;

    try {
      let full = '';
      const stream = provider.stream({ system, user: chatInput }, apiKey, modelId);
      const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
      setChatMessages(prev => [...prev, assistantMsg]);

      for await (const chunk of stream) {
        full += chunk;
        setChatMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: full };
          return updated;
        });
      }

      // Auto-detect APPLY_TO directive and update section in PRD.DIR
      const applyMatch = full.match(/^APPLY_TO:\s*(.+\.md)\n([\s\S]+)/m);
      if (applyMatch) {
        const [, filename, newBody] = applyMatch;
        setSections(prev => prev.map(s =>
          s.filename === filename.trim()
            ? { ...s, body: newBody.trim(), bytes: new TextEncoder().encode(newBody.trim()).length }
            : s
        ));
        setChatMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            appliedToSection: filename.trim(),
          };
          return updated;
        });
      }
    } catch (e) {
      setChatMessages(prev => [...prev,
        { role: 'assistant', content: `ERROR · ${(e as Error).message}` }
      ]);
    } finally {
      setChatBusy(false);
    }
  };

  // ── Generate ──────────────────────────────────────────────────────────────
  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true); setOutputText(''); setSections([]);
    setShowOutput(true); setShowFolder(false); setShowPreview(false); setActiveFile(null);
    focusWin('output');

    // Seed session meta
    const db = dbRef.current;
    const sessionId = sessionIdRef.current;
    if (db) {
      await seedSessionMeta(db, { session_id: sessionId, mode, kit_id: selectedKit?.id ?? null, provider_id: providerId, model_id: modelId });
    }

    try {
      // Real streaming via provider registry
      const provider = providers[providerId];
      const apiKey   = (apiKeys[providerId] || '').trim();
      let full = '';

      if (!apiKey && provider.id !== 'ollama') {
        throw new Error(`Missing API key for ${provider.name}. Please configure it in PROVIDER.CFG window.`);
      }

      const stream = provider.stream({ system: buildSystem(), user: prompt }, apiKey, modelId);
      for await (const chunk of stream) {
        full += chunk;
        setOutputText(full);
      }

      setGenerating(false);
      const parsed = parseSections(full);
      setSections(parsed);
      setShowFolder(true);
      focusWin('folder');

      // Embed + store each section in session pglite
      if (db) {
        const mistralKey = apiKeys['mistral'] ?? '';
        for (const sec of parsed) {
          let embedding: number[] | undefined;
          if (mistralKey) {
            try { embedding = await embedText(sec.body, mistralKey); } catch { /* skip if key invalid */ }
          }
          await storeSection(db, { session_id: sessionId, title: sec.title, body: sec.body, embedding });
        }
      }
      setShowChat(true);
      setChatMessages([]);
      setColCTab('chat');
      focusWin('chat');
    } catch (e) {
      setOutputText(`ERROR · ${(e as Error).message}`);
      setGenerating(false);
    }
  };

  // ── Download ZIP ──────────────────────────────────────────────────────────
  const downloadZip = async () => {
    const Z = (window as any).JSZip;
    if (!Z || !sections.length) return;
    const zip = new Z();
    const dir = zip.folder('ruby-genai-prd');
    const manifest = [
      'Ruby GenAI PRD Bundle',
      `Generated: ${new Date().toISOString()}`,
      `Mode: ${mode}`,
      `Provider: ${providers[providerId]?.name}`,
      `Model: ${modelId}`,
      `Kit: ${selectedKit?.name ?? 'custom'}`,
      '',
      ...sections.map((s, i) => `${String(i).padStart(2, '0')}. ${s.title} → ${s.filename} (${fmtSize(s.bytes)})`),
    ].join('\n');
    dir?.file('00_MANIFEST.txt', manifest);
    sections.forEach(s => dir?.file(s.filename, s.body));
    const blob = await zip.generateAsync({ type: 'blob' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `ruby-genai-prd-${new Date().toISOString().slice(0, 10)}.zip`; a.click();
    URL.revokeObjectURL(url);
  };

  const openFile = (sec: PRDSection) => { setActiveFile(sec); setShowPreview(true); focusWin('preview'); };

  const now   = new Date();
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const p     = providers[providerId];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: '#1A1A1A',
      userSelect: 'none',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:transparent;} ::-webkit-scrollbar-thumb{background:#303040;}
        textarea::placeholder,input::placeholder{color:#505058;}
        @media (max-width: 768px) {
          /* Scale the desktop surface to fit narrow screens */
          .srl-desktop-surface {
            overflow-x: auto;
          }
          /* Prevent windows from rendering off-screen */
          .srl-desktop-surface > div {
            max-width: calc(100vw - 8px);
          }
        }
      `}</style>

      {/* menu bar */}
      <div style={{ background:'#1A1A14',borderBottom:'1px solid #3A3028',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 12px',height:22,fontFamily:F }}>
        <div style={{ display:'flex',gap:18 }}>
          {['SRL','File','Edit','View','Vault','Tools','Window','?'].map((m, i) => (
            <span key={m} style={{ fontSize:11,cursor:'default',letterSpacing:i===0?2:.5,fontWeight:i===0?700:400,color:i===0?'#C04020':'#A09080' }}>{m}</span>
          ))}
        </div>
        <div style={{ display:'flex',gap:16,fontSize:10,color:'#806050',letterSpacing:1 }}>
          <span style={{ color:p.supportsDirectBrowser?'#40A060':WARN }}>
            {p.supportsDirectBrowser ? '◉ DIRECT' : '◎ PROXY'} · {p.name}
          </span>
          <span>△ {clock} · {now.toISOString().slice(0, 10)}</span>
        </div>
      </div>

      {/* desktop */}
      <div className="srl-desktop-surface" onMouseMove={onMouseMove} onMouseUp={onMouseUp}
        style={{ position:'relative',width:'100%',flex:1,background:DESK,overflow:'hidden',
          backgroundImage:'repeating-linear-gradient(0deg,rgba(0,0,0,0.06) 0,rgba(0,0,0,0.06) 1px,transparent 1px,transparent 4px),repeating-linear-gradient(90deg,rgba(0,0,0,0.06) 0,rgba(0,0,0,0.06) 1px,transparent 1px,transparent 4px)',
          backgroundSize:'4px 4px' }}>

        <PromptNote pos={wins.prompt} zIdx={wins.prompt.z} onTitleDown={e => onTitleDown('prompt', e)} onFocus={() => focusWin('prompt')}
          prompt={prompt} setPrompt={setPrompt} mode={mode} setMode={setMode} scope={scope} setScope={setScope}
          selectedKit={selectedKit} onGenerate={generate} generating={generating} />

        <KitSem pos={wins.kit} zIdx={wins.kit.z} onTitleDown={e => onTitleDown('kit', e)} onFocus={() => focusWin('kit')}
          selectedKit={selectedKit} onSelectKit={selectKit} />

        <Controller pos={wins.ctrl} zIdx={wins.ctrl.z} onTitleDown={e => onTitleDown('ctrl', e)} onFocus={() => focusWin('ctrl')}
          selectedField={selectedField} setField={setSelectedField} selectedStack={selectedStack} toggleStack={toggleStack} />

        <ProviderCfg pos={wins.provider} zIdx={wins.provider.z} onTitleDown={e => onTitleDown('provider', e)} onFocus={() => focusWin('provider')} />

        {(showOutput || showChat) && (
          <div style={{
            position:'absolute', left: wins.output.x, top: wins.output.y - 22,
            zIndex: Math.max(wins.output.z, wins.chat.z) + 1,
            display:'flex', gap:0, fontFamily:F,
          }}>
            {['output','chat'].map(tab => (
              <button key={tab} onClick={() => {
                setColCTab(tab as 'output' | 'chat');
                focusWin(tab === 'output' ? 'output' : 'chat');
              }} style={{
                fontSize:9, padding:'3px 12px', letterSpacing:1.5,
                background: colCTab === tab ? BAR : 'rgba(0,0,0,0.4)',
                color: colCTab === tab ? '#fff' : DIM,
                border: `1px solid ${colCTab === tab ? BAR : BD}`,
                cursor:'pointer', textTransform:'uppercase' as const,
              }}>{tab === 'output' ? 'PRD.OUTPUT' : 'PRD.CHAT'}</button>
            ))}
          </div>
        )}

        {showOutput && (
          <OutputWin pos={wins.output} zIdx={wins.output.z} onTitleDown={e => onTitleDown('output', e)} onFocus={() => focusWin('output')}
            text={outputText} generating={generating} mode={mode} selectedKit={selectedKit} />
        )}

        {showChat && sections.length > 0 && (
          <PRDChat
            pos={wins.chat} zIdx={wins.chat.z}
            onTitleDown={e => onTitleDown('chat', e)}
            onFocus={() => focusWin('chat')}
            messages={chatMessages}
            input={chatInput} setInput={setChatInput}
            onSend={sendChatMessage} busy={chatBusy}
            sections={sections}
          />
        )}

        {showFolder && sections.length > 0 && (
          <FolderWin pos={wins.folder} zIdx={wins.folder.z} onTitleDown={e => onTitleDown('folder', e)} onFocus={() => focusWin('folder')}
            sections={sections} activeFile={activeFile} onFileClick={openFile} onDownloadAll={downloadZip} />
        )}

        {showPreview && activeFile && (
          <FileView pos={wins.preview} zIdx={wins.preview.z} onTitleDown={e => onTitleDown('preview', e)} onFocus={() => focusWin('preview')}
            section={activeFile} />
        )}

        {showFolder && (
          <div onClick={() => focusWin('folder')} style={{ position:'absolute',left:14,bottom:26,textAlign:'center',cursor:'pointer',padding:4 }}>
            <div style={{ fontSize:26,color:GOLD,opacity:.8,lineHeight:1 }}>◫</div>
            <div style={{ fontFamily:F,fontSize:8,color:GOLD,letterSpacing:1,marginTop:1 }}>PRD.DIR</div>
            <div style={{ fontFamily:F,fontSize:8,color:DIM }}>{sections.length} files</div>
          </div>
        )}

        <div style={{ position:'absolute',right:14,bottom:26,fontFamily:F,fontSize:9,color:'rgba(255,255,255,0.07)',textAlign:'right',letterSpacing:1,lineHeight:1.6 }}>
          <div style={{ fontSize:20,marginBottom:2,opacity:.1 }}>◫</div>
          MEMORY.STACK
        </div>
      </div>

      {/* status bar */}
      <div style={{ background:'#0E0E0A',borderTop:'1px solid #2A2018',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 12px',height:20,fontFamily:F }}>
        <div style={{ display:'flex',gap:16,fontSize:9,color:'#706050' }}>
          <span>• VAULT</span>
          <span>provider <span style={{ color:p.supportsDirectBrowser?'#40A060':WARN }}>{p.name}</span></span>
          <span>model <span style={{ color:'#8090A0' }}>{modelId.split('/').pop()}</span></span>
          <span>register <span style={{ color:'#D08040' }}>{selectedKit ? selectedKit.id.toUpperCase() : 'UNSET'}</span></span>
          <span>mode <span style={{ color:'#60A080' }}>{mode}</span></span>
          {sections.length > 0 && <span>sections <span style={{ color:GOLD }}>{sections.length}</span></span>}
        </div>
        <span style={{ fontSize:9,color:'#504030',letterSpacing:1 }}>SRL v2.1 · ruby-genai</span>
      </div>
    </div>
  );
}
