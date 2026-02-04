# Deployment (Static)

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
