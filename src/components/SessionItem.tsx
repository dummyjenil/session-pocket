import React, { useRef, useState } from "react"
import {
  Clock,
  ExternalLink,
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
  const [openUpward, setOpenUpward] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

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

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!showMenu && menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect()
      // If close to the bottom of the window, open upward to prevent clipping
      setOpenUpward(rect.bottom > window.innerHeight - 170)
    }
    setShowMenu(!showMenu)
  }

  const cookieCount = session.cookies?.length || 0
  const hasLS = session.storage?.localStorage && Object.keys(session.storage.localStorage).length > 0
  const hasIDB = Boolean(session.idbSnapshot)

  return (
    <div
      className={`group relative rounded-xl px-3 py-2.5 transition-all border ${
        isActive
          ? "bg-indigo-950/30 border-indigo-500/40 shadow-sm"
          : "bg-zinc-900/50 hover:bg-zinc-900/90 border-zinc-800/70 hover:border-zinc-700/80"
      }`}
    >
      {/* Top Row: Color Tag, Session Name, Active status, and Primary Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Color Indicator */}
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${tagConfig.dot} ring-2 ring-zinc-900`} />

          <span className="text-xs font-semibold text-zinc-100 truncate">
            {session.name}
          </span>

          {isActive && (
            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0">
              Active
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Launch in Current Tab */}
          <button
            onClick={() => onLaunch(session.id, "current-tab")}
            disabled={isLaunching}
            title="Launch session into current tab"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <Play className="w-3 h-3 fill-current" />
            <span className="text-[11px]">Launch</span>
          </button>

          {/* Launch in Isolated / Incognito Window */}
          <button
            onClick={() => onLaunch(session.id, "incognito")}
            disabled={isLaunching}
            title="Launch isolated in Incognito Window (run 2 accounts simultaneously)"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-800/60 hover:border-indigo-600 transition-colors disabled:opacity-50"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="text-[10px]">Incognito</span>
          </button>

          {/* More Actions Menu Button */}
          <div className="relative">
            <button
              ref={menuButtonRef}
              onClick={toggleMenu}
              title="More options"
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-transparent hover:border-zinc-700/60 transition-colors"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <div
                  className={`absolute right-0 ${
                    openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
                  } w-48 rounded-xl bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100`}
                >
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      onLaunch(session.id, "new-tab")
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 hover:text-white flex items-center gap-2.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Open in New Tab</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false)
                      onUpdate(session.id)
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 hover:text-white flex items-center gap-2.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Sync Current Tab</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false)
                      onRename(session)
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 hover:text-white flex items-center gap-2.5 transition-colors"
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
                    className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Delete Pocket</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Metadata Chips & Notes */}
      <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-400 mt-1.5 pt-1.5 border-t border-zinc-800/40">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="flex items-center gap-1 text-zinc-400">
            <Clock className="w-2.5 h-2.5 text-zinc-400" />
            {formatTime(session.lastUsedAt)}
          </span>
          <span className="text-zinc-600">•</span>
          <span className="px-1.5 py-0.2 rounded bg-zinc-800/80 text-zinc-300 font-medium">
            🍪 {cookieCount} cookies
          </span>
          {hasLS && (
            <span className="px-1.5 py-0.2 rounded bg-zinc-800/80 text-zinc-300 font-medium">
              📦 Storage
            </span>
          )}
          {hasIDB && (
            <span className="px-1.5 py-0.2 rounded bg-indigo-950/80 text-indigo-300 font-semibold border border-indigo-800/50">
              🗄️ IDB
            </span>
          )}
        </div>

        {session.notes && (
          <span
            className="text-zinc-400 italic truncate max-w-[140px]"
            title={session.notes}
          >
            📝 {session.notes}
          </span>
        )}
      </div>
    </div>
  )
}
