# Iteration 1

## Goal

Add the first local storage layer so user data can live in the project folder, not only in browser `localStorage`.

## Done

- Added Vite local API routes:
  - `GET /api/health`
  - `GET /api/projects`
  - `GET /api/projects/current`
  - `PUT /api/projects/current`
  - `GET /api/company/profile`
  - `PUT /api/company/profile`
  - `POST /api/backups`
- Added browser client `window.localApi` in `local-api.js`.
- Connected Planning autosave to `client-data/projects/current-project.json`.
- Connected Settings company profile to `client-data/company/profile.json`.
- Added in-app backup button on the Settings screen.
- Kept `localStorage` as a fallback for the legacy prototype.

## Practical meaning

- The current project can be transferred together with the project folder.
- Company requisites are no longer just demo form values.
- Backups can be created from the interface or from `backup.bat` / `backup.command`.

## Data files

- Current project: `client-data/projects/current-project.json`
- Company profile: `client-data/company/profile.json`
- Backups: `client-data/backups/client-data-*.zip`

## Risk and limitation

This is still a local Vite/Node API, not the final desktop storage layer. It is intentionally shaped so the same contract can later move behind Tauri commands or a dedicated local server.

## Next iteration

Iteration 2 should formalize the domain model and calculation core: project entities, estimate lines, formulas, source tracking, and verification statuses.
