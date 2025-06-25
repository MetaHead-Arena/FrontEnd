import React from "react";

export function Progress({ value = 0, className = "" }) {
  return (
    <div className={`w-full h-2 bg-slate-800 border-2 border-yellow-400 rounded-none ${className}`}>
      <div
        className="bg-yellow-400 h-full transition-all duration-300"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
