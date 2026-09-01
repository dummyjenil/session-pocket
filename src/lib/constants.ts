import type { ColorTag, PocketSettings } from "~types"

export const COLOR_TAGS: Record<
  ColorTag,
  { label: string; bg: string; text: string; border: string; ring: string; dot: string }
> = {
  indigo: {
    label: "Indigo",
    bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
    text: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-500/30",
    ring: "focus:ring-indigo-500",
    dot: "bg-indigo-500"
  },
  emerald: {
    label: "Emerald",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/30",
    ring: "focus:ring-emerald-500",
    dot: "bg-emerald-500"
  },
  amber: {
    label: "Amber",
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/30",
    ring: "focus:ring-amber-500",
    dot: "bg-amber-500"
  },
  rose: {
    label: "Rose",
    bg: "bg-rose-500/10 dark:bg-rose-500/20",
    text: "text-rose-600 dark:text-rose-400",
    border: "border-rose-500/30",
    ring: "focus:ring-rose-500",
    dot: "bg-rose-500"
  },
  cyan: {
    label: "Cyan",
    bg: "bg-cyan-500/10 dark:bg-cyan-500/20",
    text: "text-cyan-600 dark:text-cyan-400",
    border: "border-cyan-500/30",
    ring: "focus:ring-cyan-500",
    dot: "bg-cyan-500"
  },
  purple: {
    label: "Purple",
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-500/30",
    ring: "focus:ring-purple-500",
    dot: "bg-purple-500"
  },
  slate: {
    label: "Slate",
    bg: "bg-slate-500/10 dark:bg-slate-500/20",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-500/30",
    ring: "focus:ring-slate-500",
    dot: "bg-slate-500"
  }
}

export const DEFAULT_SETTINGS: PocketSettings = {
  theme: "dark",
  autoSyncOnSwitch: true,
  confirmBeforeDelete: true,
  showActiveBadge: true
}

export const STORAGE_VAULT_KEY = "sessionpocket_vault_v1"

