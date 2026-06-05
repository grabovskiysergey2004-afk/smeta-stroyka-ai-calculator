# Codex FAQ

## How to start the app

Windows:

```bat
start.bat
```

macOS:

```sh
./start.command
```

Manual fallback:

```sh
npm install
npm run dev
```

## How to self-check before handoff

```sh
npm run typecheck
npm run lint
npm run format:check
npm run smoke
```

## Where client data lives

- `client-data/projects/` stores saved projects.
- `client-data/company/` stores company profile and requisites.
- `client-data/prices/` stores price lists.
- `client-data/pdfs/` stores user PDFs and plan images.
- `client-data/templates/` stores proposal and estimate templates.
- `client-data/exports/` stores generated files.
- `client-data/backups/` stores ZIP backups.

## How to create backup

From the app:

1. Open Settings.
2. Find Local storage.
3. Click Create backup.

From terminal:

```bat
backup.bat
```

or:

```sh
./backup.command
```

## Important rule

Do not treat AI output as final construction truth. AI can suggest, extract, and pre-fill, but the user must confirm quantities, formulas, price sources, and final proposal content.
