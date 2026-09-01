import React, { useState } from "react"
import {
  ExternalLink,
  Eye,
  MoreVertical,
  Pencil,
  Play,
  RefreshCw,
  Shield,
  Trash2
} from "lucide-react"
import { COLOR_TAGS } from "~lib/constants"
import type { ColorTag, SessionPocket } from "~types"

interface SessionItemProps {
  session: SessionPocket
  isActive: boolean
  onLaunch: (sessionId: string, mode: "current-tab" | "new-tab" | "incognito") => void
  onUpdate: (sessionId: string) => void
  onRename: (session: SessionPocket) => void
  onDelete: (sessionId: string) => void
  isLaunching: boolean
}

export const SessionItem: React.FC<SessionItemProps> = ({
  session,
  isActive,
  onLaunch,
  onUpdate,
  onRename,
  onDelete,
  isLaunching
}) => {
  const [showMenu, setShowMenu] = useState(false)
  const tagConfig = COLOR_TAGS[session.tag] || COLOR_TAGS.indigo

  const formatTime = (epoch: number) => {
    const diffSec = Math.floor((Date.now() - epoch) / 1000)
    if (diffSec < 60) return "Just now"
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.floor(diffHr / 24)
    return `${diffDay}d ago`
  }

  return (
    <div
      className={`group relative flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
        isActive
          ? "bg-indigo-950/30 border border-indigo-500/40 shadow-sm"
          : "bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700/60"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Color Dot */}
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${tagConfig.dot} ring-2 ring-zinc-900`} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-zinc-100 truncate">
              {session.name}
            </span>
            {isActive && (
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">
                Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5">
            <span>Used {formatTime(session.lastUsedAt)}</span>
            <span>•</span>
            <span>{session.cookies?.length || 0} cookies</span>
            {session.idbSnapshot && (
              <>
                <span>•</span>
                <span className="text-indigo-400 font-medium">IDB</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Launch Button */}
        <button
          onClick={() => onLaunch(session.id, "current-tab")}
          disabled={isLaunching}
          title="Launch session into current tab"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-zinc-200 bg-zinc-800 hover:bg-indigo-600 hover:text-white border border-zinc-700/60 hover:border-transparent transition-colors disabled:opacity-50"
        >
          <Play className="w-3 h-3 fill-current" />
          <span className="text-[11px]">Launch</span>
        </button>

        {/* Isolated Window Launch */}
        <button
          onClick={() => onLaunch(session.id, "incognito")}
          disabled={isLaunching}
          title="Launch in Isolated / Incognito Window (run 2 accounts simultaneously!)"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-transparent hover:border-zinc-700/60 transition-colors"
        >
          <Shield className="w-3.5 h-3.5" />
        </button>

        {/* More Actions Dropdown Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 mt-1 w-44 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    setShowMenu(false)
                    onLaunch(session.id, "new-tab")
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Open in New Tab</span>
                </button>

                <button
                  onClick={() => {
                    setShowMenu(false)
                    onUpdate(session.id)
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Sync Current Tab</span>
                </button>

                <button
                  onClick={() => {
                    setShowMenu(false)
                    onRename(session)
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                >
                  <Pencil className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Rename & Tag</span>
                </button>

                <div className="my-1 border-t border-zinc-800" />

                <button
                  onClick={() => {
                    setShowMenu(false)
                    onDelete(session.id)
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Pocket</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

