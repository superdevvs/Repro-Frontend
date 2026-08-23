#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/frontend}"
FRONTEND_URL="${FRONTEND_URL:-https://reprodashboard.com}"
API_HEALTH_URL="${API_HEALTH_URL:-https://api.reprodashboard.com/up}"
BUILD_DIR="/tmp/repro-frontend-build-$$"
RELEASE_ID="$(date +%Y%m%d%H%M%S)"
RELEASE_DIR="$APP_DIR/releases/$RELEASE_ID"
DIST_PATH="$APP_DIR/dist"
DEPLOY_COMMIT="${DEPLOY_COMMIT:-unknown}"
PREVIOUS_DIST_TARGET=""
ACTIVATED=0
VERIFIED=0

rollback_release() {
  if [ "$ACTIVATED" -ne 1 ] || [ "$VERIFIED" -eq 1 ]; then
    return
  fi

  echo "Deployment verification failed; restoring the previous frontend release." >&2
  if [ -n "$PREVIOUS_DIST_TARGET" ] && [ -d "$PREVIOUS_DIST_TARGET" ]; then
    ln -sfn "$PREVIOUS_DIST_TARGET" "$APP_DIR/dist.rollback"
    mv -Tf "$APP_DIR/dist.rollback" "$DIST_PATH"
    echo "frontend_rollback_complete:$PREVIOUS_DIST_TARGET" >&2
  else
    rm -f "$DIST_PATH"
    echo "No previous frontend release was available to restore." >&2
  fi
}

cleanup() {
  local exit_code=$?
  trap - EXIT
  set +e
  rollback_release
  if [ "$VERIFIED" -ne 1 ] && [ -d "$RELEASE_DIR" ]; then
    local active_dist=""
    active_dist="$(readlink -f "$DIST_PATH" 2>/dev/null || true)"
    if [ "$active_dist" != "$RELEASE_DIR/dist" ]; then
      rm -rf "$RELEASE_DIR"
    fi
  fi
  rm -rf "$BUILD_DIR"
  exit "$exit_code"
}
trap cleanup EXIT

if [ ! -f "$APP_DIR/.nvmrc" ]; then
  echo "Missing $APP_DIR/.nvmrc; refusing to build with an unknown Node version." >&2
  exit 1
fi

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "NVM is required at $NVM_DIR/nvm.sh for the frontend build." >&2
  exit 1
fi
# shellcheck source=/dev/null
. "$NVM_DIR/nvm.sh"
nvm install --no-progress "$(tr -d '\r\n' < "$APP_DIR/.nvmrc")"
nvm use --silent "$(tr -d '\r\n' < "$APP_DIR/.nvmrc")"
echo "Building with Node $(node --version) and npm $(npm --version)."

if [ ! -f "$APP_DIR/.env" ]; then
  echo "Missing production environment file: $APP_DIR/.env" >&2
  exit 1
fi

mkdir -p "$BUILD_DIR" "$APP_DIR/releases"
# '/dist' and '/releases' are anchored and carry no trailing slash on purpose. A
# trailing-slash rsync pattern matches directories only, and $APP_DIR/dist is a
# SYMLINK to the live release. With 'dist/' the symlink was copied into the build
# directory, so `npm run build` wrote its output straight through it into the
# PREVIOUS release, corrupting the rollback candidate and leaving every retained
# release holding the build that came after it. The leading slash anchors the
# pattern to the transfer root so a nested dist/ elsewhere is unaffected.
rsync -rltD --delete --omit-dir-times --no-owner --no-group --no-perms \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='/dist' \
  --exclude='/releases' \
  --exclude='.env*' \
  "$APP_DIR/" "$BUILD_DIR/"
# Belt and braces: whatever the exclude patterns do, the build must never write
# through an inherited link. A fresh build directory is the only safe target.
rm -rf "$BUILD_DIR/dist"
cp "$APP_DIR/.env" "$BUILD_DIR/.env"

cd "$BUILD_DIR"

# Vite gives inherited process variables precedence over values in .env. Remove
# every inherited VITE_* name without printing its value so this production
# build is controlled only by the protected server-side .env copied above.
CLEARED_VITE_VARIABLES=0
while IFS= read -r vite_variable; do
  [ -n "$vite_variable" ] || continue
  unset "$vite_variable"
  CLEARED_VITE_VARIABLES=$((CLEARED_VITE_VARIABLES + 1))
done < <(compgen -A variable VITE_ || true)
echo "Cleared $CLEARED_VITE_VARIABLES inherited VITE_* variable(s) before the production build."

# tr -d '\r' as an escape rather than a literal carriage byte: the literal form
# silently became a newline the first time this file was normalised to LF, which
# would have stripped the wrong character and failed the check below against a
# CRLF .env.
API_ENV_VALUE="$(sed -n 's/^[[:space:]]*VITE_API_URL[[:space:]]*=[[:space:]]*//p' .env | tail -n 1 | tr -d '\r')"
API_ENV_VALUE="${API_ENV_VALUE%/}"
if [ "$API_ENV_VALUE" != "https://api.reprodashboard.com" ]; then
  echo "Production VITE_API_URL is missing or invalid; expected https://api.reprodashboard.com." >&2
  exit 1
fi

# A lockfile mismatch must stop deployment. Falling back to npm install would
# produce an unreviewed dependency graph on the production server.
npm ci --no-audit --no-fund
npm run build

test -s "$BUILD_DIR/dist/index.html"
test -d "$BUILD_DIR/dist/assets"
HASHED_JS_FILE="$(find "$BUILD_DIR/dist/assets" -maxdepth 1 -type f -name '*-*.js' -print -quit)"
test -n "$HASHED_JS_FILE"
HASHED_JS_RELATIVE="assets/$(basename "$HASHED_JS_FILE")"

printf '{"release":"%s","commit":"%s","asset":"%s"}\n' \
  "$RELEASE_ID" "$DEPLOY_COMMIT" "$HASHED_JS_RELATIVE" > "$BUILD_DIR/dist/deploy-meta.json"

mkdir -p "$RELEASE_DIR/dist"
rsync -rltD --delete --omit-dir-times --no-owner --no-group --no-perms "$BUILD_DIR/dist/" "$RELEASE_DIR/dist/"

# Record this release's own asset filenames before anything is merged in, so a
# later deploy can tell this build's files from ones it adopted. Without the
# manifest the adopted set would grow transitively with every deploy instead of
# staying inside the retention window. Kept outside dist/ so it is not served.
find "$RELEASE_DIR/dist/assets" -maxdepth 1 -type f -printf '%f\n' | sort > "$RELEASE_DIR/own-assets.txt"

# Stale-session resilience.
#
# A browser tab left open across a deploy keeps requesting the asset filenames
# the index.html it already loaded was built with. Serving only the newest
# release 404s those requests, so the tab breaks the moment it lazy-loads a
# route chunk. Asset filenames are content-hashed, so one name can only ever
# mean one set of bytes: adopting a name from an older release cannot serve the
# wrong content for that URL.
#
# Hardlinks, not copies, so the bytes are shared with the release that built
# them. Bounded to the same releases the prune below keeps (active + 4) and
# recomputed from scratch on every deploy, so assets belonging to pruned
# releases fall out on their own instead of accumulating forever.
#
# index.html is untouched by this and still exists only in its own release, so a
# reload always lands on the newest build.
STALE_ASSET_LINKS=0
STALE_ASSET_SOURCES=0
while IFS= read -r previous_release; do
  [ -n "$previous_release" ] || continue
  [ "$previous_release" != "$RELEASE_DIR" ] || continue
  [ -d "$previous_release/dist/assets" ] || continue
  if [ "$STALE_ASSET_SOURCES" -ge 4 ]; then
    break
  fi
  STALE_ASSET_SOURCES=$((STALE_ASSET_SOURCES + 1))

  # Releases created before own-assets.txt existed fall back to their whole
  # assets directory. That over-includes once and corrects itself as those
  # releases age out of the retention window.
  previous_manifest="$previous_release/own-assets.txt"
  previous_manifest_is_temp=0
  if [ ! -f "$previous_manifest" ]; then
    previous_manifest="$(mktemp)"
    previous_manifest_is_temp=1
    find "$previous_release/dist/assets" -maxdepth 1 -type f -printf '%f\n' | sort > "$previous_manifest"
  fi

  while IFS= read -r asset_name; do
    [ -n "$asset_name" ] || continue
    [ ! -e "$RELEASE_DIR/dist/assets/$asset_name" ] || continue
    [ -f "$previous_release/dist/assets/$asset_name" ] || continue
    if ln "$previous_release/dist/assets/$asset_name" "$RELEASE_DIR/dist/assets/$asset_name" 2>/dev/null \
      || cp -p "$previous_release/dist/assets/$asset_name" "$RELEASE_DIR/dist/assets/$asset_name" 2>/dev/null; then
      STALE_ASSET_LINKS=$((STALE_ASSET_LINKS + 1))
    fi
  done < "$previous_manifest"

  if [ "$previous_manifest_is_temp" -eq 1 ]; then
    rm -f "$previous_manifest"
  fi
done < <(
  find "$APP_DIR/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
    | sort -rn \
    | cut -d' ' -f2-
)
echo "Adopted $STALE_ASSET_LINKS asset(s) from $STALE_ASSET_SOURCES retained release(s) for stale sessions."

if [ -L "$DIST_PATH" ]; then
  PREVIOUS_DIST_TARGET="$(readlink -f "$DIST_PATH")"
elif [ -e "$DIST_PATH" ]; then
  PREVIOUS_DIST_TARGET="$APP_DIR/dist.pre-atomic-$RELEASE_ID"
  mv "$DIST_PATH" "$PREVIOUS_DIST_TARGET"
fi

ln -sfn "$RELEASE_DIR/dist" "$APP_DIR/dist.next"
mv -Tf "$APP_DIR/dist.next" "$DIST_PATH"
ACTIVATED=1

verify_deployment() {
  local attempt marker
  for attempt in 1 2 3 4 5; do
    marker="$(curl --fail --silent --show-error \
      --connect-timeout 5 --max-time 20 \
      -H 'Cache-Control: no-cache' \
      "$FRONTEND_URL/deploy-meta.json?release=$RELEASE_ID" || true)"
    if [ "$marker" = "{\"release\":\"$RELEASE_ID\",\"commit\":\"$DEPLOY_COMMIT\",\"asset\":\"$HASHED_JS_RELATIVE\"}" ] \
      && curl --fail --silent --show-error --output /dev/null \
        --connect-timeout 5 --max-time 20 \
        -H 'Cache-Control: no-cache' \
        "$FRONTEND_URL/?release=$RELEASE_ID" \
      && curl --fail --silent --show-error --output /dev/null \
        --connect-timeout 5 --max-time 20 "$FRONTEND_URL/$HASHED_JS_RELATIVE"; then
      return 0
    fi
    echo "Deployment verification attempt $attempt/5 did not pass yet." >&2
    sleep 2
  done
  return 1
}

verify_deployment
VERIFIED=1

# Keep the active release plus the four newest rollback candidates.
ACTIVE_RELEASE="$(dirname "$(readlink -f "$DIST_PATH")")"
inactive_kept=0
while IFS= read -r release; do
  [ -n "$release" ] || continue
  if [ "$release" = "$ACTIVE_RELEASE" ]; then
    continue
  fi
  inactive_kept=$((inactive_kept + 1))
  if [ "$inactive_kept" -gt 4 ]; then
    rm -rf -- "$release"
  fi
done < <(
  find "$APP_DIR/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
    | sort -rn \
    | cut -d' ' -f2-
)

echo "frontend_deploy_complete:$RELEASE_ID:$DEPLOY_COMMIT"
