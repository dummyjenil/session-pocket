# SessionPocket Base Prototype 🚀

> **Pure Vanilla HTML, CSS & JavaScript Base Prototype for Complete Web Session Capture & Restoration**

---

## 📌 Problem Analysis: Incognito Mode me Website exact vaise kyu nahi khul rahi thi?

Jab aap kisi website par jaate hain aur uski session state save karte hain, toh incognito mode me restore karte waqt purana logic 3 major reasons se fail ho raha tha:

### 1. Incognito Cookie Store ID ("1") Ki Race Condition
* **Chrome Architecture**: Chrome me incognito cookie store (`storeId: "1"`) tab tak memory me exist nahi karta jab tak **at least ek incognito window open na ho**.
* **Purana Bug**: Purana code `CookieEngine.restoreCookies(..., "1")` ko incognito window create hone se **pehle** run kar raha tha. Is vajah se Chrome ne saare cookies silently reject kar diye. Incognito window bina kisi session/auth cookie ke load ho gayi.
* **Prototype Fix**: Prototype pehle `about:blank` ke saath incognito window initialize karta hai -> Store `"1"` activate hota hai -> Phir saare cookies store `"1"` me inject hote hain -> Uske baad target URL par navigation trigger hota hai.

### 2. Modern SPA Web Apps Script vs Storage Race Condition
* **Web App Lifecycle**: Modern websites (WhatsApp Web, React, Next.js, Twitter, Auth0, Supabase) page load hote hi (`document_start` par) turant `localStorage` aur `IndexedDB` check karti hain.
* **Purana Bug**: Purane extension me storage tab inject hota tha jab page ka status `"complete"` ho jaata tha. Tab tak website ki JavaScript ne empty storage dekhkar user ko `/login` par redirect kar diya tha! Aur page load complete hone ke baad inject karne par React re-render nahi hota jab tak refresh na ho.
* **Prototype Fix**: Storage aur IndexedDB inject karne ke baad prototype ek single atomic `location.reload()` trigger karta hai, jisse client app first frame se hi restored state ke sath initialize hoti hai.

### 3. "Sab Kaa Sab Store Honaa Chahiye" — Incomplete State Dimensions
* **Cookies**: Host-only cookies vs Domain cookies, `__Host-` prefix restrictions, aur `SameSite=None` me `Secure=true` mandatory enforce kiya gaya hai.
* **IndexedDB Object Store Indexes**: Purane code me sirf stores create hote the lekin unke **indexes** (`store.createIndex`) recreate nahi hote the. Agar website index query (`store.index('by_sender')`) karti thi toh error aata tha. Prototype saare indexes, keyPath, autoIncrement, aur binary data (`Uint8Array`) capture aur restore karta hai.
* **Record Limits**: Purane code me `100` records ki limit thi (`getAll(undefined, 100)`). Prototype me cursor-based unlimited streaming capture hai.

---

## 📂 Prototype Directory Structure

```
prototype/
├── manifest.json       # Manifest V3 extension configuration ("incognito": "spanning")
├── engine.js           # The Core Engine (CookieEngine, StorageEngine, IDBEngine, SessionManager)
├── popup.html          # Clean, minimal popup interface
├── popup.css           # Minimal modern dark theme styling
├── popup.js            # UI controller (Capture, Switch, Launch Current/New/Incognito, Export)
├── background.js       # Lightweight MV3 service worker
├── demo/               # Complete mock web application to test live state preservation
│   ├── index.html      # Demo dashboard simulating Alice (Work) & Bob (Personal) sessions
│   ├── demo.css        # Diagnostics layout
│   └── demo.js         # Full Cookies, LocalStorage, SessionStorage & IndexedDB with Indexes
└── README.md           # Documentation and testing guide
```

---

## 🧪 Kaise Test Karein (Step-by-Step)

### Step 1: Prototype Extension ko Chrome me Load Karein
1. Chrome browser open karein aur `chrome://extensions` par jayein.
2. Top-right me **Developer mode** toggle ON karein.
3. **Load unpacked** button par click karein.
4. Select karein: `/home/jenil-sheth/Videos/session-pocket/prototype` directory.
5. **Important**: Extension card par **Details** par click karein aur **"Allow in incognito"** toggle ko **ON** karein! (Incognito access ke bina koi bhi extension incognito tab me script run nahi kar sakti).

### Step 2: Demo Web App Open Karein
Aap demo app ko kisi local server se open kar sakte hain (e.g., Python ya Node):
```bash
cd /home/jenil-sheth/Videos/session-pocket/prototype/demo
python3 -m http.server 8080
```
Browser me open karein: `http://localhost:8080/`

### Step 3: Session Capture & Incognito Test
1. Demo app me click karein: **"Log In as Alice (Work)"**.
   - Aap dekhenge Cookies, LocalStorage, SessionStorage aur IndexedDB sabhi me Alice ka encrypted state populate ho gaya hai.
2. Extension icon par click karein -> Session Name likhein: `Alice Work` -> Click **"Capture Current Session"**.
   - Vault me session save ho jayega.
3. Ab usi demo tab me click karein: **"Log Out / Clear All State"** (ya "Log In as Bob").
4. Extension popup kholein aur `Alice Work` card par **🕶️ Incognito** button par click karein.
5. **Result**:
   - Incognito window open hogi.
   - Alice ka session exact vaise hi restore ho jayega!
   - Saare cookies, LocalStorage, SessionStorage, aur IndexedDB ke indexes & binary keys 100% matched honge!

