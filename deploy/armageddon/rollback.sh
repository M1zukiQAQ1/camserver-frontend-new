#!/usr/bin/env bash
set -euo pipefail
stage=/home/dorothy/https-release-20260909
jar=/home/dorothy/CamServer-Backend/target/CamServer-springboot-1.0.0.jar
test "$(id -u)" = 0
test -f "$stage/rollback/prepared"
systemctl stop nginx camserver.service camserver-frontend.service
cp -a "$stage/rollback/backend.jar" "$jar"
cp -a "$stage/rollback/frontend.conf" /etc/systemd/system/camserver-frontend.service.d/armageddon-release.conf
if test -f "$stage/rollback/backend.conf"; then
    cp -a "$stage/rollback/backend.conf" /etc/systemd/system/camserver.service.d/https.conf
elif test -f /etc/systemd/system/camserver.service.d/https.conf; then
    mv /etc/systemd/system/camserver.service.d/https.conf "$stage/rollback/failed-backend.conf"
fi
systemctl disable nginx
systemctl daemon-reload
systemctl start camserver.service camserver-frontend.service
echo 'Restored the services and backend artifact from before the HTTPS cutover.'
