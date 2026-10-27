# Revisit: DSA Revision Tracker (MERN)

Visitors can browse the site with sample data. Signing up or logging in is required only to add or change problems.

## Run locally
1. Create a free MongoDB Atlas cluster and copy its connection string.
2. `cp server/.env.example server/.env` and fill in `MONGO_URI` and `JWT_SECRET`.
3. In two terminals:
   - `cd server && npm install && npm run dev`
   - `cd client && npm install && npm run dev`
4. Open http://localhost:5173 (Vite proxies `/api` to the server on port 5000).

## Deploy on Render (one Web Service)
1. Push this folder to a GitHub repo.
2. In MongoDB Atlas: Network Access, add `0.0.0.0/0` so Render can connect.
3. On Render choose New, then Web Service, and connect the repo.
4. Settings:
   - Build Command: `npm run build`
   - Start Command: `npm start`
5. Environment variables: `MONGO_URI` and `JWT_SECRET` (a long random string).
6. Deploy. The Express server also serves the built React app, so there is a single URL.

## How the revision date works
Gaps are 1, 3, 7, 21, 45 and 90 days (`INTERVALS` in `server/index.js` and `client/src/App.jsx`; change both together).
A new problem is due after 1 day. Easy moves to the next gap, Medium repeats the gap, Hard resets to 1 day.
The server calculates and saves the next date every time you rate a problem.
