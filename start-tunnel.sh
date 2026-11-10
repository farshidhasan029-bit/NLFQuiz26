#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Stop existing tunnel if running
pkill -f "cloudflared tunnel --url http://localhost:3000" 2>/dev/null || true

echo "Starting Cloudflare Tunnel for http://localhost:3000..."
"$DIR/.tools/cloudflared" tunnel --url http://localhost:3000 > "$DIR/tunnel.log" 2>&1 &
TUNNEL_PID=$!

echo "Waiting for public URL..."
URL=""
for i in {1..30}; do
  if grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' "$DIR/tunnel.log" 2>/dev/null | grep -q 'trycloudflare'; then
    URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' "$DIR/tunnel.log" | head -n 1)
    break
  fi
  sleep 1
done

if [ -n "$URL" ]; then
  echo "$URL" > "$DIR/tunnel-url.txt"
  echo ""
  echo "=========================================================="
  echo " 🎉 Quiz is live on the Internet!"
  echo " 🌐 Public URL for Participants: $URL"
  echo " 👑 Host / Manager URL:          $URL/manager"
  echo "=========================================================="
else
  echo "Failed to get tunnel URL within 30s. Check $DIR/tunnel.log"
fi
