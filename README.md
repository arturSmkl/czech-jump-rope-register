# Czech Jump Rope Register

A registration system for the Czech Jump Rope Association — manages member clubs (`collective_members`) and their registered athletes (`registered_members`).

The project is split into two parts:

- **`frontend/`** — Vue 3 + Vite SPA
- **`backend/functions/`** — Firebase Cloud Functions (Node 22, Express)

Persistence and auth are provided by Firebase (Firestore + Auth). The Cloud Functions handle privileged operations: CSV import/export, NSA export, member transfer/termination, PDF reports, and address validation against the RÚIAN API.

---

## Running the project on the Firebase Emulators

These steps walk you through running the entire stack locally — no production Firebase resources are touched.

### 1. Prerequisites

Install once:

- **Node.js** ≥ 20.19 or ≥ 22.12 ([nodejs.org](https://nodejs.org/))
- **Java JDK** ≥ 11 (required by the Firestore emulator) — `java -version` to verify
- **Firebase CLI**:
  ```bash
  npm install -g firebase-tools
  ```
- Authenticate the CLI once:
  ```bash
  firebase login
  ```

### 2. Install dependencies

From the repository root, install dependencies for both the frontend and the Cloud Functions:

```bash
cd frontend && npm install && cd ..
cd backend/functions && npm install && cd ../..
```

### 3. Configure the frontend environment

The frontend reads its Firebase project config from `frontend/.env.local`. Create it from the template:

```bash
cp frontend/.env.example frontend/.env.local
```

Then fill in the values for the `czech-jump-rope-register-e8dea` Firebase project (Console → Project settings → General → Your apps → Web app config). Keep the emulator API URL as-is for local development:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=czech-jump-rope-register-e8dea.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=czech-jump-rope-register-e8dea
VITE_FIREBASE_APP_ID=...
VITE_API_URL=http://127.0.0.1:5001/czech-jump-rope-register-e8dea/europe-west3/api
```

When `import.meta.env.DEV` is true (i.e. `npm run dev`), `frontend/src/firebase.js` automatically routes Auth and Firestore traffic to the local emulators — no extra config needed.

### 4. Start the Firebase Emulators

In a terminal at the repository root:

```bash
firebase emulators:start
```

This boots Functions, Firestore, Auth, and Hosting in one process. Default ports (from `firebase.json`):

| Service   | URL                          |
|-----------|------------------------------|
| Emulator UI | http://127.0.0.1:4000      |
| Hosting   | http://127.0.0.1:5000        |
| Functions | http://127.0.0.1:5001        |
| Firestore | 127.0.0.1:8080               |
| Auth      | 127.0.0.1:9099               |

Leave this terminal running.

> The Functions emulator needs the `RUIAN_API_KEY` secret only if you plan to test address validation. Set it with `firebase functions:secrets:set RUIAN_API_KEY` (or skip it — every other endpoint works without it).

### 5. Start the frontend dev server

In a **second** terminal:

```bash
cd frontend
npm run dev
```

Vite serves the SPA at **http://127.0.0.1:5173**. Open that URL in your browser.

### 6. Seed an authorized user

The backend's `validateRole` middleware rejects anyone who isn't listed in the `authorized_users` Firestore collection. After signing in with Google for the first time:

1. Open the Emulator UI at http://127.0.0.1:4000
2. Go to **Firestore** → **Start collection** → `authorized_users`
3. Add a document where the **Document ID is your lowercase email** and set:
   - `role` = `admin` (or `editor` / `viewer`)

You should now be able to use every endpoint. Refresh the SPA if you were already logged in.

### 7. Stopping everything

`Ctrl+C` in each terminal. Emulator data is in-memory by default and is wiped on shutdown — pass `--export-on-exit ./emulator-data --import=./emulator-data` to `firebase emulators:start` if you want to persist Firestore/Auth state between sessions.

---

## Project layout

```
.
├── backend/functions/      Cloud Functions (Express on onRequest)
│   ├── index.js            Route table + CORS + admin init
│   └── src/
│       ├── middleware/     auth.js (validateRole), utils.js
│       └── routes/         collectives, registered, reports, address
├── frontend/               Vue 3 + Vite SPA
│   └── src/
│       ├── views/          Page-level components
│       ├── components/     Shared UI (NavigationBar, GlobalAlert, …)
│       ├── services/       Firestore + REST API clients
│       ├── stores/         Pinia stores (auth, error)
│       └── firebase.js     SDK init + emulator wiring
├── firestore.rules         Security rules (deployed via firebase deploy)
├── firestore.indexes.json  Firestore composite indexes
└── firebase.json           Emulator ports, hosting rewrites, deploy config
```
