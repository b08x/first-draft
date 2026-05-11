import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { generateWithGemini } from "../lib/ai-provider";
import { PROMPTS } from "../lib/prompts";
import { v4 as uuidv4 } from "uuid";
import { cn } from "../lib/utils";
import { IntakeRecord } from "../types";
import { Loader2 } from "lucide-react";
import { Mistral } from "@mistralai/mistralai";
import { seedSessionContext } from "../lib/embeddings";
import { getDb } from "../lib/db";
import { ProviderAudit } from "../types";
import { ProviderAuditViewer } from "./ProviderAuditViewer";

export function IntakeForm() {
  const { state, dispatch } = useApp();
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [geminiKey, setGeminiKey] = useState("");
  const [mistralKey, setMistralKey] = useState("");
  const [providerAudit, setProviderAudit] = useState<ProviderAudit | null>(null);

  const runProviderAudit = async () => {
    if (!description || !geminiKey) return;
    try {
      const config = {
        provider_id: "google",
        model_id: "gemini-1.5-flash",
        target_env: "browser"
      };

      const prompt = PROMPTS.PROVIDER_AUDIT
        .replace(/{{session_config}}/g, JSON.stringify(config));

      const response = await generateWithGemini(prompt, geminiKey);
      const cleaned = response.replace(/```json/g, "").replace(/```/g, "").trim();
      const json = JSON.parse(cleaned) as ProviderAudit;
      setProviderAudit(json);
    } catch (e) {
      console.error("Audit failed", e);
    }
  };

  useEffect(() => {
    if (description.length > 20 && geminiKey) {
      const timer = setTimeout(runProviderAudit, 1000);
      return () => clearTimeout(timer);
    }
  }, [description, geminiKey]);

  const handleStart = async () => {
    if (!description || !geminiKey || !mistralKey) {
      alert("Please provide a description and both API keys.");
      return;
    }

    setLoading(true);
    try {
      const sessionId = uuidv4();
      const prompt = PROMPTS.INTAKE
        .replace(/{{description}}/g, description)
        .replace(/{{uuid}}/g, sessionId)
        .replace(/{{timestamp}}/g, new Date().toISOString());

      const response = await generateWithGemini(prompt, geminiKey);
      const cleanedResponse = response.replace(/```json/g, "").replace(/```/g, "").trim();
      const json = JSON.parse(cleanedResponse) as IntakeRecord;
      
      // Initialize Context Seed
      const mistral = new Mistral({ apiKey: mistralKey });
      const db = getDb();
      await seedSessionContext(sessionId, json, mistral, db);

      dispatch({ type: "SET_SESSION", payload: json });
      dispatch({ type: "OPEN_WINDOW", payload: "prd" });
    } catch (e) {
      console.error(e);
      alert("Failed to process intake. Check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
        <h3 className="font-bold text-blue-800 font-sans">Project Intake</h3>
        <p className="text-blue-700 text-xs">Enter your Ruby GenAI project idea to begin generation.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500">Gemini API Key</label>
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AI Studio Key"
            className="w-full border-2 border-gray-300 p-2 focus:border-blue-500 outline-none font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500">Mistral API Key</label>
          <input
            type="password"
            value={mistralKey}
            onChange={(e) => setMistralKey(e.target.value)}
            placeholder="Mistral Key"
            className="w-full border-2 border-gray-300 p-2 focus:border-blue-500 outline-none font-mono text-xs"
          />
        </div>
      </div>
      <p className="text-[10px] text-gray-400 italic">Keys are used only for current requests and not persisted.</p>

      <div className="space-y-2">
        <label className="block text-sm font-semibold">Feature Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., A multi-agent system for Ruby that uses Ohm/Redis for state and Falcon for concurrency..."
          className="w-full h-32 border-2 border-gray-300 p-3 focus:border-blue-500 outline-none text-sm leading-relaxed"
        />
      </div>

      {providerAudit && (
        <div className="mt-4">
          <ProviderAuditViewer audit={providerAudit} />
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={loading}
        className={cn(
          "w-full py-3 bg-blue-700 text-white font-bold hover:bg-blue-800 active:bg-blue-900 transition-all flex items-center justify-center gap-2 shadow-[2px_2px_0px_rgba(0,0,0,0.2)]",
          loading && "opacity-50 cursor-not-allowed"
        )}
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Initialize Generation"}
      </button>
    </div>
  );
}
