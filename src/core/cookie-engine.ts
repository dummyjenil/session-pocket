import type { SameSiteStatus, SessionCookie } from "~types"

/**
 * Cookie Engine for capturing, cleaning, and restoring cookies with full fidelity.
 */
export class CookieEngine {
  /**
   * Capture all cookies relevant to a given URL and its apex/subdomains.
   */
  static async captureCookies(
    url: string,
    domain: string,
    apexDomain: string,
    storeId: string = "0"
  ): Promise<SessionCookie[]> {
    if (!chrome?.cookies) {
      console.warn("chrome.cookies API is unavailable")
      return []
    }

    const cookieMap = new Map<string, SessionCookie>()

    const addCookie = (c: chrome.cookies.Cookie) => {
      const key = `${c.name}@${c.domain}${c.path}`
      if (cookieMap.has(key)) return

      const sessionCookie: SessionCookie = {
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        secure: c.secure,
        httpOnly: c.httpOnly,
        sameSite: (c.sameSite as SameSiteStatus) || "unspecified",
        expirationDate: c.expirationDate,
        hostOnly: c.hostOnly,
        session: c.session,
        partitionKey: (c as any).partitionKey
      }
      cookieMap.set(key, sessionCookie)
    }

    try {
      // 1. Direct URL cookies
      const urlCookies = await chrome.cookies.getAll({ url, storeId })
      urlCookies.forEach(addCookie)

      // 2. Exact domain cookies
      const domainCookies = await chrome.cookies.getAll({ domain, storeId })
      domainCookies.forEach(addCookie)

      // 3. Dot-prefixed domain cookies
      if (!domain.startsWith(".")) {
        const dotDomainCookies = await chrome.cookies.getAll({ domain: `.${domain}`, storeId })
        dotDomainCookies.forEach(addCookie)
      }

      // 4. Apex domain cookies (if different from domain)
      if (apexDomain && apexDomain !== domain) {
        const apexCookies = await chrome.cookies.getAll({ domain: apexDomain, storeId })
        apexCookies.forEach(addCookie)

        const dotApexCookies = await chrome.cookies.getAll({ domain: `.${apexDomain}`, storeId })
        dotApexCookies.forEach(addCookie)
      }

      // 5. Special multi-domain session handlers (e.g. YouTube & Google auth)
      if (apexDomain === "youtube.com") {
        const googleCookies = await chrome.cookies.getAll({ domain: ".google.com", storeId })
        // Capture Google auth tokens associated with YouTube
        const relevantGoogleNames = new Set([
          "SID",
          "HSID",
          "SSID",
          "APISID",
          "SAPISID",
          "LOGIN_INFO",
          "__Secure-1PSID",
          "__Secure-3PSID",
          "__Secure-1PAPISID",
          "__Secure-3PAPISID",
          "__Secure-1PSIDTS",
          "__Secure-3PSIDTS",
          "OSID",
          "__Secure-OSID"
        ])
        googleCookies
          .filter((c) => relevantGoogleNames.has(c.name) || c.name.startsWith("__Secure-"))
          .forEach(addCookie)
      }
    } catch (err) {
      console.error("Error capturing cookies:", err)
    }

    return Array.from(cookieMap.values())
  }

  /**
   * Clear all cookies associated with a domain and its apex domain.
   */
  static async clearDomainCookies(
    domain: string,
    apexDomain: string,
    storeId: string = "0"
  ): Promise<number> {
    if (!chrome?.cookies) return 0

    let removedCount = 0
    const targetCookies = new Map<string, chrome.cookies.Cookie>()

    try {
      const domainsToSearch = [domain, `.${domain}`]
      if (apexDomain && apexDomain !== domain) {
        domainsToSearch.push(apexDomain, `.${apexDomain}`)
      }

      for (const d of domainsToSearch) {
        const cookies = await chrome.cookies.getAll({ domain: d, storeId })
        for (const c of cookies) {
          targetCookies.set(`${c.name}@${c.domain}${c.path}`, c)
        }
      }

      // If YouTube, also clear youtube-specific google cookies
      if (apexDomain === "youtube.com") {
        const ytCookies = await chrome.cookies.getAll({ domain: ".youtube.com", storeId })
        for (const c of ytCookies) {
          targetCookies.set(`${c.name}@${c.domain}${c.path}`, c)
        }
      }

      for (const cookie of targetCookies.values()) {
        const protocol = cookie.secure ? "https://" : "http://"
        const cleanHost = cookie.domain.startsWith(".") ? cookie.domain.slice(1) : cookie.domain
        const removalUrl = `${protocol}${cleanHost}${cookie.path || "/"}`

        const removeDetails: chrome.cookies.Details = {
          url: removalUrl,
          name: cookie.name,
          storeId: storeId
        }

        if ((cookie as any).partitionKey) {
          ;(removeDetails as any).partitionKey = (cookie as any).partitionKey
        }

        try {
          const removed = await chrome.cookies.remove(removeDetails)
          if (removed) removedCount++
        } catch (removeErr) {
          // Continue removing other cookies if one fails
        }
      }
    } catch (err) {
      console.error("Error clearing domain cookies:", err)
    }

    return removedCount
  }

  /**
   * Restores a list of SessionCookies into the target cookie store.
   */
  static async restoreCookies(
    cookies: SessionCookie[],
    targetStoreId: string = "0"
  ): Promise<{ success: number; failed: number }> {
    if (!chrome?.cookies) return { success: 0, failed: 0 }

    let success = 0
    let failed = 0

    for (const cookie of cookies) {
      try {
        const protocol = cookie.secure ? "https://" : "http://"
        const cleanHost = cookie.domain.startsWith(".") ? cookie.domain.slice(1) : cookie.domain
        const cookieUrl = `${protocol}${cleanHost}${cookie.path || "/"}`

        const setDetails: chrome.cookies.SetDetails = {
          url: cookieUrl,
          name: cookie.name,
          value: cookie.value,
          path: cookie.path || "/",
          secure: Boolean(cookie.secure),
          httpOnly: Boolean(cookie.httpOnly),
          sameSite: cookie.sameSite || "unspecified",
          storeId: targetStoreId
        }

        // Only set domain if it is NOT a host-only cookie
        if (!cookie.hostOnly) {
          setDetails.domain = cookie.domain
        }

        // Expiration: keep valid or make persistent if session expired
        if (!cookie.session && cookie.expirationDate) {
          const nowSec = Math.floor(Date.now() / 1000)
          if (cookie.expirationDate > nowSec) {
            setDetails.expirationDate = cookie.expirationDate
          } else {
            // Set 1 year in future if it was expired
            setDetails.expirationDate = nowSec + 365 * 24 * 60 * 60
          }
        }

        if (cookie.partitionKey) {
          ;(setDetails as any).partitionKey = cookie.partitionKey
        }

        const result = await chrome.cookies.set(setDetails)
        if (result) {
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

