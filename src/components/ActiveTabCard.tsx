import React from "react"
import { BookmarkPlus, CheckCircle2, Globe, RefreshCw, Sparkles } from "lucide-react"
import { COLOR_TAGS } from "~lib/constants"
import { getWebsiteDisplayName } from "~lib/domain"
import type { ActiveTabInfo } from "~types"

interface ActiveTabCardProps {
  tabInfo: ActiveTabInfo | null
  onOpenSaveModal: () => void
  onUpdateSession: (sessionId: string) => void
  isUpdating: boolean
}

export const ActiveTabCard: React.FC<ActiveTabCardProps> = ({
  tabInfo,
  onOpenSaveModal,
  onUpdateSession,
  isUpdating
}) => {
  if (!tabInfo || !tabInfo.domain) {
    return (
      <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800/80 text-center">
        <div className="flex items-center justify-center gap-1.5 text-zinc-400 text-xs font-medium">
          <Globe className="w-3.5 h-3.5" />
          <span>Open a website to save or switch sessions</span>
        </div>
        <p className="text-[11px] text-zinc-500 mt-1">
          Supports WhatsApp, Instagram, YouTube, and any web app.
        </p>
      </div>
    )
  }

  const siteName = getWebsiteDisplayName(tabInfo.domain, tabInfo.apexDomain)
  const activeSession = tabInfo.activeSession
  const tagConfig = activeSession ? COLOR_TAGS[activeSession.tag] || COLOR_TAGS.indigo : null

  return (
    <div className="p-3 bg-gradient-to-b from-zinc-900 to-zinc-900/80 rounded-xl border border-zinc-800/90 shadow-sm relative overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={tabInfo.faviconUrl}
            alt=""
            className="w-5 h-5 rounded-md object-contain bg-zinc-800 p-0.5 shrink-0"
            onError={(e) => {
              ;(e.target as HTMLElement).style.display = "none"
            }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-zinc-100 truncate">{siteName}</span>
              <span className="text-[10px] text-zinc-400 truncate max-w-[110px]">{tabInfo.domain}</span>
            </div>

            {activeSession ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${tagConfig?.dot || "bg-emerald-500"} animate-pulse`} />
                <span className="text-[11px] text-zinc-300 font-medium truncate">
                  Active: <strong className="text-zinc-100">{activeSession.name}</strong>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                <span className="text-[11px] text-zinc-400">Default profile session</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {activeSession ? (
            <button
              onClick={() => onUpdateSession(activeSession.id)}
              disabled={isUpdating}
              title="Sync latest cookies and storage to this pocket"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700/60 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 text-zinc-300 ${isUpdating ? "animate-spin" : ""}`} />
              <span>Sync</span>
            </button>
          ) : null}

          <button
            onClick={onOpenSaveModal}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm shadow-indigo-500/20 transition-colors"
          >
            <BookmarkPlus className="w-3 h-3" />
            <span>Save Pocket</span>
          </button>
        </div>
      </div>
    </div>
  )
}

