import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { providers } from '../providers';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SettingsState {
  providerId: string;
  modelId:    string;
  apiKeys:    Record<string, string>;
}

interface SettingsContextValue extends SettingsState {
  setProvider: (id: string) => void;
  setModel:    (id: string) => void;
  setApiKey:   (providerId: string, key: string) => void;
}

// ── Reducer ───────────────────────────────────────────────────────────────────
type Action =
  | { type: 'SET_PROVIDER'; id: string }
  | { type: 'SET_MODEL';    id: string }
  | { type: 'SET_API_KEY';  providerId: string; key: string };

function reducer(state: SettingsState, action: Action): SettingsState {
  switch (action.type) {
    case 'SET_PROVIDER':
      return {
        ...state,
        providerId: action.id,
        modelId:    providers[action.id]?.models[0] ?? state.modelId,
      };
    case 'SET_MODEL':
      return { ...state, modelId: action.id };
    case 'SET_API_KEY':
      return { ...state, apiKeys: { ...state.apiKeys, [action.providerId]: action.key } };
    default:
      return state;
  }
}

// ── Session storage helpers ───────────────────────────────────────────────────
const SS_KEY = 'srl_api_keys';

function loadKeys(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveKeys(keys: Record<string, string>): void {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify(keys));
  } catch { /* quota exceeded — silently ignore */ }
}

// ── Context ───────────────────────────────────────────────────────────────────
const SettingsContext = createContext<SettingsContextValue | null>(null);

const DEFAULT_PROVIDER = 'openrouter'; // supportsDirectBrowser=true — safe default

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    providerId: DEFAULT_PROVIDER,
    modelId:    providers[DEFAULT_PROVIDER].models[0],
    apiKeys:    loadKeys(),
  });

  // Persist keys on every change
  useEffect(() => {
    saveKeys(state.apiKeys);
  }, [state.apiKeys]);

  const setProvider = useCallback((id: string) => dispatch({ type: 'SET_PROVIDER', id }), []);
  const setModel    = useCallback((id: string) => dispatch({ type: 'SET_MODEL',    id }), []);
  const setApiKey   = useCallback(
    (providerId: string, key: string) => dispatch({ type: 'SET_API_KEY', providerId, key }),
    []
  );

  return (
    <SettingsContext.Provider value={{ ...state, setProvider, setModel, setApiKey }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within <SettingsProvider>');
  return ctx;
}
