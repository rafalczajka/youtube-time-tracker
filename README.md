# Browser Time Tracker

Chrome extension that tracks active browsing time per domain and shows the current top websites in the popup.

## Stack

- Manifest V3
- TypeScript
- esbuild
- `chrome.storage.local` for persisted stats

## Development

Install dependencies:

```bash
npm install
```

Build the extension:

```bash
npm run build
```

Watch for changes during development:

```bash
npm run watch
```

Run unit tests:

```bash
npm test
```

## Load In Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the `dist/` directory.

The popup shows the top 10 domains sorted by today's active-tab time, with lifetime totals displayed alongside.
