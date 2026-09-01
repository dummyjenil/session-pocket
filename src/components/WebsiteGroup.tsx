import React, { useState } from "react"
import { ChevronDown, ChevronRight, Plus } from "lucide-react"
import { getFaviconUrl, getWebsiteDisplayName } from "~lib/domain"
import type { SessionPocket, WebsiteGroup as WebsiteGroupType } from "~types"
import { SessionItem } from "./SessionItem"

interface WebsiteGroupProps {
  group: WebsiteGroupType
  activeSessionId?: string
  onLaunch: (sessionId: string, mode: "current-tab" | "new-tab" | "incognito") => void
  onUpdate: (sessionId: string) => void
  onRename: (session: SessionPocket) => void
  onDelete: (sessionId: string) => void
  onAddSessionForGroup: (domain: string, url: string) => void
  isLaunching: boolean
}

export const WebsiteGroup: React.FC<WebsiteGroupProps> = ({
  group,
  activeSessionId,
  onLaunch,
  onUpdate,
  onRename,
  onDelete,
  onAddSessionForGroup,
  isLaunching
}) => {
  const [isOpen, setIsOpen] = useState(true)

  const displayName = getWebsiteDisplayName(group.domain, group.apexDomain)
  const favicon = getFaviconUrl(group.domain, group.faviconUrl)

  return (
    <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/70 overflow-hidden transition-colors">
      {/* Website Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-3 py-2.5 bg-zinc-900/40 hover:bg-zinc-900/80 cursor-pointer select-none transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <button className="text-zinc-400 hover:text-zinc-200">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          <img
            src={favicon}
            alt=""
            className="w-4 h-4 rounded object-contain bg-zinc-800 p-0.5 shrink-0"
            onError={(e) => {
              ;(e.target as HTMLElement).style.display = "none"
            }}
          />

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-zinc-100 truncate">{displayName}</span>
            <span className="text-[10px] text-zinc-400 truncate max-w-[130px]">{group.domain}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-medium">
            {group.sessions.length}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddSessionForGroup(group.domain, group.sessions[0]?.url || `https://${group.domain}`)
            }}
            title="Save new session for this site"
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Session Pockets List */}
      {isOpen && (
        <div className="p-2 space-y-1.5 border-t border-zinc-800/40">
          {group.sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={activeSessionId === session.id}
              onLaunch={onLaunch}
              onUpdate={onUpdate}
              onRename={onRename}
              onDelete={onDelete}
              isLaunching={isLaunching}
            />
          ))}
        </div>
      )}
    </div>
  )
}

