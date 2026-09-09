# Armageddon web deployment

Public site: http://armageddon.deepspace.ucsb.edu/

Nginx serves ports 80/443. HTTP serves the site and API routes. Every HTTPS
request redirects to the same HTTP path/query with a non-cacheable 307, preserving
the method and body for clients that follow redirects.
Page requests go to Nuxt at 127.0.0.1:3000. `/api/**` and legacy camera API
paths go to Spring at 127.0.0.1:8080. `/api/backend/` is stripped before proxying
to Spring. Upload and response buffering are disabled to preserve the live
camera producer, streaming video, and large downloads.

The Spring backend no longer contains its old page controller, templates, or
static UI assets. Legacy gallery and seeing-monitor URLs redirect to Nuxt.
The retired star-tracker page returns 410.

The live camera sender uses `http.client` and does not follow redirects. Its
`CAMSERVER_BACKEND` setting in `/home/pi/seeing-monitor/producer.env` on seeingcam
must be `http://armageddon.deepspace.ucsb.edu`, followed by a producer restart.
The all-sky uploader uses `requests`, which follows the 307 redirect.

For an existing deployment, pull this repository and run:

```sh
sudo bash deploy/armageddon/activate-http.sh
```

Then switch/restart the live sender and verify fresh video fragments over HTTP.
The previous Nginx configuration is saved in a unique `/home/dorothy/http-release-*`
directory, printed after activation. Readiness checks wait for Nginx's new workers.
No application rebuild is needed for this routing-only change.

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
sudo python3 install-certificate.py
sudo bash activate-https.sh
```

The initial activation checks backend connectivity, the HTTP Nuxt homepage, and removal
of the backend root page. It rolls back on failure. `certbot.timer` handles renewal;
the deploy hook installs the renewed certificate, validates, and reloads Nginx.

If ACME validation cannot reach the server through campus ingress, run
`install-certificate.py` after the failed issuance attempt. It securely reuses
the backend's existing self-signed certificate from the deployed JAR, permitting
the HTTPS routing change without claiming public certificate trust. Obtain a
trusted replacement once public ingress or a DNS challenge is available.
Certificate/key files live in `/etc/ssl/allskycam`; the directory and key are
root-only. HTTPS still completes a TLS handshake before it can redirect, so the
existing certificate warning may appear when explicitly opening an HTTPS URL.
Use the HTTP URL directly to avoid that handshake.

To restore the original HTTP frontend and HTTPS backend services:

```sh
sudo bash rollback.sh
```

Firewall allowances and the certificate are retained during rollback.
