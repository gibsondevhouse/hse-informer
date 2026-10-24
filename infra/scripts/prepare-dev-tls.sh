#!/bin/sh
# Synthetic local CA only. Production must use its operator-managed TLS chain.
set -eu
root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
tls="$root/.dev-tls"
mkdir -p "$tls"
chmod 0755 "$tls"
if ! test -r "$tls/ca.crt" || ! test -r "$tls/server.key.pem" || ! openssl x509 -checkend 86400 -noout -in "$tls/server.crt" >/dev/null 2>&1; then
    umask 077
    openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 7 \
        -subj '/CN=HSE disposable development CA' \
        -keyout "$tls/ca.key.pem" -out "$tls/ca.crt" 2>/dev/null
    openssl req -new -newkey rsa:2048 -sha256 -nodes \
        -subj '/CN=auth.localhost' \
        -keyout "$tls/server.key.pem" -out "$tls/server.csr" 2>/dev/null
    cat > "$tls/server.ext" <<'EOF'
subjectAltName=DNS:auth.localhost
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
EOF
    openssl x509 -req -sha256 -days 5 -in "$tls/server.csr" \
        -CA "$tls/ca.crt" -CAkey "$tls/ca.key.pem" -CAcreateserial \
        -extfile "$tls/server.ext" -out "$tls/server.crt" 2>/dev/null
    # Keycloak's non-root container user must read its disposable server key.
    chmod 0644 "$tls/server.key.pem" "$tls/server.crt" "$tls/ca.crt"
fi
openssl verify -CAfile "$tls/ca.crt" -verify_hostname auth.localhost "$tls/server.crt" >/dev/null
printf '%s\n' 'OK disposable development TLS chain for auth.localhost'
