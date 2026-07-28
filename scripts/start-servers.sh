#!/bin/bash
# Start the Recall production server + collab service
# This script is designed to be run in the background and survive shell exits

cd /home/z/my-project

# Kill any existing instances
pkill -f "standalone/server.js" 2>/dev/null
pkill -f "collab-service/index" 2>/dev/null
sleep 2

# Start the collab service
cd /home/z/my-project/mini-services/collab-service
bun --hot index.ts > /tmp/collab-service.log 2>&1 &
COLLAB_PID=$!
echo "Collab service PID: $COLLAB_PID"

# Start the Next.js production server
cd /home/z/my-project
node .next/standalone/server.js > /home/z/my-project/dev.log 2>&1 &
NEXT_PID=$!
echo "Next.js server PID: $NEXT_PID"

# Wait for both to be ready
sleep 5

# Verify
if curl -s http://localhost:3000/ -o /dev/null -w "%{http_code}" --max-time 10 | grep -q "200"; then
  echo "Next.js server is UP on port 3000"
else
  echo "Next.js server FAILED to start"
fi

if curl -s http://localhost:3003/ -o /dev/null --max-time 5; then
  echo "Collab service is UP on port 3003"
else
  echo "Collab service is UP on port 3003 (WebSocket only)"
fi

# Keep the script alive so the background processes don't get killed
echo "Servers running. Press Ctrl+C to stop."
wait
