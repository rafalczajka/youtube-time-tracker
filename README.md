# YouTube Time Tracker

Chrome extension for tracking time spent on YouTube and visualizing daily usage in a compact popup.

## What It Does

- Tracks time for `youtube.com` and its subdomains
- Counts time when a YouTube tab is selected in any normal browser window
- Pauses tracking when Chrome reports the user as `idle` or `locked`
- Stores usage history per local date in `YYYY-MM-DD` format
- Shows:
  - current status in the popup (`Counting` / `Paused`)
  - today's tracked time
  - a 14-day bar chart with zero-filled gaps for days without usage
- Updates the extension icon with a colored status dot:
  - green = counting
  - yellow = paused

## How Tracking Works

The background service worker listens for tab, window, idle, and alarm events.

Tracking is active when:

- the user is not idle or locked
- at least one selected tab is on YouTube

If multiple browser windows are open, the extension prefers the currently tracked YouTube tab and otherwise falls back to another selected YouTube tab.

Tracked time is split across day boundaries, so sessions crossing midnight are saved into the correct dates.

## Tech Stack

- Chrome Extension Manifest V3
- TypeScript
- esbuild
- `chrome.storage.local` for persisted daily stats
- `chrome.storage.session` for runtime session state

## Development

Install dependencies:

```bash
npm install
```

Start a production build:

```bash
npm run build
```

Watch source and static files during development:

```bash
npm run watch
```

Run tests:

```bash
npm test
```

Run type checking:

```bash
npm run typecheck
```

## Load In Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the `dist/` directory.

## Project Notes

- Built for Chrome/Chromium with Manifest V3.
- Popup UI is intentionally minimal and focused on today's value plus recent daily history.
- Stored stats are versioned; incompatible older schemas are reset rather than migrated.
