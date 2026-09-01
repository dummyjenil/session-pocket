import { STORAGE_VAULT_KEY } from "~lib/constants"
import { parseUrl } from "~lib/domain"

/**
 * Background Service Worker for SessionPocket (Manifest V3)
 * Kept lightweight, fast, and free of heavy runtime dependencies to guarantee
 * instant registration and zero initialization failures.
 */

async function updateBadgeForTab(tabId: number) {
  try {
    const tab = await chrome.tabs.get(tabId)
    if (!tab?.url) {
      await chrome.action.setBadgeText({ text: "" })
      return
    }

    const parsed = parseUrl(tab.url)
    if (!parsed.isValid) {
      await chrome.action.setBadgeText({ text: "" })
      return
    }

    const data = await chrome.storage.local.get(STORAGE_VAULT_KEY)
    const vault = data[STORAGE_VAULT_KEY]
    if (!vault || vault.settings?.showActiveBadge === false) {
      await chrome.action.setBadgeText({ text: "" })
      return
    }

    const activeSessionId = vault.activeSessions?.[parsed.domain]
    if (activeSessionId && vault.sessions?.[activeSessionId]) {
      const session = vault.sessions[activeSessionId]
      const badgeText = session.name.slice(0, 4).toUpperCase()
      await chrome.action.setBadgeText({ text: badgeText })
      await chrome.action.setBadgeBackgroundColor({ color: "#6366f1" })
    } else {
      await chrome.action.setBadgeText({ text: "" })
    }
  } catch (err) {
    // Ignore badge update errors gracefully
  }
}

// When active tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await updateBadgeForTab(activeInfo.tabId)
})

// When tab navigates or updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    await updateBadgeForTab(tabId)
  }
})

// Extension installation or upgrade listener
chrome.runtime.onInstalled.addListener(() => {
  // Service worker installed successfully
})

export {}
