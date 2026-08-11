# DeCLA

DeCLA is a browser-only process canvas for designing decision workflows, saving
versions, reviewing a decision log, and comparing process versions.

## Architecture

- Next.js 16 and React 19
- Browser `localStorage` for canvas drafts, saved versions, and theme preference
- No API server, database, or required environment variables

Data belongs to the current browser profile. Clearing site data removes it, and it
is not synchronized across browsers or devices.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Production build

```bash
npm run build
npm start
```

The included `Dockerfile` builds the same frontend-only application. The project
can also be imported directly into Vercel without environment variables.

## Checks

```bash
npm run lint
npm test
npm run build
```
