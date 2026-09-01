import React, { useEffect, useRef, useState } from "react"
import { Check, Pencil, X } from "lucide-react"
import { COLOR_TAGS } from "~lib/constants"
import type { ColorTag, SessionPocket } from "~types"

interface RenameModalProps {
  session: SessionPocket | null
  isOpen: boolean
  onClose: () => void
  onSave: (sessionId: string, newName: string, newTag?: ColorTag, notes?: string) => Promise<void>
}

const TAG_OPTIONS: ColorTag[] = [
  "indigo",
  "emerald",
  "amber",
  "rose",
  "cyan",
  "purple",
  "slate"
]

export const RenameModal: React.FC<RenameModalProps> = ({
  session,
  isOpen,
  onClose,
  onSave
}) => {
  const [name, setName] = useState("")
  const [selectedTag, setSelectedTag] = useState<ColorTag>("indigo")
  const [notes, setNotes] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (session) {
      setName(session.name)
      setSelectedTag(session.tag || "indigo")
      setNotes(session.notes || "")
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [session])

  if (!isOpen || !session) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || isSaving) return

    setIsSaving(true)
    try {
      await onSave(session.id, name.trim(), selectedTag, notes.trim() || undefined)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-100">
      <div
        className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-4 text-zinc-100 space-y-3.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-300 flex items-center justify-center">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold">Edit Session Pocket</h3>
              <p className="text-[10px] text-zinc-400">{session.domain}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Pocket Name
            </label>
            <input
              ref={inputRef}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1.5">
              Color Tag
            </label>
            <div className="flex items-center gap-2">
              {TAG_OPTIONS.map((tag) => {
                const config = COLOR_TAGS[tag]
                const isSelected = selectedTag === tag
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    title={config.label}
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      config.dot
                    } ${
                      isSelected
                        ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110"
                        : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes..."
              className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-zinc-800 border border-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSaving}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm shadow-indigo-500/20 disabled:opacity-50 transition-colors"
            >
              {isSaving ? "Saving..." : "Update Pocket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

