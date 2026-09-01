import React, { useRef, useState } from "react"
import {
  AlertTriangle,
  Check,
  Download,
  Lock,
  Moon,
  RefreshCw,
  Settings,
  ShieldCheck,
  Upload,
  X
} from "lucide-react"
import { SessionManager } from "~core/session-manager"
import type { PocketSettings, SessionPocketStore } from "~types"

interface SettingsModalProps {
  isOpen: boolean
  settings: PocketSettings
  onClose: () => void
  onUpdateSettings: (newSettings: Partial<PocketSettings>) => Promise<void>
  onDataImported: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onClose,
  onUpdateSettings,
  onDataImported
}) => {
  const [isExporting, setIsExporting] = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const json = await SessionManager.exportVault()
      const blob = new Blob([json], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `sessionpocket-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Export failed:", err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const result = await SessionManager.importVault(text)
      setImportStatus(`Successfully imported ${result.importedCount} sessions!`)
      onDataImported()
      setTimeout(() => setImportStatus(null), 3000)
    } catch (err: any) {
      setImportStatus(err.message || "Failed to import file.")
      setTimeout(() => setImportStatus(null), 4000)
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleClearAll = async () => {
    await SessionManager.clearAllData()
    setShowClearConfirm(false)
    onDataImported()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-4 text-zinc-100 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-300 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold">Settings & Backup</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preferences */}
        <div className="space-y-2.5">
          <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Preferences
          </h4>

          <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-950/60 border border-zinc-800">
            <div>
              <div className="text-xs font-medium text-zinc-200">Auto-sync on switch</div>
              <div className="text-[10px] text-zinc-400">
                Save current tokens before switching pockets
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.autoSyncOnSwitch}
              onChange={(e) => onUpdateSettings({ autoSyncOnSwitch: e.target.checked })}
              className="rounded bg-zinc-800 border-zinc-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-950/60 border border-zinc-800">
            <div>
              <div className="text-xs font-medium text-zinc-200">Extension icon badge</div>
              <div className="text-[10px] text-zinc-400">
                Show active session tag on extension icon
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.showActiveBadge}
              onChange={(e) => onUpdateSettings({ showActiveBadge: e.target.checked })}
              className="rounded bg-zinc-800 border-zinc-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
          </div>
        </div>

        {/* Backup & Restore */}
        <div className="space-y-2.5">
          <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Backup & Export
          </h4>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-zinc-400" />
              <span>{isExporting ? "Exporting..." : "Export Backup"}</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-zinc-400" />
              <span>Import Backup</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {importStatus && (
            <div className="p-2 rounded-lg bg-zinc-800 text-xs text-center text-zinc-200 border border-zinc-700">
              {importStatus}
            </div>
          )}
        </div>

        {/* Privacy & Security Note */}
        <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/90 flex items-start gap-2 text-[10px] text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-zinc-200">100% Local-First & Zero Telemetry</span>
            <p className="mt-0.5">
              All credentials, cookies, and tokens stay securely inside your browser's local storage.
              No servers, no tracking, no external API calls.
            </p>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="pt-2 border-t border-zinc-800">
          {showClearConfirm ? (
            <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/30 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Delete all saved sessions?</span>
              </div>
              <p className="text-[10px] text-rose-300/80">
                This will wipe all session pockets from local storage.
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2.5 py-1 rounded-lg text-[11px] text-zinc-300 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-white bg-rose-600 hover:bg-rose-500"
                >
                  Wipe All Data
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="w-full py-1.5 text-center text-xs text-rose-400/80 hover:text-rose-400 transition-colors"
            >
              Clear All Data & Reset Vault
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

