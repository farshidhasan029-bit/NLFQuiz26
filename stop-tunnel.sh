#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Stopping Cloudflare Tunnel..."
pkill -f "cloudflared tunnel --url http://localhost:3000" 2>/dev/null && echo "Tunnel stopped." || echo "No tunnel running."
rm -f "$DIR/tunnel-url.txt"
