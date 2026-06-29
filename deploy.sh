#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/frontend"
BUILD_DIR="/tmp/repro-frontend-build-$$"
RELEASE_ID="$(date +%Y%m%d%H%M%S)"
RELEASE_DIR="$APP_DIR/releases/$RELEASE_ID"
DIST_PATH="$APP_DIR/dist"

cleanup() {
  rm -rf "$BUILD_DIR"
}
trap cleanup EXIT

mkdir -p "$BUILD_DIR" "$APP_DIR/releases"
rsync -rltD --delete --omit-dir-times --no-owner --no-group --no-perms \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='dist/' \
  --exclude='releases/' \
  --exclude='.env' \
  "$APP_DIR/" "$BUILD_DIR/"

cd "$BUILD_DIR"
if ! npm ci; then
  npm install
fi
npm run build

test -f "$BUILD_DIR/dist/index.html"
test -d "$BUILD_DIR/dist/assets"

mkdir -p "$RELEASE_DIR/dist"
rsync -rltD --delete --omit-dir-times --no-owner --no-group --no-perms "$BUILD_DIR/dist/" "$RELEASE_DIR/dist/"

if [ -e "$DIST_PATH" ] && [ ! -L "$DIST_PATH" ]; then
  mv "$DIST_PATH" "$APP_DIR/dist.pre-atomic-$RELEASE_ID"
fi

ln -sfn "$RELEASE_DIR/dist" "$APP_DIR/dist.next"
mv -Tf "$APP_DIR/dist.next" "$DIST_PATH"

curl -fsS -o /dev/null https://reprodashboard.com
curl -fsS -o /dev/null https://api.reprodashboard.com/api/ip-location

ACTIVE_RELEASE="$(dirname "$(readlink -f "$DIST_PATH")")"
find "$APP_DIR/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -rn \
  | cut -d' ' -f2- \
  | while IFS= read -r release; do
      [ "$release" = "$ACTIVE_RELEASE" ] && continue
      printf '%s\n' "$release"
    done \
  | tail -n +4 \
  | xargs -r rm -rf

echo "frontend_deploy_complete:$RELEASE_ID"
