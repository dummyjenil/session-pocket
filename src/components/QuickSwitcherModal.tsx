import React, { useEffect, useMemo, useRef, useState } from "react"
import { ExternalLink, Play, Search, Shield, Zap } from "lucide-react"
import { COLOR_TAGS } from "~lib/constants"
import { getFaviconUrl, getWebsiteDisplayName } from "~lib/domain"
import type { SessionPocket } from "~types"

interface QuickSwitcherModalProps {
  isOpen: boolean
  sessions: SessionPocket[]
  activeSessions: Record<string, string>
  onClose: () => void
  onLaunch: (sessionId: string, mode: "current-tab" | "new-tab" | "incognito") => void
}

export const QuickSwitcherModal: React.FC<QuickSwitcherModalProps> = ({
  isOpen,
  sessions,
  activeSessions,
  onClose,
  onLaunch
}) => {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery("")
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const filteredSessions = useMemo(() => {
    if (!query.trim()) {
      // Sort by lastUsedAt descending
      return [...sessions].sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    }
    const q = query.toLowerCase()
    return sessions
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.domain.toLowerCase().includes(q) ||
          s.apexDomain.toLowerCase().includes(q) ||
          (s.notes && s.notes.toLowerCase().includes(q))
      )
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
  }, [sessions, query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose()
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1 < filteredSessions.length ? prev + 1 : 0))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredSessions.length - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const selected = filteredSessions[selectedIndex]
      if (selected) {
        const mode = e.shiftKey ? "incognito" : "current-tab"
        onLaunch(selected.id, mode)
        onClose()
      }
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-10 px-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-zinc-800 bg-zinc-950">
          <Search className="w-4 h-4 text-zinc-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type session or site to switch instantly..."
            className="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          <div className="flex items-center gap-1">
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              ESC
            </kbd>
          </div>
        </div>

        {/* Results List */}
        <div className="max-h-72 overflow-y-auto p-1.5 space-y-1">
          {filteredSessions.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              No matching session pockets found
            </div>
          ) : (
            filteredSessions.map((session, index) => {
              const isSelected = index === selectedIndex
              const isActive = activeSessions[session.domain] === session.id
              const tagConfig = COLOR_TAGS[session.tag] || COLOR_TAGS.indigo
              const siteName = getWebsiteDisplayName(session.domain, session.apexDomain)
              const favicon = getFaviconUrl(session.domain, session.faviconUrl)

              return (
                <div
                  key={session.id}
                  onClick={() => {
                    onLaunch(session.id, "current-tab")
                    onClose()
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-indigo-600 text-white"
                      : "hover:bg-zinc-800/80 text-zinc-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={favicon}
                      alt=""
                      className="w-4 h-4 rounded object-contain bg-zinc-800 p-0.5 shrink-0"
                      onError={(e) => {
                        ;(e.target as HTMLElement).style.display = "none"
                      }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium truncate">{session.name}</span>
                        <span
                          className={`text-[10px] px-1 py-0.2 rounded ${
                            isSelected ? "text-indigo-200" : "text-zinc-400"
                          }`}
                        >
                          ({siteName})
                        </span>
                        {isActive && (
                          <span className="text-[9px] font-semibold px-1 rounded bg-emerald-500/20 text-emerald-300">
                            Active
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-[10px] truncate ${
                          isSelected ? "text-indigo-200" : "text-zinc-500"
                        }`}
                      >
                        {session.domain}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`w-2 h-2 rounded-full ${tagConfig.dot}`} />
                    {isSelected && (
                      <div className="flex items-center gap-1 text-[10px] opacity-80">
                        <span>↵ Launch</span>
                        <span>•</span>
                        <span>⇧↵ Isolated</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-3 py-2 bg-zinc-950/80 border-t border-zinc-800 text-[10px] text-zinc-400 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Launch</span>
            <span>Shift+↵ Isolated</span>
          </div>
          <span>{filteredSessions.length} available</span>
        </div>
      </div>
    </div>
  )
}

