#!/usr/bin/env bash
echo "Stopping Razzia server on ports 3000 and 3001..."
PIDS=$(lsof -t -i :3000 -i :3001 2>/dev/null)
if [ -n "$PIDS" ]; then
  kill -9 $PIDS 2>/dev/null
  echo "Server stopped."
else
  echo "No server processes found running on port 3000 or 3001."
fi
