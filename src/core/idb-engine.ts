import type { IDBDatabaseData, IDBSnapshot, IDBStoreData } from "~types"

/**
 * IndexedDB Engine for capturing and restoring IndexedDB databases in the target tab.
 * Crucial for WhatsApp Web and modern PWAs where authentication tokens are persisted in IndexedDB.
 */
export class IDBEngine {
  /**
   * Capture IndexedDB snapshots for an origin.
   */
  static async captureIndexedDB(tabId: number): Promise<IDBSnapshot | undefined> {
    if (!chrome?.scripting) return undefined

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: async () => {
          if (!window.indexedDB || typeof window.indexedDB.databases !== "function") {
            return null
          }

          try {
            const dbList = await window.indexedDB.databases()
            if (!dbList || dbList.length === 0) return null

            const databases: any[] = []

            for (const dbInfo of dbList) {
              if (!dbInfo.name) continue

              try {
                const dbData = await new Promise<any>((resolve) => {
                  const req = window.indexedDB.open(dbInfo.name!, dbInfo.version)

                  req.onerror = () => resolve(null)
                  req.onblocked = () => resolve(null)

                  req.onsuccess = async () => {
                    const db = req.result
                    const storeNames = Array.from(db.objectStoreNames)
                    const stores: any[] = []

                    if (storeNames.length === 0) {
                      db.close()
                      resolve({ name: dbInfo.name, version: dbInfo.version || 1, stores })
                      return
                    }

                    try {
                      const tx = db.transaction(storeNames, "readonly")

                      for (const storeName of storeNames) {
                        try {
                          const store = tx.objectStore(storeName)
                          const keyPath = store.keyPath
                          const autoIncrement = store.autoIncrement

                          // Fetch up to 100 records per store to capture auth/session state safely
                          const records: any[] = await new Promise((resStore) => {
                            const getAllReq = store.getAll(undefined, 100)
                            const getKeysReq = store.getAllKeys(undefined, 100)

                            getAllReq.onerror = () => resStore([])
                            getAllReq.onsuccess = () => {
                              getKeysReq.onsuccess = () => {
                                const vals = getAllReq.result || []
                                const keys = getKeysReq.result || []
                                const combined = vals.map((val: any, idx: number) => {
                                  try {
                                    // Handle Uint8Array/ArrayBuffer if present
                                    let safeVal = val
                                    if (val instanceof Uint8Array) {
                                      safeVal = { __type: "Uint8Array", data: Array.from(val) }
                                    }
                                    return {
                                      key: keys[idx],
                                      value: safeVal
                                    }
                                  } catch {
                                    return { key: keys[idx], value: null }
                                  }
                                })
                                resStore(combined)
                              }
                              getKeysReq.onerror = () => {
                                resStore(
                                  (getAllReq.result || []).map((val: any) => ({ value: val }))
                                )
                              }
                            }
                          })

                          stores.push({
                            name: storeName,
                            keyPath,
                            autoIncrement,
                            records
                          })
                        } catch (storeErr) {
                          // Continue to other stores
                        }
                      }

                      tx.oncomplete = () => {
                        db.close()
                        resolve({
                          name: dbInfo.name,
                          version: dbInfo.version || 1,
                          stores
                        })
                      }
                      tx.onerror = () => {
                        db.close()
                        resolve({
                          name: dbInfo.name,
                          version: dbInfo.version || 1,
                          stores
                        })
                      }
                    } catch {
                      db.close()
                      resolve(null)
                    }
                  }
                })

                if (dbData && dbData.stores.length > 0) {
                  databases.push(dbData)
                }
              } catch (dbErr) {
                // Continue to next DB
              }
            }

            return databases.length > 0 ? databases : null
          } catch (e) {
            return null
          }
        }
      })

      if (results && results[0] && results[0].result) {
        return {
          databases: results[0].result as IDBDatabaseData[],
          capturedAt: Date.now()
        }
      }
    } catch (err) {
      console.warn("IndexedDB capture failed:", err)
    }

    return undefined
  }

  /**
   * Restore IndexedDB databases into a target tab.
   */
  static async restoreIndexedDB(tabId: number, snapshot: IDBSnapshot): Promise<void> {
    if (!chrome?.scripting || !snapshot || !snapshot.databases?.length) return

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        args: [snapshot.databases],
        func: async (databases: any[]) => {
          if (!window.indexedDB) return

          for (const dbData of databases) {
            try {
              await new Promise<void>((resolve) => {
                const req = window.indexedDB.open(dbData.name, dbData.version)

                req.onupgradeneeded = (event) => {
                  const db = req.result
                  for (const storeData of dbData.stores) {
                    if (!db.objectStoreNames.contains(storeData.name)) {
                      const options: IDBObjectStoreParameters = {}
                      if (storeData.keyPath !== undefined) options.keyPath = storeData.keyPath
                      if (storeData.autoIncrement !== undefined)
                        options.autoIncrement = storeData.autoIncrement
                      db.createObjectStore(storeData.name, options)
                    }
                  }
                }

                req.onsuccess = async () => {
                  const db = req.result
                  const storeNames = Array.from(db.objectStoreNames)
                  const targetStores = dbData.stores
                    .map((s: any) => s.name)
                    .filter((n: string) => storeNames.includes(n))

                  if (targetStores.length === 0) {
                    db.close()
                    resolve()
                    return
                  }

                  try {
                    const tx = db.transaction(targetStores, "readwrite")

                    for (const storeData of dbData.stores) {
                      if (!storeNames.includes(storeData.name)) continue
                      const store = tx.objectStore(storeData.name)

                      for (const rec of storeData.records) {
                        try {
                          let val = rec.value
                          if (val && val.__type === "Uint8Array" && Array.isArray(val.data)) {
                            val = new Uint8Array(val.data)
                          }
                          if (rec.key !== undefined && !store.keyPath) {
                            store.put(val, rec.key)
                          } else {
                            store.put(val)
                          }
                        } catch {
                          // Continue with next record
                        }
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
                  } catch {
                    db.close()
                    resolve()
                  }
                }

                req.onerror = () => resolve()
                req.onblocked = () => resolve()
              })
            } catch {
              // Ignore single db failure
            }
          }
        }
      })
    } catch (err) {
      console.warn("Error restoring IndexedDB:", err)
    }
  }
}

