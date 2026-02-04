# EvoCoffee

Terminal-inspired inventory tracker for EvoLab coffee supplies.

## Run locally
Open `index.html` in a browser.

## Notes
If you open `index.html` directly, data is stored in the browser (localStorage). Export/Import is available in the UI.

## Run with shared storage (server)
Run the Node server so data is saved to `data/state.json` and shared across browsers.

```bash
node server.js
```

Then open `http://localhost:3000`.
