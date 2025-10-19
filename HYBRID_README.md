NHIA Vetting Hybrid Package
---------------------------
This package contains:
- backend/ (Express scaffold)
- frontend/ (React scaffold)
- electron/ (Electron stub)
- sync_server/ (minimal stub to accept pushes/pulls)
- packaging/ (electron-builder hints)

How the hybrid works (concept):
- Desktop (Electron) runs local backend + frontend, stores data in local SQLite.
- When online, desktop calls sync server endpoints to push claims and pull updated reference tables.
- Central server processes pushes and distributes updates to other clients.

Quick run (developer):
- Start sync server: cd sync_server && npm install express && node index.js
- Start backend: cd backend && npm install && node src/index.js
- Start frontend dev: cd frontend && npm install && npm run dev
- Start electron: cd electron && npm install && npm start
