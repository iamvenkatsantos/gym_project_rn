#!/usr/bin/env bash
# Records demo/corefit-gym-demo.mp4 from the demo build of the app.
# Needs ffmpeg, python3 and Playwright with Chromium (npm i -D playwright && npx playwright install chromium).
set -euo pipefail
cd "$(dirname "$0")"
WORK=$(mktemp -d)
trap 'kill $SERVER 2>/dev/null || true; rm -rf "$WORK"' EXIT

(cd ../.. && EXPO_PUBLIC_DEMO_MODE=true npx expo export -p web --output-dir "$WORK/web")
cp stage.html "$WORK/web/"
cp ../../assets/images/logo.png "$WORK/web/"
python3 -m http.server 8081 --directory "$WORK/web" >/dev/null 2>&1 &
SERVER=$!
sleep 1

node record.js rec
python3 encode.py
ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i frames.txt \
  -vf "fps=30,scale=1920:1080:flags=lanczos,format=yuv420p" \
  -c:v libx264 -preset slow -crf 26 -tune stillimage -movflags +faststart ../corefit-gym-demo.mp4
rm -rf frames frames.json frames.txt
echo "Wrote demo/corefit-gym-demo.mp4"
