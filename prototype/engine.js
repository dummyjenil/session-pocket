/**
 * SessionPocket Prototype - Core Session Engine
 * Handles full-fidelity capture and restoration of:
 * 1. Cookies (Apex, subdomains, host-only, CHIPS, Secure, SameSite)
 * 2. LocalStorage
 * 3. SessionStorage
 * 4. IndexedDB (Databases, object stores, indexes, and full record sets)
 * 5. Safe Incognito Handshake (Guarantees cookie store existence & avoids SPA race conditions)
 */

export class CookieEngine {
  /**
   * Helper: Parse domain and apex domain from a URL.
   */
  static parseDomain(urlStr) {
    try {
      const url = new URL(urlStr)
      const hostname = url.hostname
      const parts = hostname.split('.')
      let apexDomain = hostname

      // Standard multi-part TLD detection (e.g. .co.uk, .com.au)
      const secondLevelTlds = ['co.uk', 'com.au', 'co.in', 'org.uk', 'gov.in']
      const lastTwo = parts.slice(-2).join('.')
      const lastThree = parts.slice(-3).join('.')

      if (secondLevelTlds.includes(lastTwo) && parts.length > 2) {
        apexDomain = lastThree
      } else if (parts.length > 2) {
        apexDomain = parts.slice(-2).join('.')
      }

      return {
        isValid: true,
        url: url.href,
        origin: url.origin,
        domain: hostname,
        apexDomain: apexDomain
      }
    } catch {
      return { isValid: false, url: '', origin: '', domain: '', apexDomain: '' }
    }
  }

  /**
   * Capture all cookies for a target URL and its domains.
   */
  static async captureCookies(url, domain, apexDomain, storeId = '0') {
    if (!chrome?.cookies) return []

    const cookieMap = new Map()
    const addCookie = (c) => {
      const key = `${c.name}@${c.domain}${c.path}`
      if (!cookieMap.has(key)) {
        cookieMap.set(key, {
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          secure: c.secure,
          httpOnly: c.httpOnly,
          sameSite: c.sameSite || 'unspecified',
          expirationDate: c.expirationDate,
          hostOnly: c.hostOnly,
          session: c.session,
          partitionKey: c.partitionKey || null
        })
      }
    }

    try {
      // 1. Direct URL cookies
      const urlCookies = await chrome.cookies.getAll({ url, storeId })
      urlCookies.forEach(addCookie)

      // 2. Exact Domain cookies
      const domainCookies = await chrome.cookies.getAll({ domain, storeId })
      domainCookies.forEach(addCookie)

      // 3. Dot-prefixed domain cookies
      if (!domain.startsWith('.')) {
        const dotDomainCookies = await chrome.cookies.getAll({ domain: `.${domain}`, storeId })
        dotDomainCookies.forEach(addCookie)
      }

      // 4. Apex domain cookies
      if (apexDomain && apexDomain !== domain) {
        const apexCookies = await chrome.cookies.getAll({ domain: apexDomain, storeId })
        apexCookies.forEach(addCookie)
        const dotApexCookies = await chrome.cookies.getAll({ domain: `.${apexDomain}`, storeId })
        dotApexCookies.forEach(addCookie)
      }
    } catch (err) {
      console.error('[CookieEngine] Error capturing cookies:', err)
    }

    return Array.from(cookieMap.values())
  }

  /**
   * Clear all cookies associated with domain & apex domain in a specific cookie store.
   */
  static async clearDomainCookies(domain, apexDomain, storeId = '0') {
    if (!chrome?.cookies) return 0

    let removedCount = 0
    const targetCookies = new Map()

    try {
      const domains = [domain, `.${domain}`]
      if (apexDomain && apexDomain !== domain) {
        domains.push(apexDomain, `.${apexDomain}`)
      }

      for (const d of domains) {
        const cookies = await chrome.cookies.getAll({ domain: d, storeId })
        for (const c of cookies) {
          targetCookies.set(`${c.name}@${c.domain}${c.path}`, c)
        }
      }

      for (const cookie of targetCookies.values()) {
        const protocol = cookie.secure ? 'https://' : 'http://'
        const cleanHost = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain
        const removalUrl = `${protocol}${cleanHost}${cookie.path || '/'}`

        const details = {
          url: removalUrl,
          name: cookie.name,
          storeId: storeId
        }

        if (cookie.partitionKey) {
          details.partitionKey = cookie.partitionKey
        }

        try {
          const removed = await chrome.cookies.remove(details)
          if (removed) removedCount++
        } catch {
          // Continue removing others
        }
      }
    } catch (err) {
      console.error('[CookieEngine] Error clearing cookies:', err)
    }

    return removedCount
  }

  /**
   * Restore cookies into target store with complete constraint checking.
   */
  static async restoreCookies(cookies, targetStoreId = '0') {
    if (!chrome?.cookies || !cookies) return { success: 0, failed: 0 }

    let success = 0
    let failed = 0

    for (const cookie of cookies) {
      try {
        const protocol = cookie.secure ? 'https://' : 'http://'
        const cleanHost = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain
        const cookieUrl = `${protocol}${cleanHost}${cookie.path || '/'}`

        let sameSite = cookie.sameSite || 'unspecified'
        let secure = Boolean(cookie.secure)

        // Chrome requirement: SameSite=None (no_restriction) requires Secure=true
        if (sameSite === 'no_restriction') {
          secure = true
        }

        const setDetails = {
          url: cookieUrl,
          name: cookie.name,
          value: cookie.value,
          path: cookie.path || '/',
          secure: secure,
          httpOnly: Boolean(cookie.httpOnly),
          sameSite: sameSite,
          storeId: targetStoreId
        }

        // Host-only cookie check: Host-only and __Host- cookies must NOT have domain set
        const isHostPrefix = cookie.name.startsWith('__Host-')
        if (isHostPrefix) {
          setDetails.secure = true
          setDetails.path = '/'
        } else if (!cookie.hostOnly) {
          // Strip leading dot for chrome.cookies.set to avoid rejection in modern Chrome
          setDetails.domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain
        }

        // Expiration management
        if (!cookie.session && cookie.expirationDate) {
          const nowSec = Math.floor(Date.now() / 1000)
          if (cookie.expirationDate > nowSec) {
            setDetails.expirationDate = cookie.expirationDate
          } else {
            // Re-extend expired tokens by 6 months so session stays valid
            setDetails.expirationDate = nowSec + 180 * 24 * 60 * 60
          }
        }

        if (cookie.partitionKey) {
          setDetails.partitionKey = cookie.partitionKey
        }

        const res = await chrome.cookies.set(setDetails)
        if (res) {
          success++
        } else {
          failed++
        }
      } catch (err) {
        failed++
      }
    }

    return { success, failed }
  }
}

export class StorageEngine {
  /**
   * Capture LocalStorage & SessionStorage from tab.
   */
  static async captureStorage(tabId) {
    if (!chrome?.scripting) return { localStorage: {}, sessionStorage: {} }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => {
          const ls = {}
          const ss = {}

          try {
            for (let i = 0; i < window.localStorage.length; i++) {
              const key = window.localStorage.key(i)
              if (key) ls[key] = window.localStorage.getItem(key)
            }
          } catch (e) {}

          try {
            for (let i = 0; i < window.sessionStorage.length; i++) {
              const key = window.sessionStorage.key(i)
              if (key) ss[key] = window.sessionStorage.getItem(key)
            }
          } catch (e) {}

          return { localStorage: ls, sessionStorage: ss }
        }
      })

      if (results?.[0]?.result) {
        return results[0].result
      }
    } catch (err) {
      console.warn('[StorageEngine] Capture storage error:', err)
    }

    return { localStorage: {}, sessionStorage: {} }
  }

  /**
   * Restore LocalStorage & SessionStorage into tab.
   */
  static async restoreStorage(tabId, data) {
    if (!chrome?.scripting || !data) return

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        args: [data.localStorage || {}, data.sessionStorage || {}],
        func: (lsData, ssData) => {
          try {
            window.localStorage.clear()
            for (const [k, v] of Object.entries(lsData)) {
              window.localStorage.setItem(k, v)
            }
          } catch (e) {
            console.error('[StorageEngine] Error setting localStorage:', e)
          }

          try {
            window.sessionStorage.clear()
            for (const [k, v] of Object.entries(ssData)) {
              window.sessionStorage.setItem(k, v)
            }
          } catch (e) {
            console.error('[StorageEngine] Error setting sessionStorage:', e)
          }
        }
      })
    } catch (err) {
      console.warn('[StorageEngine] Restore storage error:', err)
    }
  }
}

export class IDBEngine {
  /**
   * Capture all IndexedDB databases, stores, indexes, and full records.
   */
  static async captureIndexedDB(tabId) {
    if (!chrome?.scripting) return null

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: async () => {
          if (!window.indexedDB || typeof window.indexedDB.databases !== 'function') {
            return null
          }

          try {
            const dbList = await window.indexedDB.databases()
            if (!dbList || dbList.length === 0) return null

            const databases = []

            for (const dbInfo of dbList) {
              if (!dbInfo.name) continue

              const dbData = await new Promise((resolve) => {
                const req = window.indexedDB.open(dbInfo.name, dbInfo.version)

                req.onerror = () => resolve(null)
                req.onblocked = () => resolve(null)

                req.onsuccess = async () => {
                  const db = req.result
                  const storeNames = Array.from(db.objectStoreNames)
                  const stores = []

                  if (storeNames.length === 0) {
                    db.close()
                    resolve({ name: dbInfo.name, version: dbInfo.version || 1, stores: [] })
                    return
                  }

                  try {
                    const tx = db.transaction(storeNames, 'readonly')

                    for (const storeName of storeNames) {
                      try {
                        const store = tx.objectStore(storeName)
                        const keyPath = store.keyPath
                        const autoIncrement = store.autoIncrement

                        // Capture indexes metadata
                        const indexes = []
                        for (let idxName of store.indexNames) {
                          try {
                            const idx = store.index(idxName)
                            indexes.push({
                              name: idx.name,
                              keyPath: idx.keyPath,
                              unique: idx.unique,
                              multiEntry: idx.multiEntry
                            })
                          } catch (e) {}
                        }

                        // Capture all records using cursor (no arbitrary limits)
                        const records = await new Promise((resRecords) => {
                          const items = []
                          const cursorReq = store.openCursor()

                          cursorReq.onsuccess = (e) => {
                            const cursor = e.target.result
                            if (cursor) {
                              let val = cursor.value
                              // Handle Uint8Array / binary
                              if (val instanceof Uint8Array) {
                                val = { __type: 'Uint8Array', data: Array.from(val) }
                              } else if (val instanceof ArrayBuffer) {
                                val = { __type: 'Uint8Array', data: Array.from(new Uint8Array(val)) }
                              }
                              items.push({
                                key: cursor.key,
                                value: val
                              })
                              cursor.continue()
                            } else {
                              resRecords(items)
                            }
                          }

                          cursorReq.onerror = () => resRecords([])
                        })

                        stores.push({
                          name: storeName,
                          keyPath,
                          autoIncrement,
                          indexes,
                          records
                        })
                      } catch (storeErr) {}
                    }

                    tx.oncomplete = () => {
                      db.close()
                      resolve({ name: dbInfo.name, version: dbInfo.version || 1, stores })
                    }
                    tx.onerror = () => {
                      db.close()
                      resolve({ name: dbInfo.name, version: dbInfo.version || 1, stores })
                    }
                  } catch (e) {
                    db.close()
                    resolve(null)
                  }
                }
              })

              if (dbData && dbData.stores.length > 0) {
                databases.push(dbData)
              }
            }

            return databases.length > 0 ? databases : null
          } catch (e) {
            return null
          }
        }
      })

      if (results?.[0]?.result) {
        return {
          databases: results[0].result,
          capturedAt: Date.now()
        }
      }
    } catch (err) {
      console.warn('[IDBEngine] IndexedDB capture error:', err)
    }

    return null
  }

  /**
   * Restore IndexedDB databases, stores, indexes, and records into tab.
   */
  static async restoreIndexedDB(tabId, snapshot) {
    if (!chrome?.scripting || !snapshot?.databases?.length) return

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        args: [snapshot.databases],
        func: async (databases) => {
          if (!window.indexedDB) return

          for (const dbData of databases) {
            try {
              await new Promise((resolve) => {
                const req = window.indexedDB.open(dbData.name, dbData.version)

                req.onupgradeneeded = (event) => {
                  const db = req.result
                  for (const storeData of dbData.stores) {
                    let store
                    if (!db.objectStoreNames.contains(storeData.name)) {
                      const options = {}
                      if (storeData.keyPath !== undefined) options.keyPath = storeData.keyPath
                      if (storeData.autoIncrement !== undefined) options.autoIncrement = storeData.autoIncrement
                      store = db.createObjectStore(storeData.name, options)
                    } else {
                      store = req.transaction.objectStore(storeData.name)
                    }

                    // Reconstruct all indexes!
                    if (storeData.indexes && Array.isArray(storeData.indexes)) {
                      for (const idx of storeData.indexes) {
                        if (!store.indexNames.contains(idx.name)) {
                          try {
                            store.createIndex(idx.name, idx.keyPath, {
                              unique: idx.unique,
                              multiEntry: idx.multiEntry
                            })
                          } catch (e) {}
                        }
                      }
                    }
                  }
                }

                req.onsuccess = async () => {
                  const db = req.result
                  const storeNames = Array.from(db.objectStoreNames)
                  const targetStores = dbData.stores
                    .map((s) => s.name)
                    .filter((n) => storeNames.includes(n))

                  if (targetStores.length === 0) {
                    db.close()
                    resolve()
                    return
                  }

                  try {
                    const tx = db.transaction(targetStores, 'readwrite')

                    for (const storeData of dbData.stores) {
                      if (!storeNames.includes(storeData.name)) continue
                      const store = tx.objectStore(storeData.name)

                      // Clear existing before restoring to prevent primary key collision
                      try { store.clear() } catch (e) {}

                      for (const rec of storeData.records) {
                        try {
                          let val = rec.value
                          if (val && val.__type === 'Uint8Array' && Array.isArray(val.data)) {
                            val = new Uint8Array(val.data)
                          }
                          if (rec.key !== undefined && !store.keyPath) {
                            store.put(val, rec.key)
                          } else {
                            store.put(val)
                          }
                        } catch (e) {}
                      }
                    }

                    tx.oncomplete = () => {
                      db.close()
                      resolve()
                    }
                    tx.onerror = () => {
                      db.close()
                      resolve()
                    }
                  } catch (e) {
                    db.close()
                    resolve()
                  }
                }

                req.onerror = () => resolve()
                req.onblocked = () => resolve()
              })
            } catch (err) {}
          }
        }
      })
    } catch (err) {
      console.warn('[IDBEngine] IndexedDB restore error:', err)
    }
  }
}

export class SessionManager {
  static STORAGE_KEY = 'session_pocket_prototype_vault'

  /**
   * Load stored sessions vault.
   */
  static async loadVault() {
    if (!chrome?.storage?.local) {
      return { version: 1, sessions: {}, activeSessions: {} }
    }
    const data = await chrome.storage.local.get(this.STORAGE_KEY)
    return data[this.STORAGE_KEY] || { version: 1, sessions: {}, activeSessions: {} }
  }

  /**
   * Save sessions vault.
   */
  static async saveVault(vault) {
    if (!chrome?.storage?.local) return
    await chrome.storage.local.set({ [this.STORAGE_KEY]: vault })
  }

  /**
   * Get active tab details.
   */
  static async getActiveTab() {
    if (!chrome?.tabs) return null
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab || !tab.url) return null

    const domainInfo = CookieEngine.parseDomain(tab.url)
    return {
      tabId: tab.id,
      url: tab.url,
      title: tab.title || 'Web Page',
      favIconUrl: tab.favIconUrl || '',
      isIncognito: Boolean(tab.incognito),
      ...domainInfo
    }
  }

  /**
   * Save the complete current tab session into vault.
   */
  static async saveCurrentSession(name, notes = '') {
    const tab = await this.getActiveTab()
    if (!tab || !tab.tabId || !tab.isValid) {
      throw new Error('No valid website open in active tab to save.')
    }

    const storeId = tab.isIncognito ? '1' : '0'

    // 1. Capture Cookies
    const cookies = await CookieEngine.captureCookies(
      tab.url,
      tab.domain,
      tab.apexDomain,
      storeId
    )

    // 2. Capture LocalStorage & SessionStorage
    const storage = await StorageEngine.captureStorage(tab.tabId)

    // 3. Capture IndexedDB
    const idbSnapshot = await IDBEngine.captureIndexedDB(tab.tabId)

    const now = Date.now()
    const session = {
      id: `pocket_${now}_${Math.random().toString(36).substring(2, 8)}`,
      name: name.trim() || 'Untitled Session',
      notes: notes.trim(),
      url: tab.url,
      domain: tab.domain,
      apexDomain: tab.apexDomain,
      origin: tab.origin,
      favIconUrl: tab.favIconUrl,
      createdAt: now,
      lastUsedAt: now,
      cookies,
      storage,
      idbSnapshot
    }

    const vault = await this.loadVault()
    vault.sessions[session.id] = session
    vault.activeSessions[session.domain] = session.id
    await this.saveVault(vault)

    return session
  }

  /**
   * Check if extension is allowed in incognito mode.
   */
  static async checkIncognitoAllowed() {
    if (!chrome?.extension?.isAllowedIncognitoAccess) return true
    return new Promise((resolve) => {
      chrome.extension.isAllowedIncognitoAccess((isAllowed) => {
        resolve(isAllowed)
      })
    })
  }

  /**
   * Launch a saved session into Current Tab, New Tab, or Incognito Window.
   * FIXES:
   * 1. Incognito Cookie Store ("1") is created BEFORE cookies are set.
   * 2. Storage & IDB are injected and page is refreshed so SPAs boot with complete state!
   */
  static async launchSession(sessionId, mode = 'current-tab') {
    const vault = await this.loadVault()
    const targetSession = vault.sessions[sessionId]
    if (!targetSession) {
      throw new Error('Session not found.')
    }

    if (mode === 'incognito') {
      const allowed = await this.checkIncognitoAllowed()
      if (!allowed) {
        throw new Error(
          'Extension is not enabled in Incognito!\nPlease go to chrome://extensions -> SessionPocket Prototype -> Details -> Enable "Allow in incognito".'
        )
      }

      // STEP 1: Open Incognito window with about:blank first!
      // This activates cookie storeId "1"!
      const win = await chrome.windows.create({
        incognito: true,
        url: 'about:blank'
      })

      const targetTab = win.tabs?.[0]
      if (!targetTab?.id) throw new Error('Failed to create incognito window.')

      // STEP 2: Clear any existing cookies and restore cookies into storeId "1"
      await CookieEngine.clearDomainCookies(targetSession.domain, targetSession.apexDomain, '1')
      await CookieEngine.restoreCookies(targetSession.cookies, '1')

      // STEP 3: Navigate tab to target URL
      await chrome.tabs.update(targetTab.id, { url: targetSession.url })

      // STEP 4: Inject storage and IDB, then reload once so app scripts boot with restored data
      this.attachFidelityRestorer(targetTab.id, targetSession)

    } else if (mode === 'new-tab') {
      // Normal New Tab
      await CookieEngine.clearDomainCookies(targetSession.domain, targetSession.apexDomain, '0')
      await CookieEngine.restoreCookies(targetSession.cookies, '0')

      const tab = await chrome.tabs.create({ url: targetSession.url, active: true })
      if (tab?.id) {
        this.attachFidelityRestorer(tab.id, targetSession)
      }
    } else {
      // Current Tab
      const currentTab = await this.getActiveTab()
      if (!currentTab?.tabId) throw new Error('No active tab found.')

      await CookieEngine.clearDomainCookies(targetSession.domain, targetSession.apexDomain, '0')
      await CookieEngine.restoreCookies(targetSession.cookies, '0')

      await chrome.tabs.update(currentTab.tabId, { url: targetSession.url })
      this.attachFidelityRestorer(currentTab.tabId, targetSession)
    }

    vault.activeSessions[targetSession.domain] = targetSession.id
    targetSession.lastUsedAt = Date.now()
    await this.saveVault(vault)
  }

  /**
   * Injects Storage + IDB and triggers reload to resolve SPA race conditions.
   */
  static attachFidelityRestorer(tabId, session) {
    if (!chrome?.tabs?.onUpdated) return

    let injected = false

    const listener = async (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete' && !injected) {
        injected = true
        chrome.tabs.onUpdated.removeListener(listener)

        // 1. Inject LocalStorage & SessionStorage
        if (session.storage) {
          await StorageEngine.restoreStorage(tabId, session.storage)
        }

        // 2. Inject IndexedDB
        if (session.idbSnapshot) {
          await IDBEngine.restoreIndexedDB(tabId, session.idbSnapshot)
        }

        // 3. Trigger a fast reload in MAIN world so single-page apps (React/Next/WhatsApp/etc.)
        // boot up reading the injected state immediately from origin root!
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: () => {
              // Mark flag so we don't loop
              if (!sessionStorage.getItem('__sp_restored_once__')) {
                sessionStorage.setItem('__sp_restored_once__', 'true')
                window.location.reload()
              }
            }
          })
        } catch (e) {}
      }
    }

    chrome.tabs.onUpdated.addListener(listener)

    // Cleanup timeout after 20 seconds
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
    }, 20000)
  }

  /**
   * Delete session by ID.
   */
  static async deleteSession(sessionId) {
    const vault = await this.loadVault()
    if (vault.sessions[sessionId]) {
      const domain = vault.sessions[sessionId].domain
      if (vault.activeSessions[domain] === sessionId) {
        delete vault.activeSessions[domain]
      }
      delete vault.sessions[sessionId]
      await this.saveVault(vault)
    }
  }

  /**
   * Export vault as JSON.
   */
  static async exportVault() {
    const vault = await this.loadVault()
    return JSON.stringify(vault, null, 2)
  }

  /**
   * Import vault from JSON string.
   */
  static async importVault(jsonStr) {
    const data = JSON.parse(jsonStr)
    if (!data.sessions) throw new Error('Invalid backup structure')
    const vault = await this.loadVault()
    vault.sessions = { ...vault.sessions, ...data.sessions }
    await this.saveVault(vault)
    return Object.keys(data.sessions).length
  }
}

