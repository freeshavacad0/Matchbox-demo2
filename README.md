# Match React Demo

This is a static React + Vite demo for the Matchbox prototype.

## Run locally
1. Install dependencies
```
npm install
```
2. Run dev server
```
npm run dev
```
3. Open the dev server URL (usually http://localhost:5173)

## Notes
- This is a client-only demo using `localStorage` for persistence.
- Simulated OAuth sign-in is available via the "Simulate sign-in" buttons — use them to switch to the saved person's account to generate replies.
- Audio recording uses the browser MediaRecorder API and stores small data URLs in localStorage when you stop the recording (demo only).

## Next steps
- Convert to full-stack with real OAuth, backend messaging, and persistent storage.
