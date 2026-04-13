# YouTube Time Tracker

Chrome extension that tracks active browsing time spent on YouTube and shows a compact today/total summary in the popup.

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

The popup shows only YouTube time, counted when a YouTube tab is active in the focused browser window and Chrome reports you as active.
