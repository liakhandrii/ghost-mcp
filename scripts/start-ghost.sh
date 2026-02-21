#!/usr/bin/env bash
set -euo pipefail

GHOST_PORT="${GHOST_PORT:-2368}"
GHOST_URL="http://localhost:${GHOST_PORT}"
GHOST_IMAGE="ghost:6"
CONTAINER_NAME="ghost-test"
ADMIN_EMAIL="test@example.com"
ADMIN_PASSWORD="T3st!ng_Gh0st_S3tup"
BLOG_TITLE="Test Blog"
OUTPUT_FILE="$(dirname "$0")/../.ghost-api-key"

# Clean up any existing container
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

echo "Starting Ghost 6..."
docker run -d --name "$CONTAINER_NAME" \
  -e NODE_ENV=development \
  -e url="$GHOST_URL" \
  -p "${GHOST_PORT}:2368" \
  "$GHOST_IMAGE"

# Wait for Ghost to be ready
echo "Waiting for Ghost to be ready..."
until curl -sf "${GHOST_URL}/ghost/api/admin/site/" >/dev/null 2>&1; do
  sleep 1
done
echo "Ghost is up at ${GHOST_URL}"

# Disable staff device verification
echo "Disabling staff device verification..."
docker exec "$CONTAINER_NAME" sh -c 'cat > /var/lib/ghost/config.production.json << EOF
{
  "url": "http://localhost:2368",
  "server": {
    "port": 2368,
    "host": "::"
  },
  "mail": {
    "transport": "Direct"
  },
  "logging": {
    "transports": [
      "file",
      "stdout"
    ]
  },
  "process": "systemd",
  "security": {
    "staffDeviceVerification": false
  },
  "paths": {
    "contentPath": "/var/lib/ghost/content"
  }
}
EOF'

# Restart Ghost to apply config changes
echo "Restarting Ghost to apply configuration..."
docker restart "$CONTAINER_NAME"

# Wait for Ghost to be ready again
echo "Waiting for Ghost to be ready after restart..."
until curl -sf "${GHOST_URL}/ghost/api/admin/site/" >/dev/null 2>&1; do
  sleep 1
done

# Run setup
echo "Running setup..."
curl -sf "${GHOST_URL}/ghost/api/admin/authentication/setup/" \
  -X POST \
  -H 'Content-Type: application/json' \
  -H "Origin: ${GHOST_URL}" \
  -d "{\"setup\":[{\"name\":\"Test\",\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"blogTitle\":\"${BLOG_TITLE}\"}]}" \
  >/dev/null

# Create a session (get cookie)
COOKIE_JAR=$(mktemp)
curl -sf "${GHOST_URL}/ghost/api/admin/session/" \
  -X POST \
  -H 'Content-Type: application/json' \
  -H "Origin: ${GHOST_URL}" \
  -c "$COOKIE_JAR" \
  -d "{\"username\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
  >/dev/null

# Create a custom integration to get a stable API key
INTEGRATION_RESPONSE=$(curl -sf "${GHOST_URL}/ghost/api/admin/integrations/" \
  -X POST \
  -H 'Content-Type: application/json' \
  -H "Origin: ${GHOST_URL}" \
  -b "$COOKIE_JAR" \
  -d '{"integrations":[{"name":"Test Integration"}]}')

rm -f "$COOKIE_JAR"

ADMIN_API_KEY=$(echo "$INTEGRATION_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for key in data['integrations'][0]['api_keys']:
    if key['type'] == 'admin':
        print(key['secret'])
        break
")

CONTENT_API_KEY=$(echo "$INTEGRATION_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for key in data['integrations'][0]['api_keys']:
    if key['type'] == 'content':
        print(key['secret'])
        break
")

# Write keys to file
cat > "$OUTPUT_FILE" <<EOF
GHOST_API_URL=${GHOST_URL}
GHOST_ADMIN_API_KEY=${ADMIN_API_KEY}
GHOST_CONTENT_API_KEY=${CONTENT_API_KEY}
EOF

echo ""
echo "=== Ghost is ready ==="
echo "API URL:          ${GHOST_URL}"
echo "Admin API Key:    ${ADMIN_API_KEY}"
echo "Content API Key:  ${CONTENT_API_KEY}"
echo "Keys written to:  ${OUTPUT_FILE}"
echo ""
echo "To stop: docker rm -f ${CONTAINER_NAME}"
