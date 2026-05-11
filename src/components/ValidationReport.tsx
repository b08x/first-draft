import React from "react";
import { ValidationReport, AuditFinding } from "../types";
import { AlertTriangle, Info, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { cn } from "../lib/utils";

interface ValidationReportProps {
  report: ValidationReport;
  onClose: () => void;
}

export function ValidationReportView({ report, onClose }: ValidationReportProps) {
  return (
    <div className="flex flex-col h-full gap-4 font-sans">
      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold">Stack Validation Audit</h2>
        </div>
        <div className={cn(
          "px-3 py-1 text-xs font-bold uppercase rounded-full",
          report.pass ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-700 border border-red-200"
        )}>
          {report.pass ? "PASS" : "FAIL"}
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Audit Summary</p>
        <p className="text-sm text-gray-700 leading-relaxed">{report.summary}</p>
        <div className="mt-2 text-[10px] text-gray-400">
          Confidence: {(report.overall_confidence * 100).toFixed(0)}% • {report.audit_timestamp}
        </div>
      </div>

      <div className="flex-1 overflow-auto space-y-3">
        {report.findings.map((finding, i) => (
          <div key={i} className={cn(
            "p-3 border rounded-md flex gap-3",
            finding.severity === "error" ? "bg-red-50 border-red-100" :
            finding.severity === "warning" ? "bg-orange-50 border-orange-100" :
            "bg-blue-50 border-blue-100"
          )}>
            <div className="mt-0.5">
              {finding.severity === "error" && <AlertCircle className="w-4 h-4 text-red-600" />}
              {finding.severity === "warning" && <AlertTriangle className="w-4 h-4 text-orange-600" />}
              {finding.severity === "info" && <Info className="w-4 h-4 text-blue-600" />}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-tight text-gray-500">{finding.section}</span>
                <span className="text-[10px] font-mono opacity-60">Conf: {finding.confidence}</span>
              </div>
              <p className="text-xs font-medium text-gray-800">{finding.finding}</p>
              {finding.suggestion && (
                <div className="mt-2 p-2 bg-white/50 border border-black/5 rounded text-[11px] font-mono italic text-gray-600">
                  Suggest: {finding.suggestion}
                </div>
              )}
            </div>
          </div>
        ))}
        {report.findings.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 text-gray-400 gap-2">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <p className="text-sm font-medium">No critical issues found.</p>
          </div>
        )}
      </div>

      <button
        onClick={onClose}
        className="w-full py-2 bg-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-300 transition-colors uppercase"
      >
        Close Report
      </button>
    </div>
  );
}
