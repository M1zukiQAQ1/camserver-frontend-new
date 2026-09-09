#!/bin/sh
set -eu
test -n "${RENEWED_LINEAGE:-}"
install -m 644 "$RENEWED_LINEAGE/fullchain.pem" /etc/ssl/allskycam/fullchain.pem.new
install -m 600 "$RENEWED_LINEAGE/privkey.pem" /etc/ssl/allskycam/privkey.pem.new
mv /etc/ssl/allskycam/fullchain.pem.new /etc/ssl/allskycam/fullchain.pem
mv /etc/ssl/allskycam/privkey.pem.new /etc/ssl/allskycam/privkey.pem
/usr/sbin/nginx -t
/bin/systemctl reload nginx
