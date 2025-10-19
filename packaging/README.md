Packaging Notes
---------------
To build an installer with electron-builder:
1. Build frontend: cd frontend && npm run build
2. Copy backend folder into the packaged app resources and ensure it's set to run as a child process.
3. Run electron-builder from project root.
