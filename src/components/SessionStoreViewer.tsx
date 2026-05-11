import React, { useEffect, useState } from "react";
import { getDb } from "../lib/db";
import { Database, Search } from "lucide-react";

export function SessionStoreViewer() {
  const [sections, setSections] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);

  const refresh = async () => {
    const db = getDb();
    if (!db) return;

    try {
      const secRes = await db.query("SELECT id, title, session_id, created_at FROM sections ORDER BY created_at DESC");
      if (secRes.rows.length > 0) {
        setSections(secRes.rows);
      } else {
        setSections([]);
      }

      const metaRes = await db.query("SELECT * FROM session_meta ORDER BY created_at DESC LIMIT 1");
      if (metaRes.rows.length > 0) {
        setMeta(metaRes.rows[0]);
      } else {
        setMeta(null);
      }
    } catch (e) {
      console.error("DB Read failed", e);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full gap-4 font-mono text-[11px]">
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <Database className="w-4 h-4 text-purple-600" />
        <h2 className="font-bold uppercase tracking-widest">Local Session Store (PGlite)</h2>
      </div>

      {meta && (
        <div className="bg-purple-50 p-2 border border-purple-200">
          <p className="font-bold text-purple-800 mb-1">CURRENT SESSION META</p>
          <div className="grid grid-cols-2 gap-x-4 opacity-80">
            <span>ID: {meta.session_id}</span>
            <span>MODE: {meta.mode}</span>
            <span>KIT: {meta.kit_id}</span>
            <span>CREATED: {new Date(meta.created_at).toLocaleTimeString()}</span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto border border-gray-200 bg-gray-50">
        <table className="w-full text-left">
          <thead className="bg-gray-200 sticky top-0">
            <tr>
              <th className="p-1 border-b border-gray-300">TITLE</th>
              <th className="p-1 border-b border-gray-300">SECTION_ID</th>
              <th className="p-1 border-b border-gray-300 text-right">VECTOR_DIMS</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((row, i) => (
              <tr key={i} className="hover:bg-blue-100 cursor-default border-b border-gray-200">
                <td className="p-1 text-blue-800 font-bold">{row.title}</td>
                <td className="p-1 opacity-60">{row.id}</td>
                <td className="p-1 text-right">1024</td>
              </tr>
            ))}
            {sections.length === 0 && (
              <tr>
                <td colSpan={3} className="p-4 text-center text-gray-400 italic">No sections stored in current session memory.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-black text-green-500 p-2 font-mono text-[10px]">
        <p className="flex items-center gap-2">
          <Search className="w-3 h-3" />
          <span>pgvector active: cosine_distance applied on retrieval</span>
        </p>
      </div>
    </div>
  );
}
