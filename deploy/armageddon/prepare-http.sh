#!/usr/bin/env bash
set -euo pipefail
config=$(cd "$(dirname "$0")" && pwd)
stage=/home/dorothy/https-release-20260909
frontend_dropin=/etc/systemd/system/camserver-frontend.service.d/armageddon-release.conf
test "$(id -u)" = 0
test ! -e "$stage/rollback/prepared"
test -f /home/dorothy/camserver-frontend-new/.output/server/index.mjs
install -d -m 700 "$stage/rollback"
cp -a "$frontend_dropin" "$stage/rollback/frontend.conf"
cp -a /home/dorothy/CamServer-Backend/target/CamServer-springboot-1.0.0.jar "$stage/rollback/backend.jar"
sha256sum "$stage/rollback/backend.jar" > "$stage/rollback/backend.sha256"
if test -e /etc/systemd/system/camserver.service.d/https.conf; then
    cp -a /etc/systemd/system/camserver.service.d/https.conf "$stage/rollback/backend.conf"
fi
if test -e /etc/nginx/sites-enabled/default; then
    mv /etc/nginx/sites-enabled/default "$stage/rollback/nginx-default"
fi
install -d /var/www/letsencrypt/.well-known/acme-challenge
install -m 644 "$config/proxy.conf" /etc/nginx/snippets/allsky-proxy.conf
install -m 644 "$config/nginx-bootstrap.conf" /etc/nginx/sites-available/allsky.conf
ln -sfn /etc/nginx/sites-available/allsky.conf /etc/nginx/sites-enabled/allsky.conf
nginx -t
touch "$stage/rollback/prepared"
trap 'bash "$config/rollback.sh"' ERR
install -m 644 "$config/frontend.conf" "$frontend_dropin"
systemctl daemon-reload
systemctl restart camserver-frontend.service
systemctl enable --now nginx
curl --retry 8 --retry-connrefused --retry-delay 1 -fsS --max-time 10 http://127.0.0.1/health -o /dev/null
trap - ERR
echo 'HTTP now serves the new frontend through Nginx; ready for certificate issuance.'
