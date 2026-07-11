# Personal Knowledge & Link Keeper

A secure, offline-first Single Page Application (SPA) designed to act as your custom personal knowledge base and bookmark manager. It allows you to organize bookmarks, markdown notes, and sensitive credentials with complete piece of mind, featuring a zero-knowledge local AES vault and a real cloud-sync database powered by Google Sheets and Google Apps Script.

---

## 🚀 Key Features

*   **Dashboard View:** Custom card panels displaying title, category badges, note logs, and interactive tag chips.
*   **Search Engine:** Instant, real-time typing-based filters across titles, note bodies, tags, categories, services, and accounts.
*   **Multi-Category Filtering:** Multi-select filtering chips combined with tag clouds for instantaneous, layered catalog exploration.
*   **Secure Password Vault:** Zero-knowledge client-side credential vault. Plaintext passwords never cross the network or touch local cache; they are encrypted/decrypted on-the-fly using AES-256 via CryptoJS.
*   **Inactivity Auto-Lock:** Protection shield that automatically flushes keys from React memory and locks the vault after 5 minutes of browser idle time.
*   **Dynamic Quick Add:** A structured form with inline tab controls and client-side validation for instant links, text notes, and credential card saving.
*   **Google Sheets REST API:** Seamless fetch/push synchronization with your own Google Sheet.
*   **PWA Ready:** Manifest.json and service worker pre-caching are fully registered for native-like installation and robust offline application loading.
*   **Export/Import Engine:** Encrypted settings, links, and credentials can be exported as a `.json` download or imported for offline migration.

---

## 📁 Workspace Folder Structure

```
├── /backend                      # Google Apps Script Server Files
│   ├── Code.gs                   # Standard API router, doGet() and doPost() entries
│   ├── LinkService.gs            # Link CRUD transactions (add, update, delete)
│   ├── VaultService.gs           # Credentials CRUD transactions (add, update, delete)
│   ├── Utils.gs                  # Initialization, CORS text headers, UUID gen, auth tokens
│   ├── Security.gs               # Server-side safety explanations
│   └── API.gs                    # API endpoint JSON schemas and examples
├── /public                       # Progressive Web App assets
│   ├── manifest.json             # Web App Manifest parameters
│   └── service-worker.js         # Offline cache shell configurations
├── /src                          # React SPA Client Source
│   ├── components/               # Modular UI Components
│   │   ├── Dashboard.tsx         # Bookmark card list and category filters
│   │   ├── Vault.tsx             # Locked master credentials and copy utilities
│   │   ├── QuickAdd.tsx          # Dynamic input form and validation controls
│   │   └── SettingsPanel.tsx     # Cloud syncing forms and custom category tables
│   ├── lib/
│   │   └── api.ts                # Storage router (LocalStorage or Web App REST Fetcher)
│   ├── App.tsx                   # Master state container & theme engine
│   ├── types.ts                  # Shared typings and schema interfaces
│   ├── main.tsx                  # Application entry mounting script
│   └── index.css                 # Global Tailwind variables and pairing font imports
├── index.html                    # Root HTML frame with SW registration
├── package.json                  # Workspace dependencies
└── README.md                     # Comprehensive technical documentation
```

---

## 🔒 Zero-Knowledge Security Explained

To guarantee complete privacy of your credentials:
1.  **No Plaintext Transmission:** Passwords are encrypted inside the browser using **CryptoJS.AES-256** prior to sending them over the internet or storing them in LocalStorage.
2.  **No Storing of Master Passwords:** Your Master Password is **never** saved in LocalStorage, nor is it sent to Google Sheets. Instead, when you set up your Master Password:
    *   We encrypt the verification string `"link-keeper-verify"` using your password. This ciphertext is saved as `masterPasswordHash`.
    *   When you unlock, we attempt to decrypt `masterPasswordHash` with your entered password. If it successfully results in `"link-keeper-verify"`, the password is correct!
    *   The decryption key is kept strictly in transient React component state memory. If you refresh the page or remain inactive for **5 minutes**, the variable is immediately garbage-collected and your Vault returns to its secure locked state.

---

## 📊 Google Sheets Database Setup

### Step 1: Create Spreadsheet
1.  Go to [Google Sheets](https://sheets.google.com) and create a blank sheet.
2.  Name the spreadsheet **"Personal Link & Note Keeper"**.

### Step 2: Set up Apps Script
1.  In your spreadsheet menu, click **Extensions > Apps Script**.
2.  Delete any default code in the editor.
3.  Replicate the files in the `/backend` folder of this workspace in the Apps Script project editor:
    *   Create `Code.gs` and copy contents of `/backend/Code.gs`.
    *   Create `LinkService.gs` and copy contents of `/backend/LinkService.gs`.
    *   Create `VaultService.gs` and copy contents of `/backend/VaultService.gs`.
    *   Create `Utils.gs` and copy contents of `/backend/Utils.gs`.
    *   Create `Security.gs` and copy contents of `/backend/Security.gs`.
    *   Create `API.gs` and copy contents of `/backend/API.gs`.
4.  Click the **Save** disk icon.

### Step 3: Deploy as Web App
1.  Click the blue **Deploy** button at the top right and select **New Deployment**.
2.  Click the gear icon next to "Select type" and select **Web App**.
3.  Configure the deployment details:
    *   **Description:** `Keeper API v1`
    *   **Execute as:** `Me (your-email@gmail.com)`
    *   **Who has access:** `Anyone` (essential to allow your browser to fetch/push REST requests).
4.  Click **Deploy**.
5.  Google will request authorization:
    *   Click **Authorize access**.
    *   Choose your Google account.
    *   Click **Advanced** on the security alert screen, then click **Go to Untitled project (unsafe)**.
    *   Click **Allow**.
6.  Copy the generated **Web App URL** (it ends with `/exec`).

### Step 4: Configure the Web App
1.  Open the application interface.
2.  Navigate to the **Settings** tab.
3.  Paste your copied **Google Apps Script Web App URL** in the field.
4.  Click **Save & Test Connection**.
5.  The app will test the connection, automatically run the `init` database action (which creates the `Links`, `Vault`, and `Settings` sheets in your spreadsheet with beautiful header rows), and execute your first cloud sync!

---

## 🛠️ Troubleshooting

#### 1. CORS Preflight Blocked Errors in Dev Console
*   **Reason:** Google Apps Script Web Apps do not natively support standard `application/json` preflight OPTIONS requests under CORS rules.
*   **Resolution:** Link Keeper handles this internally. It forces all `POST` payloads to be sent as `text/plain`. Apps Script successfully intercepts this, parses the JSON body internally, and bypasses CORS. Ensure you are using the provided Apps Script files unchanged.

#### 2. "Unauthorized. Invalid or missing API token"
*   **Reason:** You activated `REQUIRE_API_TOKEN = true` inside `/backend/Utils.gs`, but haven't supplied the correct key in your client settings.
*   **Resolution:** Open Settings and supply your matching API token in the settings field, or set `REQUIRE_API_TOKEN = false` in `Utils.gs` in your Apps Script.

#### 3. Data is not syncing on Page Load
*   **Reason:** By default, Link Keeper loads from the local offline cache on startup for speed.
*   **Resolution:** Check "Automatically sync and fetch on page load" in settings, or click the manual spin reload button next to dark mode in the top navigation bar.

---

## 💻 Technical Stack

*   **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide-react (vector icons).
*   **Animation Micro-interactions:** CSS Transitions and dynamic focus outlines.
*   **Encryption Engine:** AES-256 via CryptoJS.
*   **Caching Engine:** LocalStorage (records, categories, system settings caches) + Service Worker.
*   **Backend:** Google Apps Script Web App Endpoint.
*   **Database:** Google Spreadsheet Document.
