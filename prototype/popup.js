import { SessionManager } from './engine.js'

// DOM Elements
const tabFavicon = document.getElementById('tabFavicon')
const tabDomain = document.getElementById('tabDomain')
const tabContext = document.getElementById('tabContext')
const inputSessionName = document.getElementById('inputSessionName')
const btnSaveSession = document.getElementById('btnSaveSession')
const sessionList = document.getElementById('sessionList')
const sessionCount = document.getElementById('sessionCount')
const statusMessage = document.getElementById('statusMessage')
const btnExport = document.getElementById('btnExport')
const btnImportTrigger = document.getElementById('btnImportTrigger')
const fileImport = document.getElementById('fileImport')
const detailModal = document.getElementById('detailModal')
const modalTitle = document.getElementById('modalTitle')
const modalBody = document.getElementById('modalBody')
const btnCloseModal = document.getElementById('btnCloseModal')

let currentActiveTab = null

/**
 * Display ephemeral status banner
 */
function showStatus(message, isError = false) {
  statusMessage.textContent = message
  statusMessage.className = `status-message ${isError ? 'status-error' : 'status-success'}`
  statusMessage.style.display = 'block'
  setTimeout(() => {
    statusMessage.style.display = 'none'
  }, 4000)
}

/**
 * Initialize active tab display
 */
async function initActiveTab() {
  try {
    currentActiveTab = await SessionManager.getActiveTab()
    if (!currentActiveTab || !currentActiveTab.isValid) {
      tabDomain.textContent = 'Non-web page (Settings/Blank)'
      tabContext.textContent = 'Cannot save this tab'
      btnSaveSession.disabled = true
      return
    }

    tabDomain.textContent = currentActiveTab.domain
    tabContext.textContent = currentActiveTab.isIncognito ? '🕶️ Incognito Window' : '🌐 Standard Window'
    if (currentActiveTab.favIconUrl) {
      tabFavicon.src = currentActiveTab.favIconUrl
    }
  } catch (err) {
    console.error('Init active tab failed:', err)
  }
}

/**
 * Render all saved sessions
 */
async function renderSessions() {
  const vault = await SessionManager.loadVault()
  const sessions = Object.values(vault.sessions || {}).sort((a, b) => b.lastUsedAt - a.lastUsedAt)

  sessionCount.textContent = sessions.length
  sessionList.innerHTML = ''

  if (sessions.length === 0) {
    sessionList.innerHTML = `
      <div class="empty-state">
        No sessions saved yet.<br>Click "Capture Current Session" above to store this page's complete state.
      </div>
    `
    return
  }

  sessions.forEach((sess) => {
    const card = document.createElement('div')
    card.className = 'session-card'

    const cookieCount = sess.cookies ? sess.cookies.length : 0
    const lsCount = sess.storage?.localStorage ? Object.keys(sess.storage.localStorage).length : 0
    const ssCount = sess.storage?.sessionStorage ? Object.keys(sess.storage.sessionStorage).length : 0
    const idbCount = sess.idbSnapshot?.databases ? sess.idbSnapshot.databases.length : 0

    card.innerHTML = `
      <div class="session-header-row">
        <div>
          <div class="session-name">${escapeHtml(sess.name)}</div>
          <span class="session-domain-tag">${escapeHtml(sess.domain)}</span>
        </div>
        <button class="btn-icon btn-inspect" data-id="${sess.id}" title="Inspect Vault Contents">🔍</button>
      </div>

      <div class="session-stats">
        <span class="session-stat-item" title="Cookies captured">🍪 ${cookieCount}</span>
        <span class="session-stat-item" title="LocalStorage keys">📦 LS: ${lsCount}</span>
        <span class="session-stat-item" title="SessionStorage keys">⏳ SS: ${ssCount}</span>
        <span class="session-stat-item" title="IndexedDB databases">🗄️ IDB: ${idbCount}</span>
      </div>

      <div class="session-actions">
        <button class="btn-launch btn-current" data-id="${sess.id}">Current Tab</button>
        <button class="btn-launch btn-new" data-id="${sess.id}">New Tab</button>
        <button class="btn-launch btn-incognito" data-id="${sess.id}" title="Launch isolated in Incognito">🕶️ Incognito</button>
        <button class="btn-delete" data-id="${sess.id}" title="Delete session">🗑️</button>
      </div>
    `

    // Event listeners
    card.querySelector('.btn-current').addEventListener('click', () => handleLaunch(sess.id, 'current-tab'))
    card.querySelector('.btn-new').addEventListener('click', () => handleLaunch(sess.id, 'new-tab'))
    card.querySelector('.btn-incognito').addEventListener('click', () => handleLaunch(sess.id, 'incognito'))
    card.querySelector('.btn-delete').addEventListener('click', () => handleDelete(sess.id))
    card.querySelector('.btn-inspect').addEventListener('click', () => showInspectionModal(sess))

    sessionList.appendChild(card)
  })
}

/**
 * Handle Launch Action
 */
async function handleLaunch(sessionId, mode) {
  try {
    showStatus(`Restoring session in ${mode}...`)
    await SessionManager.launchSession(sessionId, mode)
    showStatus(`Session restored successfully in ${mode}!`)
    await renderSessions()
  } catch (err) {
    showStatus(err.message || 'Failed to restore session.', true)
  }
}

/**
 * Handle Save Current Session
 */
btnSaveSession.addEventListener('click', async () => {
  const name = inputSessionName.value.trim()
  if (!name) {
    showStatus('Please enter a session name.', true)
    inputSessionName.focus()
    return
  }

  try {
    btnSaveSession.disabled = true
    btnSaveSession.textContent = '⏳ Capturing Deep State...'
    showStatus('Capturing cookies, storage & IndexedDB...')

    const session = await SessionManager.saveCurrentSession(name)
    inputSessionName.value = ''
    showStatus(`Session "${session.name}" captured with full fidelity!`)
    await renderSessions()
  } catch (err) {
    showStatus(err.message || 'Error capturing session.', true)
  } finally {
    btnSaveSession.disabled = false
    btnSaveSession.innerHTML = '<span>💾 Capture Current Session (Full Vault)</span>'
  }
})

/**
 * Handle Delete Session
 */
async function handleDelete(sessionId) {
  if (confirm('Delete this saved session pocket?')) {
    await SessionManager.deleteSession(sessionId)
    showStatus('Session deleted.')
    await renderSessions()
  }
}

/**
 * Inspect Session Details Modal
 */
function showInspectionModal(session) {
  modalTitle.textContent = `Vault Details: ${session.name}`
  const summary = {
    id: session.id,
    domain: session.domain,
    url: session.url,
    capturedAt: new Date(session.createdAt).toLocaleString(),
    cookiesCount: session.cookies?.length || 0,
    localStorageKeys: Object.keys(session.storage?.localStorage || {}),
    sessionStorageKeys: Object.keys(session.storage?.sessionStorage || {}),
    indexedDB: (session.idbSnapshot?.databases || []).map((db) => ({
      dbName: db.name,
      version: db.version,
      stores: db.stores.map((s) => ({
        storeName: s.name,
        indexes: s.indexes?.map((i) => i.name) || [],
        recordsCaptured: s.records?.length || 0
      }))
    }))
  }

  modalBody.innerHTML = `
    <p style="margin-bottom: 8px;"><strong>Domain:</strong> ${escapeHtml(session.domain)}</p>
    <p style="margin-bottom: 8px;"><strong>Full State JSON Summary:</strong></p>
    <pre>${escapeHtml(JSON.stringify(summary, null, 2))}</pre>
  `
  detailModal.style.display = 'flex'
}

btnCloseModal.addEventListener('click', () => {
  detailModal.style.display = 'none'
})

/**
 * Export Backup JSON
 */
btnExport.addEventListener('click', async () => {
  try {
    const json = await SessionManager.exportVault()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sessionpocket-backup-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    showStatus('Backup exported successfully!')
  } catch (err) {
    showStatus('Failed to export backup.', true)
  }
})

/**
 * Import Backup JSON
 */
btnImportTrigger.addEventListener('click', () => {
  fileImport.click()
})

fileImport.addEventListener('change', async (e) => {
  const file = e.target.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const count = await SessionManager.importVault(text)
    showStatus(`Imported ${count} sessions successfully!`)
    await renderSessions()
  } catch (err) {
    showStatus('Invalid backup file format.', true)
  } finally {
    fileImport.value = ''
  }
})

function escapeHtml(str) {
  if (!str) return ''
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[m])
}

// Initialization
initActiveTab()
renderSessions()

