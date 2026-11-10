#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Ensure old instances are stopped
kill -9 $(lsof -t -i :3000 -i :3001) 2>/dev/null || true

export PATH="$DIR/.tools/node/bin:$PATH"
exec pnpm start
