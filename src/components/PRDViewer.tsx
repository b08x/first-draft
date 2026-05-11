import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { generateWithGemini, parseSections } from "../lib/ai-provider";
import { PROMPTS } from "../lib/prompts";
import { Loader2, Download, Save } from "lucide-react";
import ReactMarkdown from "react-markdown";
import JSZip from "jszip";
import { Mistral } from "@mistralai/mistralai";
import { getDb } from "../lib/db";
import { retrieveRelevantSections, storePRDSection } from "../lib/embeddings";
import { RefreshCw, MessageSquare, Send, X as CloseIcon, ShieldCheck } from "lucide-react";
import { ValidationReport } from "../types";
import { ValidationReportView } from "./ValidationReport";

export function PRDViewer() {
  const { state, dispatch } = useApp();
  const [loading, setLoading] = useState(false);
  const [geminiKey, setGeminiKey] = useState("");
  const [mistralKey, setMistralKey] = useState("");
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [refiningFeedback, setRefiningFeedback] = useState("");
  const [auditReport, setAuditReport] = useState<ValidationReport | null>(null);

  const generatePRD = async () => {
    if (!state.session || !geminiKey || !mistralKey) {
      alert("Missing session or API keys.");
      return;
    }
    setLoading(true);
    try {
      const mistral = new Mistral({ apiKey: mistralKey });
      const db = getDb();
      
      // 1. Retrieve context
      const relevant = await retrieveRelevantSections(state.session.session_id, state.session.feature_description, mistral, db);
      const contextStr = relevant.length > 0 
        ? relevant.map(r => `## ${r.title}\n${r.body}`).join("\n\n")
        : "Initial session - no prior sections.";

      // 2. Generate
      const prompt = PROMPTS.GENERATE
        .replace(/{{mode}}/g, state.session.mode)
        .replace(/{{feature}}/g, state.session.feature_description)
        .replace(/{{kit_id}}/g, state.session.kit_id || "Standard")
        .replace(/{{scope}}/g, state.session.scope)
        .replace(/{{field}}/g, state.session.field)
        .replace(/{{stack_additions}}/g, state.session.stack_additions.join(", ") || "None")
        .replace(/{{RETRIEVED_SECTIONS}}/g, contextStr);

      const response = await generateWithGemini(prompt, geminiKey);
      const parsed = parseSections(response);
      
      // 3. Store new sections in DB for future RAG
      const newSections = [];
      for (const s of parsed) {
        const id = await storePRDSection(state.session.session_id, s, mistral, db);
        newSections.push({
          id,
          session_id: state.session.session_id,
          title: s.title,
          body: s.body,
          created_at: new Date().toISOString(),
        });
      }

      dispatch({ type: "SET_SECTIONS", payload: newSections });
    } catch (e) {
      console.error(e);
      alert("Generation failed.");
    } finally {
      setLoading(false);
    }
  };

  const refineSection = async (sectionId: string) => {
    if (!state.session || !geminiKey || !mistralKey || !refiningFeedback) return;
    const section = state.sections.find(s => s.id === sectionId);
    if (!section) return;

    setLoading(true);
    try {
      const mistral = new Mistral({ apiKey: mistralKey });
      const db = getDb();

      const fullPrd = state.sections.map(s => `## ${s.title}\n${s.body}`).join("\n\n");
      const relevant = await retrieveRelevantSections(state.session.session_id, refiningFeedback, mistral, db);
      const contextStr = relevant.map(r => `## ${r.title}\n${r.body}`).join("\n\n");

      const prompt = PROMPTS.REFINE
        .replace(/{{full_prd}}/g, fullPrd)
        .replace(/{{retrieved_context}}/g, contextStr)
        .replace(/{{section_title}}/g, section.title)
        .replace(/{{section_body}}/g, section.body)
        .replace(/{{user_feedback}}/g, refiningFeedback);

      const response = await generateWithGemini(prompt, geminiKey);
      const parsed = parseSections(response);
      const refined = parsed[0] || { title: section.title, body: response };

      // Update in DB
      const newId = await storePRDSection(state.session.session_id, refined, mistral, db);
      
      const newSections = state.sections.map(s => 
        s.id === sectionId ? { ...s, id: newId, body: refined.body } : s
      );

      dispatch({ type: "SET_SECTIONS", payload: newSections });
      setRefiningId(null);
      setRefiningFeedback("");
    } catch (e) {
      console.error(e);
      alert("Refinement failed.");
    } finally {
      setLoading(false);
    }
  };

  const runAudit = async () => {
    if (!state.session || !geminiKey) return;
    setLoading(true);
    try {
      const fullPrd = state.sections.map(s => `## ${s.title}\n${s.body}`).join("\n\n");
      const prompt = PROMPTS.VALIDATE
        .replace(/{{full_prd}}/g, fullPrd)
        .replace(/{{session_id}}/g, state.session.session_id)
        .replace(/{{timestamp}}/g, new Date().toISOString());

      const response = await generateWithGemini(prompt, geminiKey);
      const cleanedResponse = response.replace(/```json/g, "").replace(/```/g, "").trim();
      const json = JSON.parse(cleanedResponse) as ValidationReport;
      setAuditReport(json);
    } catch (e) {
      console.error(e);
      alert("Audit failed.");
    } finally {
      setLoading(false);
    }
  };

  const exportZip = async () => {
    if (!state.session) return;
    setLoading(true);
    try {
      const zip = new JSZip();
      
      const sectionInventory = state.sections.map((s, i) => `${String(i).padStart(2, "0")}_${s.title.toLowerCase().replace(/\s+/g, "_")}.md`).join("\n");
      const manifestPrompt = PROMPTS.EXPORT_MANIFEST
        .replace(/{{session_json}}/g, JSON.stringify(state.session))
        .replace(/{{section_inventory}}/g, sectionInventory)
        .replace(/{{validation_report}}/g, auditReport ? JSON.stringify(auditReport) : "No audit performed.");

      const manifestContent = await generateWithGemini(manifestPrompt, geminiKey);
      zip.file("00_MANIFEST.txt", manifestContent);

      state.sections.forEach((s, i) => {
        const filename = `${String(i).padStart(2, "0")}_${s.title.toLowerCase().replace(/\s+/g, "_")}.md`;
        zip.file(filename, `## ${s.title}\n\n${s.body}`);
      });

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ruby_prd_${state.session.session_id}.zip`;
      a.click();
    } catch (e) {
      console.error(e);
      alert("Export failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between border-b-2 border-gray-100 pb-2">
        <h2 className="text-lg font-bold text-gray-800">Generated Requirements</h2>
        <div className="flex gap-2">
          {state.sections.length > 0 && (
            <button
              onClick={runAudit}
              disabled={loading}
              className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1 text-xs font-bold hover:bg-indigo-700 active:shadow-inner disabled:opacity-50"
            >
              <ShieldCheck className="w-3 h-3" /> Run Audit
            </button>
          )}
          {state.sections.length > 0 && (
            <button
              onClick={exportZip}
              className="flex items-center gap-1 bg-green-600 text-white px-3 py-1 text-xs font-bold hover:bg-green-700 active:shadow-inner"
            >
              <Download className="w-3 h-3" /> Export ZIP
            </button>
          )}
          <button
            onClick={generatePRD}
            disabled={loading}
            className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1 text-xs font-bold hover:bg-blue-700 active:shadow-inner disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {state.sections.length > 0 ? "Regenerate Full" : "Generate PRD"}
          </button>
        </div>
      </div>

      {!state.sections.length && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-4">
          <div className="grid grid-cols-2 gap-4 w-full max-w-md">
            <input
              type="password"
              placeholder="Gemini API Key"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              className="border p-2 text-xs text-black"
            />
            <input
              type="password"
              placeholder="Mistral API Key"
              value={mistralKey}
              onChange={(e) => setMistralKey(e.target.value)}
              className="border p-2 text-xs text-black"
            />
          </div>
          <p className="text-sm italic">Ready to generate. Both keys required for RAG features.</p>
        </div>
      )}

      {loading && (
        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
          <div className="text-center">
            <p className="font-bold text-lg text-gray-700">Architecting Ruby Systems...</p>
            <p className="text-xs text-blue-500 animate-pulse mt-1">Applying RAG Context & Domain Constraints</p>
          </div>
        </div>
      )}

      {auditReport && (
        <div className="absolute inset-x-8 inset-y-16 bg-white z-50 shadow-2xl border border-gray-200 rounded-lg p-6">
          <ValidationReportView report={auditReport} onClose={() => setAuditReport(null)} />
        </div>
      )}

      <div className="flex-1 space-y-8 overflow-auto pb-8 scroll-smooth">
        {state.sections.map((section) => (
          <div key={section.id} className="border border-gray-200 rounded p-6 shadow-sm hover:shadow-md transition-shadow bg-white relative group">
            <div className="flex items-center justify-between mb-6 border-b-2 border-blue-600 pb-2">
              <h3 className="text-xl font-bold">## {section.title}</h3>
              <button
                onClick={() => setRefiningId(section.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] uppercase font-bold text-blue-600 hover:text-blue-800"
              >
                <MessageSquare className="w-3 h-3" /> Refine Section
              </button>
            </div>

            {refiningId === section.id && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-blue-600">Refine this section</span>
                  <button onClick={() => setRefiningId(null)} className="text-gray-400 hover:text-gray-600">
                    <CloseIcon className="w-3 h-3" />
                  </button>
                </div>
                <textarea
                  value={refiningFeedback}
                  onChange={(e) => setRefiningFeedback(e.target.value)}
                  placeholder="e.g., Use falcon instead of parallel here..."
                  className="w-full p-2 text-xs border border-blue-200 outline-none focus:ring-1 ring-blue-500 min-h-[60px]"
                />
                <button
                  onClick={() => refineSection(section.id)}
                  disabled={!refiningFeedback}
                  className="bg-blue-600 text-white py-1 px-3 text-[10px] font-bold self-end flex items-center gap-1 hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send className="w-3 h-3" /> Execute Refinement
                </button>
              </div>
            )}

            <div className="prose prose-sm max-w-none prose-blue leading-relaxed">
              <ReactMarkdown>{section.body}</ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
