# Iteration 0

## Goal

Prepare the project for steady product development without breaking the current working prototype.

## Done

- The legacy CDN/Babel prototype is copied to `legacy/prototype/`.
- A future React + TypeScript structure is prepared in `src/`.
- Client-owned data folders are prepared in `client-data/`.
- Windows and macOS start scripts are added.
- Windows and macOS backup scripts are added.
- TypeScript, ESLint, and Prettier checks are available through npm scripts.

## Practical meaning

- `legacy/prototype/` is the UX reference while features move into `src/`.
- `client-data/` is where company data, PDFs, prices, projects, exports, and templates will live.
- `npm run typecheck`, `npm run lint`, and `npm run format:check` are the basic self-check before each handoff.

## Next iteration

Iteration 1 should add the local storage layer: Node API or Tauri-compatible file access, project save/load, and backup flow wired into the interface.
