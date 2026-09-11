# Fretboard Program

A 3-month guitar & bass practice tracker. React + Vite, single-page, no backend — progress is saved to `localStorage` in your browser.

## Run locally

```bash
npm install
npm run dev
```

## Build for production

```bash
npm run build
```

Outputs static files to `dist/`.

## Deploy

This is a static Vite app, so it deploys the same way as your other projects:

1. Push this folder to a new GitHub repo (e.g. `fretboard-program`)
2. Import the repo on [Vercel](https://vercel.com/new) — it auto-detects Vite, no config needed
3. Every push to `main` redeploys automatically

## Notes

- All progress (task checkboxes, daily sessions, repertoire status) lives in the browser's `localStorage` under the key `fretboard-program-v1`. Clearing site data will reset progress.
- No environment variables or external services required.
