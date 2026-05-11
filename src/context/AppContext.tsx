import React, { createContext, useContext, useReducer, ReactNode } from "react";
import { IntakeRecord, PRDSection, Mode } from "../types";

interface State {
  session: IntakeRecord | null;
  sections: PRDSection[];
  isGenerating: boolean;
  activeWindow: string | null;
  windows: string[];
}

type Action =
  | { type: "SET_SESSION"; payload: IntakeRecord }
  | { type: "SET_SECTIONS"; payload: PRDSection[] }
  | { type: "ADD_SECTION"; payload: PRDSection }
  | { type: "SET_GENERATING"; payload: boolean }
  | { type: "OPEN_WINDOW"; payload: string }
  | { type: "CLOSE_WINDOW"; payload: string };

const AppContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
} | null>(null);

const initialState: State = {
  session: null,
  sections: [],
  isGenerating: false,
  activeWindow: "intake",
  windows: ["intake"],
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_SESSION":
      return { ...state, session: action.payload };
    case "SET_SECTIONS":
      return { ...state, sections: action.payload };
    case "ADD_SECTION":
      return { ...state, sections: [...state.sections, action.payload] };
    case "SET_GENERATING":
      return { ...state, isGenerating: action.payload };
    case "OPEN_WINDOW":
      return {
        ...state,
        windows: state.windows.includes(action.payload) ? state.windows : [...state.windows, action.payload],
        activeWindow: action.payload,
      };
    case "CLOSE_WINDOW":
      return {
        ...state,
        windows: state.windows.filter((w) => w !== action.payload),
        activeWindow: state.activeWindow === action.payload ? state.windows[0] || null : state.activeWindow,
      };
    default:
      return state;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
