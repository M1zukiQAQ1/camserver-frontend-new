#!/usr/bin/env bash
set -Eeuo pipefail
config=$(cd "$(dirname "$0")" && pwd)
site=/etc/nginx/sites-available/allsky.conf
test "$(id -u)" = 0
nginx -t
openssl x509 -in /etc/ssl/allskycam/fullchain.pem -noout -checkend 86400
# Verify the installed certificate before changing routing.
curl -sS --max-time 10 --resolve armageddon.deepspace.ucsb.edu:443:127.0.0.1 \
    https://armageddon.deepspace.ucsb.edu/ -o /dev/null
stage=$(mktemp -d /home/dorothy/https-routing-20260910-XXXXXX)
chmod 755 "$stage"
cp -a "$site" "$stage/nginx-before.conf"
rollback() {
    trap - ERR
    cp -a "$stage/nginx-before.conf" "$site"
    nginx -t && systemctl reload nginx
    echo "Activation failed; restored the previous routing from $stage" >&2
}
trap rollback ERR
install -m 644 "$config/nginx-https.conf" "$site"
nginx -t
systemctl reload nginx
ready=false
for attempt in {1..20}; do
    code=$(curl -sS --max-time 5 --resolve armageddon.deepspace.ucsb.edu:443:127.0.0.1 \
        -o "$stage/homepage.html" -w '%{http_code}' https://armageddon.deepspace.ucsb.edu/) || code=000
    if [ "$code" = 200 ] && grep -q '/_nuxt/' "$stage/homepage.html"; then
        ready=true
        break
    fi
    sleep 1
done
test "$ready" = true
for path in / /gallery /seeing-monitor /health /api/sites /api/live/status; do
    code=$(curl -sS --max-time 15 --resolve armageddon.deepspace.ucsb.edu:443:127.0.0.1 \
        -o /dev/null -w '%{http_code}' "https://armageddon.deepspace.ucsb.edu$path")
    test "$code" = 200
done
for path in '/gallery?pagesize=1' '/api/sites?https=1' /upload_live /api/live/ingest; do
    curl -sS --max-time 5 -H 'Host: armageddon.deepspace.ucsb.edu' \
        -D "$stage/redirect.headers" -o /dev/null "http://127.0.0.1$path"
    grep -qE '^HTTP/[^ ]+ 308' "$stage/redirect.headers"
    tr -d '\r' < "$stage/redirect.headers" | grep -Fxi "Location: https://armageddon.deepspace.ucsb.edu$path"
done
curl -fsS --max-time 10 --resolve armageddon.deepspace.ucsb.edu:443:127.0.0.1 \
    -X OPTIONS -H 'Origin: https://armageddon.deepspace.ucsb.edu' \
    -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type' \
    -D "$stage/cors.headers" -o /dev/null https://armageddon.deepspace.ucsb.edu/api/upload_image
grep -qi '^Access-Control-Allow-Origin: https://armageddon.deepspace.ucsb.edu' "$stage/cors.headers"
test "$(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' \
    http://127.0.0.1/.well-known/acme-challenge/codex-routing-check)" = 404
systemctl is-active --quiet certbot.timer
touch "$stage/activation-complete"
trap - ERR
echo "HTTPS serves the website and APIs. HTTP redirects to HTTPS with status 308."
echo "Rollback configuration: $stage/nginx-before.conf"
