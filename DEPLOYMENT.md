# Deployment

## Shared storage (server)
To share data across browsers, you need a server that can write to `data/state.json`.

1. Copy the whole project to your server.
2. Run:

```
node server.js
```

3. Open `http://your-server:3000`.

You can set `PORT` and `DATA_PATH` environment variables if needed.

## Static only (no shared storage)

This is a static site. You can host it on any web server.

## Option A: Nginx on a server
1. Copy files to your server:
   - `index.html`
   - `styles.css`
   - `app.js`
2. Place them in a web root, e.g. `/var/www/evocoffee`.
3. Nginx example:

```
server {
  listen 80;
  server_name evocoffee.yourdomain.com;

  root /var/www/evocoffee;
  index index.html;

  location / {
    try_files $uri $uri/ =404;
  }
}
```

## Option B: GitHub Pages
1. Push to GitHub.
2. In repository settings, enable GitHub Pages for the `main` branch.

## Option C: Any static host
Upload the three files to your host's public directory.
