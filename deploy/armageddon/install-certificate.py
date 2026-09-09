#!/usr/bin/env python3
"""Install an issued certificate, or reuse the backend certificate for initial routing.

The fallback preserves the existing self-signed certificate; it does not establish
public trust. Private-key material is only written to root-only paths.
"""
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import zipfile


def main():
    if os.geteuid() != 0:
        raise SystemExit("Run as root")
    os.umask(0o077)
    target = Path("/etc/ssl/allskycam")
    target.mkdir(mode=0o700, parents=True, exist_ok=True)
    target.chmod(0o700)
    if (target / "fullchain.pem").exists() or (target / "privkey.pem").exists():
        raise SystemExit("Certificate files already exist; refusing to replace them")
    lineage = Path("/etc/letsencrypt/live/armageddon.deepspace.ucsb.edu")
    if (lineage / "fullchain.pem").exists():
        shutil.copyfile(lineage / "fullchain.pem", target / "fullchain.pem")
        shutil.copyfile(lineage / "privkey.pem", target / "privkey.pem")
        print("Installed the issued certificate")
    else:
        jar = Path("/home/dorothy/CamServer-Backend/target/CamServer-springboot-1.0.0.jar")
        with zipfile.ZipFile(jar) as archive:
            config = archive.read("BOOT-INF/classes/application.yml").decode()
            match = re.search(r"^\s*key-store-password:\s*([^\r\n]+)", config, re.MULTILINE)
            if not match:
                raise SystemExit("No backend keystore password setting found")
            password = match.group(1).strip().strip("\"'")
            with tempfile.TemporaryDirectory() as temp:
                store = Path(temp) / "keystore.p12"
                store.write_bytes(archive.read("BOOT-INF/classes/keystore.p12"))
                for flags, output in [(["-clcerts", "-nokeys"], "fullchain.pem"), (["-nocerts", "-nodes"], "privkey.pem")]:
                    subprocess.run(["openssl", "pkcs12", "-in", str(store), "-passin", "stdin", *flags, "-out", str(target / output)], input=password + "\n", text=True, check=True, capture_output=True)
        print("Reused the existing backend certificate; public trust is unchanged")
    (target / "fullchain.pem").chmod(0o644)
    (target / "privkey.pem").chmod(0o600)
    subprocess.run(["openssl", "x509", "-in", str(target / "fullchain.pem"), "-noout", "-subject", "-issuer", "-dates"], check=True)


if __name__ == "__main__":
    main()
