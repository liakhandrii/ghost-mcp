#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="ghost-test"

echo "Stopping Ghost test container..."
docker rm -f "$CONTAINER_NAME" 2>/dev/null && echo "Container removed." || echo "No container to remove."
