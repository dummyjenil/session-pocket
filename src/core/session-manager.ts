import { DEFAULT_SETTINGS, STORAGE_VAULT_KEY } from "~lib/constants"
import { getApexDomain, getFaviconUrl, parseUrl } from "~lib/domain"
import { ExportDataSchema, SessionPocketSchema, SessionPocketStoreSchema } from "~lib/schema"
import type {
  ActiveTabInfo,
  ColorTag,
  PocketSettings,
  SessionPocket,
  SessionPocketStore,
  WebsiteGroup
} from "~types"
import { CookieEngine } from "./cookie-engine"
import { IDBEngine } from "./idb-engine"
import { StorageEngine } from "./storage-engine"

export class SessionManager {
  /**
   * Load the SessionPocket store from chrome.storage.local
   */
  static async loadVault(): Promise<SessionPocketStore> {
    const fallback: SessionPocketStore = {
      version: 1,
      sessions: {},
      activeSessions: {},
      settings: { ...DEFAULT_SETTINGS }
    }

    if (!chrome?.storage?.local) return fallback

    try {
      const data = await chrome.storage.local.get(STORAGE_VAULT_KEY)
      const rawStore = data[STORAGE_VAULT_KEY]
      if (!rawStore) return fallback

      const parsed = SessionPocketStoreSchema.safeParse(rawStore)
      if (parsed.success) {
        return parsed.data as SessionPocketStore
      } else {
        console.warn("Vault schema validation warning, repairing:", parsed.error)
        return {
          ...fallback,
          ...(rawStore as any),
          settings: { ...fallback.settings, ...(rawStore?.settings || {}) }
        }
      }
    } catch (err) {
      console.error("Failed to load vault:", err)
      return fallback
    }
  }

  /**
   * Save the SessionPocket store to chrome.storage.local
   */
  static async saveVault(store: SessionPocketStore): Promise<void> {
    if (!chrome?.storage?.local) return

    try {
      await chrome.storage.local.set({ [STORAGE_VAULT_KEY]: store })
    } catch (err) {
      console.error("Failed to save vault:", err)
    }
  }

  /**
   * Get active tab information and any currently active session pocket.
   */
  static async getActiveTabInfo(): Promise<ActiveTabInfo | null> {
    if (!chrome?.tabs) return null

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!activeTab || !activeTab.url) return null

      const parsed = parseUrl(activeTab.url)
      if (!parsed.isValid) {
        return {
          tabId: activeTab.id,
          url: activeTab.url,
          domain: "",
          apexDomain: "",
          origin: "",
          title: activeTab.title || "New Tab",
          faviconUrl: activeTab.favIconUrl,
          isIncognito: Boolean(activeTab.incognito)
        }
      }

      const vault = await this.loadVault()
      const activeSessionId = vault.activeSessions[parsed.domain]
      const activeSession = activeSessionId ? vault.sessions[activeSessionId] : undefined

      return {
        tabId: activeTab.id,
        url: parsed.url,
        domain: parsed.domain,
        apexDomain: parsed.apexDomain,
        origin: parsed.origin,
        title: activeTab.title || parsed.domain,
        faviconUrl: getFaviconUrl(parsed.domain, activeTab.favIconUrl),
        isIncognito: Boolean(activeTab.incognito),
        activeSession
      }
    } catch (err) {
      console.error("Error getting active tab info:", err)
      return null
    }
  }

  /**
   * Save current active tab session into a new pocket.
   */
  static async saveCurrentSession(params: {
    name: string
    tag?: ColorTag
    notes?: string
  }): Promise<SessionPocket> {
    const tabInfo = await this.getActiveTabInfo()
    if (!tabInfo || !tabInfo.tabId || !tabInfo.domain) {
      throw new Error("Cannot save session: No valid active web page detected.")
    }

    const storeId = tabInfo.isIncognito ? "1" : "0"

    // 1. Capture cookies
    const cookies = await CookieEngine.captureCookies(
      tabInfo.url,
      tabInfo.domain,
      tabInfo.apexDomain,
      storeId
    )

    // 2. Capture LocalStorage & SessionStorage
    const storage = await StorageEngine.captureStorage(tabInfo.tabId)

    // 3. Capture IndexedDB
    const idbSnapshot = await IDBEngine.captureIndexedDB(tabInfo.tabId)

    const now = Date.now()
    const session: SessionPocket = {
      id: `pocket_${now}_${Math.random().toString(36).slice(2, 9)}`,
      name: params.name.trim(),
      tag: params.tag || "indigo",
      url: tabInfo.url,
      domain: tabInfo.domain,
      apexDomain: tabInfo.apexDomain,
      origin: tabInfo.origin,
      faviconUrl: tabInfo.faviconUrl,
      createdAt: now,
      lastUsedAt: now,
      lastSavedAt: now,
      cookies,
      storage,
      idbSnapshot,
      notes: params.notes?.trim()
    }

    // Persist in vault
    const vault = await this.loadVault()
    vault.sessions[session.id] = session
    vault.activeSessions[session.domain] = session.id
    await this.saveVault(vault)

    await this.updateBadge(session.name)

    return session
  }

  /**
   * Update an existing session with fresh cookies and storage from the active tab.
   */
  static async updateSession(sessionId: string): Promise<SessionPocket> {
    const vault = await this.loadVault()
    const existing = vault.sessions[sessionId]
    if (!existing) {
      throw new Error("Session pocket not found.")
    }

    const tabInfo = await this.getActiveTabInfo()
    if (!tabInfo || !tabInfo.tabId) {
      throw new Error("No active tab found to update session from.")
    }

    const storeId = tabInfo.isIncognito ? "1" : "0"

    const cookies = await CookieEngine.captureCookies(
      tabInfo.url,
      existing.domain,
      existing.apexDomain,
      storeId
    )
    const storage = await StorageEngine.captureStorage(tabInfo.tabId)
    const idbSnapshot = await IDBEngine.captureIndexedDB(tabInfo.tabId)

    const now = Date.now()
    existing.cookies = cookies
    existing.storage = storage
    if (idbSnapshot) existing.idbSnapshot = idbSnapshot
    existing.lastSavedAt = now
    existing.lastUsedAt = now

    vault.sessions[sessionId] = existing
    vault.activeSessions[existing.domain] = existing.id
    await this.saveVault(vault)

    return existing
  }

  /**
   * Check if extension is allowed in incognito mode.
   */
  static async checkIncognitoAllowed(): Promise<boolean> {
    if (!chrome?.extension?.isAllowedIncognitoAccess) return true
    return new Promise((resolve) => {
      chrome.extension.isAllowedIncognitoAccess((isAllowed) => {
        resolve(isAllowed)
      })
    })
  }

  /**
   * Launch and apply a saved session pocket.
   */
  static async launchSession(
    sessionId: string,
    mode: "current-tab" | "new-tab" | "incognito" = "current-tab"
  ): Promise<void> {
    const vault = await this.loadVault()
    const targetSession = vault.sessions[sessionId]
    if (!targetSession) {
      throw new Error("Session not found.")
    }

    const currentTabInfo = await this.getActiveTabInfo()

    // Auto-sync current active session if enabled and different
    if (
      vault.settings.autoSyncOnSwitch &&
      currentTabInfo?.tabId &&
      currentTabInfo.activeSession &&
      currentTabInfo.activeSession.id !== sessionId &&
      currentTabInfo.domain === targetSession.domain
    ) {
      try {
        await this.updateSession(currentTabInfo.activeSession.id)
      } catch (err) {
        console.warn("Auto-sync prior to switch skipped:", err)
      }
    }

    if (mode === "incognito") {
      const allowed = await this.checkIncognitoAllowed()
      if (!allowed) {
        throw new Error(
          'Extension is not enabled in Incognito!\nPlease go to chrome://extensions -> SessionPocket -> Details -> Enable "Allow in incognito".'
        )
      }

      // 1. Open Incognito window with about:blank first!
      // This activates cookie storeId "1" in Chromium
      if (chrome?.windows) {
        const win = await chrome.windows.create({
          incognito: true,
          url: "about:blank"
        })

        const targetTab = win.tabs?.[0]
        if (!targetTab?.id) {
          throw new Error("Failed to create incognito window.")
        }

        // 2. Clear and inject cookies into active store "1"
        await CookieEngine.clearDomainCookies(targetSession.domain, targetSession.apexDomain, "1")
        await CookieEngine.restoreCookies(targetSession.cookies, "1")

        // 3. Navigate tab to target URL
        await chrome.tabs.update(targetTab.id, { url: targetSession.url })

        // 4. Attach storage restorer with reload trigger so SPAs boot with all state!
        this.attachStorageRestorer(targetTab.id, targetSession)
      }
    } else {
      // Regular window mode (0)
      // 1. Clear current domain cookies
      await CookieEngine.clearDomainCookies(targetSession.domain, targetSession.apexDomain, "0")
      // 2. Restore target cookies
      await CookieEngine.restoreCookies(targetSession.cookies, "0")

      let targetTabId: number | undefined

      if (mode === "new-tab" || !currentTabInfo?.tabId) {
        const newTab = await chrome.tabs.create({
          url: targetSession.url,
          active: true
        })
        targetTabId = newTab.id
      } else {
        // Current tab
        targetTabId = currentTabInfo.tabId
        await chrome.tabs.update(targetTabId, { url: targetSession.url })
      }

      if (targetTabId) {
        this.attachStorageRestorer(targetTabId, targetSession)
      }
    }

    // Update active session in vault
    vault.activeSessions[targetSession.domain] = targetSession.id
    targetSession.lastUsedAt = Date.now()
    vault.sessions[sessionId] = targetSession
    await this.saveVault(vault)

    await this.updateBadge(targetSession.name)
  }

  /**
   * Injects web storage & IndexedDB as soon as tab completes initial navigation,
   * and executes a single reload so SPAs read the restored state on initial mount.
   */
  private static attachStorageRestorer(tabId: number, session: SessionPocket): void {
    if (!chrome?.tabs?.onUpdated) return

    let injected = false

    const listener = async (
      updatedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo
    ) => {
      if (updatedTabId === tabId && changeInfo.status === "complete" && !injected) {
        injected = true
        chrome.tabs.onUpdated.removeListener(listener)

        // Inject storage
        if (session.storage) {
          await StorageEngine.restoreStorage(tabId, session.storage)
        }
        if (session.idbSnapshot) {
          await IDBEngine.restoreIndexedDB(tabId, session.idbSnapshot)
        }

        // Single reload trigger to ensure SPAs (React/Next/WhatsApp/etc.)
        // read the restored storage on initial mount instead of staying in logged out state
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            world: "MAIN",
            func: () => {
              if (!sessionStorage.getItem("__sp_restored_once__")) {
                sessionStorage.setItem("__sp_restored_once__", "true")
                window.location.reload()
              }
            }
          })
        } catch (e) {}
      }
    }

    chrome.tabs.onUpdated.addListener(listener)

    // Fallback timeout to prevent listener leak
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
    }, 20000)
  }

  /**
   * Delete a session pocket.
   */
  static async deleteSession(sessionId: string): Promise<void> {
    const vault = await this.loadVault()
    const session = vault.sessions[sessionId]
    if (!session) return

    if (vault.activeSessions[session.domain] === sessionId) {
      delete vault.activeSessions[session.domain]
      await this.updateBadge("")
    }

    delete vault.sessions[sessionId]
    await this.saveVault(vault)
  }

  /**
   * Rename a session pocket or change its color tag.
   */
  static async renameSession(
    sessionId: string,
    newName: string,
    newTag?: ColorTag,
    notes?: string
  ): Promise<SessionPocket> {
    const vault = await this.loadVault()
    const session = vault.sessions[sessionId]
    if (!session) {
      throw new Error("Session not found.")
    }

    session.name = newName.trim()
    if (newTag) session.tag = newTag
    if (notes !== undefined) session.notes = notes.trim()

    vault.sessions[sessionId] = session
    await this.saveVault(vault)

    if (vault.activeSessions[session.domain] === sessionId) {
      await this.updateBadge(session.name)
    }

    return session
  }

  /**
   * Update user settings.
   */
  static async updateSettings(settings: Partial<PocketSettings>): Promise<PocketSettings> {
    const vault = await this.loadVault()
    vault.settings = { ...vault.settings, ...settings }
    await this.saveVault(vault)
    return vault.settings
  }

  /**
   * Group sessions by website domain.
   */
  static getGroupedWebsites(vault: SessionPocketStore): WebsiteGroup[] {
    const groupMap = new Map<string, WebsiteGroup>()

    const allSessions = Object.values(vault.sessions).sort(
      (a, b) => b.lastUsedAt - a.lastUsedAt
    )

    for (const session of allSessions) {
      const key = session.apexDomain || session.domain
      let group = groupMap.get(key)

      if (!group) {
        group = {
          domain: session.domain,
          apexDomain: session.apexDomain,
          displayName: session.apexDomain || session.domain,
          faviconUrl: session.faviconUrl,
          sessions: [],
          activeSessionId: vault.activeSessions[session.domain]
        }
        groupMap.set(key, group)
      }

      group.sessions.push(session)
    }

    return Array.from(groupMap.values())
  }

  /**
   * Export all sessions as formatted JSON string.
   */
  static async exportVault(): Promise<string> {
    const vault = await this.loadVault()
    const exportData = {
      format: "sessionpocket-backup",
      version: 1,
      exportedAt: Date.now(),
      sessions: Object.values(vault.sessions),
      settings: vault.settings
    }
    return JSON.stringify(exportData, null, 2)
  }

  /**
   * Import sessions from JSON backup string.
   */
  static async importVault(jsonString: string): Promise<{ importedCount: number }> {
    let parsedJson: any
    try {
      parsedJson = JSON.parse(jsonString)
    } catch {
      throw new Error("Invalid JSON format.")
    }

    const validated = ExportDataSchema.safeParse(parsedJson)
    if (!validated.success) {
      throw new Error("Invalid backup file structure.")
    }

    const vault = await this.loadVault()
    let count = 0

    for (const session of validated.data.sessions) {
      const pocket = session as SessionPocket
      vault.sessions[pocket.id] = pocket
      count++
    }

    if (validated.data.settings) {
      vault.settings = { ...vault.settings, ...validated.data.settings }
    }

    await this.saveVault(vault)
    return { importedCount: count }
  }

  /**
   * Clear all sessions and reset vault.
   */
  static async clearAllData(): Promise<void> {
    const emptyVault: SessionPocketStore = {
      version: 1,
      sessions: {},
      activeSessions: {},
      settings: { ...DEFAULT_SETTINGS }
    }
    await this.saveVault(emptyVault)
    await this.updateBadge("")
  }

  /**
   * Update extension action badge text.
   */
  static async updateBadge(text: string): Promise<void> {
    if (!chrome?.action) return
    try {
      const badgeText = text ? text.slice(0, 4).toUpperCase() : ""
      await chrome.action.setBadgeText({ text: badgeText })
      await chrome.action.setBadgeBackgroundColor({ color: "#6366f1" })
    } catch {
      // Ignore badge errors
    }
  }
}

