/**
 * SessionPocket Prototype - Background Service Worker
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[SessionPocket Prototype] Installed successfully.')
})

// Optional badge update when active tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId)
    if (!tab?.url) return
    const url = new URL(tab.url)
    const domain = url.hostname

    const data = await chrome.storage.local.get('session_pocket_prototype_vault')
    const vault = data['session_pocket_prototype_vault']
    if (vault?.activeSessions?.[domain]) {
      const sess = vault.sessions[vault.activeSessions[domain]]
      if (sess) {
        chrome.action.setBadgeText({ text: sess.name.slice(0, 3).toUpperCase() })
        chrome.action.setBadgeBackgroundColor({ color: '#4f46e5' })
        return
      }
    }
    chrome.action.setBadgeText({ text: '' })
  } catch (e) {}
})

