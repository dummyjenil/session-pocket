import React from "react"
import { Layers, Search, Settings, Zap } from "lucide-react"

interface HeaderProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  onOpenQuickSwitcher: () => void
  onOpenSettings: () => void
  sessionCount: number
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onOpenQuickSwitcher,
  onOpenSettings,
  sessionCount
}) => {
  return (
    <header className="px-4 py-3 bg-zinc-950 border-b border-zinc-800/80 sticky top-0 z-30 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white font-bold text-base ring-1 ring-white/20">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-semibold text-zinc-100 tracking-tight">SessionPocket</h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-medium border border-indigo-500/20">
                MV3
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">One browser. Isolated sessions.</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenQuickSwitcher}
            title="Quick Switcher (⌘K)"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Switch</span>
            <kbd className="text-[10px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">⌘K</kbd>
          </button>
          <button
            onClick={onOpenSettings}
            title="Settings & Backup"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 border border-transparent hover:border-zinc-800 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={`Search ${sessionCount} session${sessionCount === 1 ? "" : "s"} or website...`}
          className="w-full pl-8 pr-3 py-1.5 bg-zinc-900/90 text-xs text-zinc-200 placeholder-zinc-500 rounded-lg border border-zinc-800 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/40 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
          >
            ×
          </button>
        )}
      </div>
    </header>
  )
}

