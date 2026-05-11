import React, { useState, useRef } from "react";
import Draggable from "react-draggable";
import { X, Minus, Maximize2 } from "lucide-react";
import { cn } from "../lib/utils";

interface WindowProps {
  id: string;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  isActive: boolean;
  onFocus: () => void;
  className?: string;
}

export function Window({ id, title, children, onClose, isActive, onFocus, className }: WindowProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".window-handle"
      disabled={isMaximized}
    >
      <div
        ref={nodeRef}
        onClick={onFocus}
        style={{ position: isMaximized ? "fixed" : "absolute" }}
        className={cn(
          "bg-[#f0f0f0] border-2 border-white shadow-[4px_4px_10px_rgba(0,0,0,0.3)] transition-all flex flex-col",
          isActive ? "z-50 ring-1 ring-blue-500" : "z-10 brightness-95",
          isMaximized ? "inset-0 w-full h-full transform-none top-0 left-0" : "w-[600px] min-h-[400px] h-[500px]",
          className
        )}
      >
        {/* Title Bar */}
        <div
          className="window-handle bg-gradient-to-r from-blue-700 to-blue-500 px-2 py-1 flex items-center justify-between cursor-default select-none"
        >
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-white/20 rounded-sm" />
            <span className="text-white text-sm font-bold antialiased font-sans">{title}</span>
          </div>
          <div className="flex gap-1">
            <button className="w-5 h-5 flex items-center justify-center bg-[#c0c0c0] border border-white shadow-sm hover:bg-[#d0d0d0] active:shadow-inner">
              <Minus className="w-3 h-3" />
            </button>
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="w-5 h-5 flex items-center justify-center bg-[#c0c0c0] border border-white shadow-sm hover:bg-[#d0d0d0] active:shadow-inner"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
            <button
              onClick={onClose}
              className="ml-1 w-5 h-5 flex items-center justify-center bg-[#c0c0c0] border border-white shadow-sm hover:bg-red-400 active:shadow-inner"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Menu Bar (Classic Style) */}
        <div className="flex gap-4 px-2 py-0.5 border-b border-gray-400 text-xs text-black border-t-white border-t">
          <span className="hover:bg-blue-600 hover:text-white px-1 cursor-default">File</span>
          <span className="hover:bg-blue-600 hover:text-white px-1 cursor-default">Edit</span>
          <span className="hover:bg-blue-600 hover:text-white px-1 cursor-default">View</span>
          <span className="hover:bg-blue-600 hover:text-white px-1 cursor-default">Help</span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-white p-4 font-sans text-sm selection:bg-blue-600 selection:text-white">
          {children}
        </div>
      </div>
    </Draggable>
  );
}
