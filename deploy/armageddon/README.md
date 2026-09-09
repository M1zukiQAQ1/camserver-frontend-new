# Armageddon HTTPS deployment

Public site: https://armageddon.deepspace.ucsb.edu/

Nginx serves ports 80/443. HTTP redirects to HTTPS, except ACME challenges.
Page requests go to Nuxt at 127.0.0.1:3000. `/api/**` and legacy camera API
paths go to Spring at 127.0.0.1:8080. `/api/backend/` is stripped before proxying
to Spring. Upload and response buffering are disabled to preserve the live
camera producer, streaming video, and large downloads.

The Spring backend no longer contains its old page controller, templates, or
static UI assets. Legacy gallery and seeing-monitor URLs redirect to Nuxt.
The retired star-tracker page returns 410.

## Deploy from GitHub

Pull `main` in `/home/dorothy/CamServer-Backend` and `master` in
`/home/dorothy/camserver-frontend-new`, using `git pull --ff-only`.
Build the frontend with the server's `/home/dorothy/opt/node/bin` on PATH and
`corepack pnpm install --frozen-lockfile && corepack pnpm build`.

The initial HTTPS cutover uses `/home/dorothy/https-release-20260909` as its
staging and rollback directory. The old backend artifact has independently
deployed camera features, so preserve those bytes while removing the legacy UI:

```sh
mkdir -p /home/dorothy/https-release-20260909
python3 /home/dorothy/CamServer-Backend/scripts/remove_legacy_ui.py \
  /home/dorothy/CamServer-Backend/target/CamServer-springboot-1.0.0.jar \
  /home/dorothy/https-release-20260909/backend.jar
```

The script verifies that all remaining JAR entries are byte-for-byte identical.
Normal future source builds should use `mvn clean package` to remove stale
compiled resources. Source changes already remove the legacy web UI.

Install Ubuntu's `nginx` and `certbot` packages with automatic service startup
suppressed until configuration is ready. Then, from this directory:

```sh
sudo bash prepare-http.sh
sudo certbot certonly --webroot -w /var/www/letsencrypt \
  -d armageddon.deepspace.ucsb.edu --non-interactive --agree-tos \
  --register-unsafely-without-email
sudo bash activate-https.sh
```

The activation checks backend connectivity, the HTTPS Nuxt homepage, and removal
of the backend root page. It rolls back on failure. `certbot.timer` handles renewal;
the deploy hook validates and reloads Nginx after a certificate is renewed.

To restore the original HTTP frontend and HTTPS backend services:

```sh
sudo bash rollback.sh
```

Firewall allowances and the certificate are retained during rollback.
