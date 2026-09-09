#!/usr/bin/env bash
set -euo pipefail
config=$(cd "$(dirname "$0")" && pwd)
stage=/home/dorothy/http-release-20260909
site=/etc/nginx/sites-available/allsky.conf
backend=/etc/systemd/system/camserver.service.d/https.conf
test "$(id -u)" = 0
test ! -e "$stage/nginx-before.conf"
install -d -m 700 "$stage"
cp -a "$site" "$stage/nginx-before.conf"
cp -a "$backend" "$stage/backend-before.conf"
rollback() {
    cp -a "$stage/nginx-before.conf" "$site"
    cp -a "$stage/backend-before.conf" "$backend"
    systemctl daemon-reload
    nginx -t && systemctl reload nginx
}
trap rollback ERR
install -m 644 "$config/nginx.conf" "$site"
nginx -t
systemctl reload nginx
curl -fsS --max-time 20 http://127.0.0.1/ -o "$stage/homepage.html"
grep -q '/_nuxt/' "$stage/homepage.html"
curl -ksS --resolve armageddon.deepspace.ucsb.edu:443:127.0.0.1 \
    --max-time 10 -D "$stage/redirect.headers" -o /dev/null \
    'https://armageddon.deepspace.ucsb.edu/gallery?pagesize=1'
grep -qi '^location: http://armageddon.deepspace.ucsb.edu/gallery?pagesize=1' "$stage/redirect.headers"
grep -qE '^HTTP/[^ ]+ 307' "$stage/redirect.headers"
# Keep future backend starts consistent; page routing is entirely handled by Nginx.
install -m 644 "$config/backend.conf" "$backend"
systemctl daemon-reload
touch "$stage/activation-complete"
trap - ERR
echo 'HTTP serves the new frontend and APIs; all HTTPS requests redirect to HTTP.'
