const DB_NAME = 'demo_workspace_db'
const DB_VERSION = 1

// DOM Elements
const authBadge = document.getElementById('authBadge')
const btnLoginAlice = document.getElementById('btnLoginAlice')
const btnLoginBob = document.getElementById('btnLoginBob')
const btnLogout = document.getElementById('btnLogout')
const cookieDisplay = document.getElementById('cookieDisplay')
const cookieCount = document.getElementById('cookieCount')
const lsDisplay = document.getElementById('lsDisplay')
const lsCount = document.getElementById('lsCount')
const ssDisplay = document.getElementById('ssDisplay')
const ssCount = document.getElementById('ssCount')
const idbDisplay = document.getElementById('idbDisplay')
const idbCount = document.getElementById('idbCount')
const indexTestResult = document.getElementById('indexTestResult')

/**
 * Initialize / Open IndexedDB
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = req.result

      // 1. Users store with email index
      if (!db.objectStoreNames.contains('users')) {
        const userStore = db.createObjectStore('users', { keyPath: 'id' })
        userStore.createIndex('by_email', 'email', { unique: true })
      }

      // 2. Messages store with sender index
      if (!db.objectStoreNames.contains('messages')) {
        const msgStore = db.createObjectStore('messages', { keyPath: 'msg_id' })
        msgStore.createIndex('by_sender', 'sender', { unique: false })
      }

      // 3. Crypto keys store (binary Uint8Array payloads)
      if (!db.objectStoreNames.contains('crypto_keys')) {
        db.createObjectStore('crypto_keys')
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Populate Mock State for User
 */
async function loginUser(name, email, role, secretKey) {
  // 1. Set Cookies
  document.cookie = `auth_token=jwt_${name.toLowerCase()}_${Date.now()}; path=/; max-age=86400`
  document.cookie = `session_user=${name}; path=/; max-age=86400`

  // 2. Set LocalStorage
  localStorage.setItem('user_profile', JSON.stringify({ name, email, role, loggedInAt: new Date().toISOString() }))
  localStorage.setItem('auth_bearer', `Bearer token-${Math.random().toString(36).substring(2)}`)
  localStorage.setItem('theme_preference', name === 'Alice' ? 'dark-indigo' : 'light-emerald')

  // 3. Set SessionStorage
  sessionStorage.setItem('active_tab_context', `workspace_${name.toLowerCase()}`)
  sessionStorage.setItem('workflow_step', 'dashboard_overview')

  // 4. Set IndexedDB (Stores + Indexes + Binary Data)
  const db = await openDB()
  const tx = db.transaction(['users', 'messages', 'crypto_keys'], 'readwrite')

  // Store 1: User
  tx.objectStore('users').put({ id: `usr_${name.toLowerCase()}`, name, email, role })

  // Store 2: Messages
  tx.objectStore('messages').put({
    msg_id: `msg_1_${name.toLowerCase()}`,
    sender: name,
    content: `Hello from ${name}'s private encrypted session!`,
    timestamp: Date.now()
  })

  // Store 3: Binary Crypto Key (Uint8Array)
  const binaryKey = new Uint8Array([10, 20, 30, 40, 50, name.charCodeAt(0)])
  tx.objectStore('crypto_keys').put(binaryKey, 'session_private_key')

  await new Promise((res) => {
    tx.oncomplete = () => {
      db.close()
      res()
    }
  })

  await refreshUI()
}

/**
 * Clear All State
 */
async function clearAllState() {
  // Clear Cookies
  const cookies = document.cookie.split(';')
  for (let c of cookies) {
    const eqPos = c.indexOf('=')
    const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim()
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
  }

  // Clear Web Storage
  localStorage.clear()
  sessionStorage.clear()

  // Delete IndexedDB
  await new Promise((resolve) => {
    const req = window.indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
  })

  await refreshUI()
}

/**
 * Refresh UI & Verify Index Query
 */
async function refreshUI() {
  // 1. Cookies
  const rawCookies = document.cookie ? document.cookie.split(';').map(c => c.trim()) : []
  cookieCount.textContent = rawCookies.length
  cookieDisplay.textContent = rawCookies.length ? rawCookies.join('\n') : 'No cookies present.'

  // 2. LocalStorage
  const lsData = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    lsData[k] = localStorage.getItem(k)
  }
  lsCount.textContent = Object.keys(lsData).length
  lsDisplay.textContent = Object.keys(lsData).length ? JSON.stringify(lsData, null, 2) : 'LocalStorage is empty.'

  // 3. SessionStorage
  const ssData = {}
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i)
    ssData[k] = sessionStorage.getItem(k)
  }
  ssCount.textContent = Object.keys(ssData).length
  ssDisplay.textContent = Object.keys(ssData).length ? JSON.stringify(ssData, null, 2) : 'SessionStorage is empty.'

  // Check Profile
  const profileRaw = localStorage.getItem('user_profile')
  if (profileRaw) {
    try {
      const prof = JSON.parse(profileRaw)
      authBadge.className = 'badge badge-logged-in'
      authBadge.textContent = `Active: ${prof.name} (${prof.role})`
    } catch {
      authBadge.className = 'badge badge-logged-out'
      authBadge.textContent = 'Guest / Logged Out'
    }
  } else {
    authBadge.className = 'badge badge-logged-out'
    authBadge.textContent = 'Guest / Logged Out'
  }

  // 4. IndexedDB Diagnostics & Index Query Verification
  try {
    if (!window.indexedDB.databases) {
      idbDisplay.textContent = 'indexedDB.databases() not supported in this context.'
      return
    }

    const dbs = await window.indexedDB.databases()
    idbCount.textContent = `${dbs.length} DB(s)`

    if (dbs.length === 0) {
      idbDisplay.textContent = 'No IndexedDB databases found.'
      indexTestResult.className = 'index-result'
      indexTestResult.textContent = 'No database active.'
      return
    }

    const db = await openDB()
    const tx = db.transaction(['users', 'messages', 'crypto_keys'], 'readonly')

    const users = await new Promise((res) => {
      tx.objectStore('users').getAll().onsuccess = (e) => res(e.target.result || [])
    })
    const messages = await new Promise((res) => {
      tx.objectStore('messages').getAll().onsuccess = (e) => res(e.target.result || [])
    })
    const cryptoKey = await new Promise((res) => {
      tx.objectStore('crypto_keys').get('session_private_key').onsuccess = (e) => res(e.target.result)
    })

    db.close()

    idbDisplay.textContent = JSON.stringify({
      usersCount: users.length,
      messages: messages,
      cryptoKeyRecovered: cryptoKey ? (cryptoKey instanceof Uint8Array ? Array.from(cryptoKey) : cryptoKey) : null
    }, null, 2)

    // Verify Index query specifically!
    const testDb = await openDB()
    const testTx = testDb.transaction(['messages'], 'readonly')
    const msgStore = testTx.objectStore('messages')

    if (!msgStore.indexNames.contains('by_sender')) {
      indexTestResult.className = 'index-result fail'
      indexTestResult.textContent = '❌ FAIL: Index "by_sender" is MISSING from messages store!'
    } else {
      const idx = msgStore.index('by_sender')
      const indexedQuery = await new Promise((res) => {
        const q = idx.getAll()
        q.onsuccess = (e) => res(e.target.result || [])
        q.onerror = () => res(null)
      })

      if (indexedQuery && indexedQuery.length > 0) {
        indexTestResult.className = 'index-result pass'
        indexTestResult.textContent = `✅ PASS: Index "by_sender" exists and successfully queried ${indexedQuery.length} record(s)!`
      } else {
        indexTestResult.className = 'index-result'
        indexTestResult.textContent = 'Index exists, waiting for records...'
      }
    }
    testDb.close()

  } catch (err) {
    idbDisplay.textContent = `IndexedDB Error: ${err.message}`
  }
}

// Event Listeners
btnLoginAlice.addEventListener('click', () => {
  loginUser('Alice', 'alice@workcorp.internal', 'Lead Engineer', 'secret_key_alice_999')
})

btnLoginBob.addEventListener('click', () => {
  loginUser('Bob', 'bob@personalmail.me', 'Freelancer', 'secret_key_bob_123')
})

btnLogout.addEventListener('click', () => {
  clearAllState()
})

// Initial Refresh
refreshUI()

