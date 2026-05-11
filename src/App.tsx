import { AppProvider, useApp } from "./context/AppContext";
import { Window } from "./components/Window";
import { IntakeForm } from "./components/IntakeForm";
import { PRDViewer } from "./components/PRDViewer";
import { SessionStoreViewer } from "./components/SessionStoreViewer";
import { Terminal, FileText, Settings, Database, Github, Cpu } from "lucide-react";
import { useEffect } from "react";
import { initDb } from "./lib/db";

function Desktop() {
  const { state, dispatch } = useApp();

  useEffect(() => {
    initDb().then(() => console.log("DB Loaded"));
  }, []);

  const icons = [
    { id: "intake", name: "Project Intake", icon: Cpu, color: "text-blue-500" },
    { id: "prd", name: "PRD Explorer", icon: FileText, color: "text-orange-500" },
    { id: "terminal", name: "Ruby Console", icon: Terminal, color: "text-green-500" },
    { id: "db", name: "Session Store", icon: Database, color: "text-purple-500" },
  ];

  return (
    <div className="h-screen w-screen bg-[#008080] overflow-hidden flex flex-col select-none antialiased relative">
      {/* OS Desktop Area */}
      <div className="flex-1 relative p-4 grid grid-flow-col grid-rows-[repeat(auto-fill,100px)] gap-4 justify-start">
        {icons.map((item) => (
          <div
            key={item.id}
            onDoubleClick={() => dispatch({ type: "OPEN_WINDOW", payload: item.id })}
            className="w-20 h-24 flex flex-col items-center gap-1 group cursor-default"
          >
            <div className={cn(
              "p-2 rounded-md transition-colors group-hover:bg-white/20 group-active:bg-white/40",
              state.activeWindow === item.id && "bg-white/20"
            )}>
              <item.icon className={cn("w-10 h-10 drop-shadow-md", item.color)} strokeWidth={1.5} />
            </div>
            <span className="text-white text-[10px] text-center font-bold tracking-tight px-1 rounded-sm group-hover:bg-blue-700 bg-black/20">
              {item.name}
            </span>
          </div>
        ))}

        {/* Windows Rendering Layer */}
        {state.windows.map((winId) => {
          if (winId === "intake") {
            return (
              <Window
                key="intake"
                id="intake"
                title="Ruby GenAI Project Intake"
                isActive={state.activeWindow === "intake"}
                onFocus={() => dispatch({ type: "OPEN_WINDOW", payload: "intake" })}
                onClose={() => dispatch({ type: "CLOSE_WINDOW", payload: "intake" })}
              >
                <IntakeForm />
              </Window>
            );
          }
          if (winId === "prd") {
            return (
              <Window
                key="prd"
                id="prd"
                title="PRD Generator & Explorer"
                isActive={state.activeWindow === "prd"}
                onFocus={() => dispatch({ type: "OPEN_WINDOW", payload: "prd" })}
                onClose={() => dispatch({ type: "CLOSE_WINDOW", payload: "prd" })}
                className="w-[800px] h-[600px]"
              >
                <PRDViewer />
              </Window>
            );
          }
          if (winId === "terminal") {
             return (
              <Window
                key="terminal"
                id="terminal"
                title="ruby_console.sh"
                isActive={state.activeWindow === "terminal"}
                onFocus={() => dispatch({ type: "OPEN_WINDOW", payload: "terminal" })}
                onClose={() => dispatch({ type: "CLOSE_WINDOW", payload: "terminal" })}
                className="bg-black opacity-90"
              >
                <div className="font-mono text-green-400 p-2">
                  <p>Ruby GenAI Console v1.0.0</p>
                  <p>Type 'help' for commands.</p>
                  <div className="flex gap-2 mt-4">
                    <span>$</span>
                    <input type="text" className="bg-transparent border-none outline-none text-green-400 w-full" autoFocus />
                  </div>
                </div>
              </Window>
            );
          }
          if (winId === "db") {
            return (
              <Window
                key="db"
                id="db"
                title="Session Store (sql.js)"
                isActive={state.activeWindow === "db"}
                onFocus={() => dispatch({ type: "OPEN_WINDOW", payload: "db" })}
                onClose={() => dispatch({ type: "CLOSE_WINDOW", payload: "db" })}
                className="w-[500px] h-[400px]"
              >
                <SessionStoreViewer />
              </Window>
            );
          }
          return null;
        })}
      </div>

      {/* OS Taskbar */}
      <div className="h-10 bg-[#c0c0c0] border-t-2 border-white flex items-center px-1 gap-1 relative z-[9999]">
        <button className="flex items-center gap-2 bg-[#c0c0c0] border-2 border-gray-400 border-t-white border-l-white px-2 py-0.5 font-bold text-xs hover:bg-[#d0d0d0] active:border-t-gray-400 active:border-l-gray-400">
          <Github className="w-4 h-4" />
          <span>Start</span>
        </button>
        <div className="w-[1px] h-6 bg-gray-400 mx-1 border-r border-white" />
        
        {state.windows.map(winId => (
          <button
            key={winId}
            onClick={() => dispatch({ type: "OPEN_WINDOW", payload: winId })}
            className={cn(
              "flex items-center gap-2 border-2 px-3 py-0.5 text-[10px] min-w-[120px] transition-all",
              state.activeWindow === winId 
                ? "border-gray-500 border-r-white border-b-white bg-[#ececec]" 
                : "border-gray-400 border-t-white border-l-white bg-[#c0c0c0]"
            )}
          >
            <FileText className="w-3 h-3" />
            <span className="truncate">{winId.toUpperCase()}</span>
          </button>
        ))}

        <div className="ml-auto bg-[#c0c0c0] border-2 border-gray-500 border-t-gray-800 border-l-gray-800 px-3 py-1 text-[10px] font-mono flex items-center gap-2">
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Desktop />
    </AppProvider>
  );
}

import { cn } from "./lib/utils";

