# Repository Guidelines

## Project Structure & Module Organization

This repository is a Chrome Manifest V3 extension for tracking YouTube usage time.

- `src/background.ts`: service worker, tracking lifecycle, alarms, badge updates, and commands.
- `src/popup.ts`: popup rendering and UI event handling.
- `src/shared/`: testable shared logic for storage, stats, sessions, YouTube URL matching, time helpers, command parsing, and types.
- `static/`: copied extension assets, including `manifest.json`, `popup.html`, `popup.css`, and icons.
- `tests/`: unit tests named `*.test.ts`.
- `scripts/build.mjs`: esbuild bundle and static asset copy script.

Do not edit generated files in `dist/` directly. Change `src/` or `static/`, then rebuild.

## Build, Test, and Development Commands

- `npm install` installs dependencies and configures Git hooks.
- `npm run build` creates the loadable extension in `dist/`.
- `npm run watch` rebuilds during development.
- `npm test` runs all unit tests with `tsx --test tests/**/*.test.ts`.
- `npm run typecheck` runs TypeScript checks without emitting files.

Load the extension from `dist/` in `chrome://extensions` after building.

## Coding Style & Naming Conventions

Use TypeScript with ES modules. Keep browser API interactions in `background.ts` and `popup.ts`; keep pure logic in `src/shared/`.

Use two-space indentation, double quotes, semicolons, and descriptive camelCase names. Interfaces and type aliases use PascalCase, for example `RuntimeState` or `StoredStats`.

Prefer small functions with clear inputs. Avoid adding UI frameworks; the popup is plain HTML, CSS, and TypeScript.

## Testing Guidelines

Tests use Node's built-in test runner via `tsx`. Add tests in `tests/`, using names like `session.test.ts` or `commands.test.ts`.

Cover shared logic when changing tracking, stats, storage normalization, URL matching, command parsing, or time splitting. For UI-only CSS changes, a build and manual popup check are usually enough.

Run `npm test` and `npm run typecheck` before submitting. Run `npm run build` when manifest, static assets, or bundled source changes.

## Commit & Pull Request Guidelines

Commit messages in this project use short imperative summaries, for example `Add keyboard shortcut to toggle tracking pause` or `Update popup header layout`.

Pull requests should include a brief behavior summary, notes about storage schema or manifest changes, test results, and screenshots for popup layout or styling changes.

## Extension-Specific Notes

Keep permissions in `static/manifest.json` minimal and explain new permissions in PRs. Manual pause state lives in `chrome.storage.session`; daily usage history lives in `chrome.storage.local`. Preserve local-date behavior and split sessions correctly across midnight.
