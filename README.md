# CHRONO — The Internet's Memory Vault
React + Vite frontend, Node/Express backend (JSON-file storage).

## Run
    cd server && npm install && npm start      # http://localhost:4000
    cd client && npm install && npm run dev    # http://localhost:5173

The frontend works without the backend (it falls back to demo data), but capsules only persist
and unlock server-side when the API is running.

## Notes
- Capsule text is withheld by the server until its unlock date (server-side unlocking).
- Private capsules are only returned to the browser id that created them. Public ones need explicit consent.
- Before launch: add auth, reporting/moderation, rate limiting, and swap data.json for MongoDB;
  add Cloudinary for photos/audio and an email service for unlock notifications.
