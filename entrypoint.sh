#!/bin/sh
set -e

if [ -f /run/secrets/gh_token ]; then
    export GH_TOKEN=$(cat /run/secrets/gh_token)
fi

if [ -z "${GH_TOKEN:-}" ]; then
    echo "ERROR: GitHub token is missing or empty. Create secrets/gh_token with a valid token and restart the container." >&2
    exit 1
fi

# Build config.js from HIDDEN_NAMESPACES (comma-separated, e.g. "org1,org2")
if [ -n "${HIDDEN_NAMESPACES:-}" ]; then
    JSON_ARRAY=$(printf '["%s"]' "$(printf '%s' "$HIDDEN_NAMESPACES" | sed 's/[[:space:]]//g; s/,/","/g')")
else
    JSON_ARRAY="[]"
fi

REFRESH_INTERVAL="${REFRESH_INTERVAL:-300}"

printf 'window.PR_TRACKER_CONFIG = %s;\n' \
    "{\"hiddenNamespaces\":${JSON_ARRAY},\"refreshInterval\":${REFRESH_INTERVAL}}" \
    > /usr/share/nginx/html/config.js

exec /docker-entrypoint.sh "$@"
