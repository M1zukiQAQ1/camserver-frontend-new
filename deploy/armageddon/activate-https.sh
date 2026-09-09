#!/usr/bin/env bash
set -euo pipefail
config=$(cd "$(dirname "$0")" && pwd)
stage=/home/dorothy/https-release-20260909
jar=/home/dorothy/CamServer-Backend/target/CamServer-springboot-1.0.0.jar
test "$(id -u)" = 0
test -f "$stage/rollback/prepared"
test -f "$stage/backend.jar"
test -f /etc/ssl/allskycam/fullchain.pem
test -f /etc/ssl/allskycam/privkey.pem
cmp "$jar" "$stage/rollback/backend.jar"
trap 'bash "$config/rollback.sh"' ERR
install -m 644 "$stage/backend.jar" "${jar}.https-new"
mv "${jar}.https-new" "$jar"
install -m 644 "$config/backend.conf" /etc/systemd/system/camserver.service.d/https.conf
systemctl daemon-reload
systemctl stop camserver.service
install -m 644 "$config/nginx.conf" /etc/nginx/sites-available/allsky.conf
nginx -t
systemctl reload nginx
systemctl start camserver.service
ready=0
for attempt in $(seq 1 30); do
    if curl -fsS --max-time 2 http://127.0.0.1:8080/api/sites -o /dev/null; then
        ready=1
        break
    fi
    sleep 1
done
test "$ready" = 1
# HTTP is canonical; the TLS listener exists only to redirect HTTPS clients.
curl -fsS --max-time 20 http://127.0.0.1/ -o "$stage/homepage.html"
grep -q '/_nuxt/' "$stage/homepage.html"
test "$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/)" = 404
install -D -m 755 "$config/renew-hook.sh" /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
systemctl enable --now certbot.timer
touch "$stage/activation-complete"
trap - ERR
echo 'HTTP frontend and camera APIs verified; HTTPS redirects to HTTP.'
