import React from "react";
import { ProviderAudit } from "../types";
import { Cpu, AlertTriangle, ShieldCheck, Globe, Server } from "lucide-react";
import { cn } from "../lib/utils";

interface ProviderAuditViewerProps {
  audit: ProviderAudit;
}

export function ProviderAuditViewer({ audit }: ProviderAuditViewerProps) {
  return (
    <div className="bg-gray-900 text-gray-300 p-4 rounded-lg font-mono text-[11px] border border-gray-700 shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-blue-400" />
          <h3 className="uppercase tracking-widest font-bold">Provider Config Audit</h3>
        </div>
        <div className={cn(
          "px-2 py-0.5 rounded text-[9px] font-bold uppercase",
          audit.ready ? "bg-green-900/40 text-green-400 border border-green-800" : "bg-red-900/40 text-red-400 border border-red-800"
        )}>
          {audit.ready ? "Ready" : "Incomplete"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-4 gap-x-8">
        <div>
          <p className="text-gray-500 mb-1 leading-none uppercase text-[9px] tracking-tighter font-bold">Primary Endpoint</p>
          <p className="text-blue-400 font-bold">{audit.provider_id.toUpperCase()} / {audit.model_id}</p>
        </div>
        <div>
          <p className="text-gray-500 mb-1 leading-none uppercase text-[9px] tracking-tighter font-bold">Target Env</p>
          <div className="flex items-center gap-1">
            {audit.target_env === "browser" ? <Globe className="w-3 h-3" /> : <Server className="w-3 h-3" />}
            <p className="uppercase">{audit.target_env}</p>
          </div>
        </div>

        <div>
          <p className="text-gray-500 mb-1 leading-none uppercase text-[9px] tracking-tighter font-bold">CORS Status</p>
          <p className={cn(
            "font-bold",
            audit.cors_safe ? "text-green-400" : "text-yellow-500"
          )}>
            {audit.cors_safe ? "SECURE / DIRECT" : "PROXY REQUIRED"}
          </p>
        </div>
        <div>
          <p className="text-gray-500 mb-1 leading-none uppercase text-[9px] tracking-tighter font-bold">Fallback</p>
          <p className="opacity-80">{audit.fallback_provider || "None"}</p>
        </div>
      </div>

      {audit.cors_resolution && (
        <div className="mt-4 p-2 bg-blue-900/20 border border-blue-900/40 rounded italic opacity-70">
          <p className="text-[10px]">FIX: {audit.cors_resolution}</p>
        </div>
      )}

      {audit.warnings.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-gray-500 mb-1 leading-none uppercase text-[9px] tracking-tighter font-bold">Critical Warnings</p>
          {audit.warnings.map((w, i) => (
            <div key={i} className="flex gap-2 text-yellow-500/80 items-start">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              <p>{w}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 p-2 bg-black/40 rounded border border-gray-800">
        <p className="text-gray-500 mb-1 leading-none uppercase text-[9px] tracking-tighter font-bold">Model Suitability</p>
        <p className="leading-relaxed opacity-90">{audit.model_suitability}</p>
      </div>

      {Object.keys(audit.required_headers).length > 0 && (
        <div className="mt-4">
          <p className="text-gray-500 mb-1 leading-none uppercase text-[9px] tracking-tighter font-bold">Header Requirements</p>
          <div className="bg-black/20 p-2 rounded text-[10px]">
            {Object.entries(audit.required_headers).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-blue-500/60">{k}:</span>
                <span className="text-gray-100">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
