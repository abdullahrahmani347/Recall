#!/bin/bash
# Start production servers for Recall
cd /home/z/my-project

# Kill any existing instances
pkill -f "standalone/server.js" 2>/dev/null
pkill -f "collab-service/index.ts" 2>/dev/null
sleep 2

# Start collab service
cd /home/z/my-project/mini-services/collab-service
nohup bun --hot index.ts > /tmp/collab-service.log 2>&1 &
echo "Collab PID: $!"

# Start Next.js production server
cd /home/z/my-project
nohup node .next/standalone/server.js > /home/z/my-project/dev.log 2>&1 &
echo "Next PID: $!"

# Wait for both to be ready
sleep 5

# Verify
curl -s http://localhost:3000/ -o /dev/null -w "Next: %{http_code}\n" --max-time 10
curl -s http://localhost:3003/ -o /dev/null -w "Collab: %{http_code}\n" --max-time 5

# Keep the script alive
wait
