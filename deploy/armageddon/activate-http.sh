#!/usr/bin/env bash
set -euo pipefail
config=$(cd "$(dirname "$0")" && pwd)
site=/etc/nginx/sites-available/allsky.conf
backend=/etc/systemd/system/camserver.service.d/https.conf
test "$(id -u)" = 0
stage=$(mktemp -d "/home/dorothy/http-release-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
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
# Reload is asynchronous: old workers can briefly answer after systemctl returns.
ready=false
for attempt in {1..15}; do
    if curl -fsS --max-time 5 http://127.0.0.1/ -o "$stage/homepage.html" &&
        grep -q '/_nuxt/' "$stage/homepage.html" &&
        curl -ksS --resolve armageddon.deepspace.ucsb.edu:443:127.0.0.1 \
            --max-time 5 -D "$stage/redirect.headers" -o /dev/null \
            'https://armageddon.deepspace.ucsb.edu/gallery?pagesize=1' &&
        grep -qi '^location: http://armageddon.deepspace.ucsb.edu/gallery?pagesize=1' "$stage/redirect.headers" &&
        grep -qE '^HTTP/[^ ]+ 307' "$stage/redirect.headers"; then
        ready=true
        break
    fi
    sleep 1
done
test "$ready" = true
# Keep future backend starts consistent; page routing is entirely handled by Nginx.
install -m 644 "$config/backend.conf" "$backend"
systemctl daemon-reload
touch "$stage/activation-complete"
trap - ERR
echo 'HTTP serves the new frontend and APIs; all HTTPS requests redirect to HTTP.'
echo "Previous configuration saved in $stage"
