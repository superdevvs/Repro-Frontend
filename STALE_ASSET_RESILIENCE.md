# Stale-asset resilience for frontend releases

## The problem

Releases are activated by repointing a symlink:

```
/var/www/frontend/dist -> /var/www/frontend/releases/<RELEASE_ID>/dist
```

nginx serves the SPA from that symlink and answers static files with
`try_files $uri =404`. A browser tab open across a deploy keeps requesting the
content-hashed asset filenames the `index.html` it already loaded was built
with. Once the symlink moves, those filenames no longer exist under the document
root, so every one of them 404s and the tab breaks the moment it lazy-loads a
route chunk. The app code-splits heavily (103 `lazy()` call sites), so this is
reachable on almost any navigation.

Measured before the fix, at the origin with Cloudflare bypassed:

```
/assets/index-BGrzB5rU.css   HTTP 404    (built by release 20260822160356)
/assets/index-CnUeghUo.css   HTTP 404    (built by release 20260821072604)
```

Both releases were still on disk and still inside the retention window. Only the
document root could not see them.

## The fix

`deploy.sh` hardlinks the asset files of the retained previous releases into the
new release's `assets/` directory before that release is activated. nginx and its
`try_files $uri =404` are untouched.

Why this shape:

- **Hashed names make it safe.** An asset filename encodes a hash of its
  contents, so a given name can only ever mean one set of bytes. Adopting a name
  from an older release cannot serve the wrong content for that URL.
- **Hardlinks, not copies.** The bytes are shared with the release that built
  them, so the merge costs directory entries and no meaningful disk. Measured:
  `releases/` stayed at 116 MB while the active release went from 265 to 523
  asset files.
- **Bounded by the existing retention.** Only the four newest retained releases
  are read, matching the prune that keeps the active release plus four rollback
  candidates. The merge is recomputed from scratch on every deploy, so assets
  belonging to a pruned release fall out on their own rather than accumulating.
- **`own-assets.txt` prevents unbounded growth.** Each release records the asset
  filenames of its *own* build, written before anything is merged in. Later
  deploys read that manifest instead of the directory listing, so an adopted file
  is never re-adopted transitively into the next release. Releases created before
  this file existed fall back to their whole assets directory; that over-includes
  once and corrects itself as they age out.
- **`index.html` is deliberately excluded.** It is not an asset and is never
  merged, so it exists only in its own release. nginx matches it via
  `location = /index.html` and the SPA fallback in `location /`, both of which
  resolve against the current release root. Any reload or fresh navigation
  therefore always lands on the newest build.

### Verified behaviour

At the origin, and again through Cloudflare, after deploying release
`20260823054629`:

| URL | before | after |
| --- | --- | --- |
| `/assets/index-BRIwXyYB.css` (current build) | 200, 321,445 B | 200, 321,445 B |
| `/assets/index-BGrzB5rU.css` (older retained release) | **404** | **200, 324,981 B** |
| `/assets/index-CnUeghUo.css` (oldest retained release) | **404** | **200, 324,710 B** |
| `/assets/index-DOESNOTEXIST.css` (never existed) | 404 | **404** |
| `/index.html` | current build | current build |

`index.html` continued to reference only the current build's assets
(`index-BRIwXyYB.css`, `index-x6_NQth0.js`), confirming the merge does not leak
into the served document.

## A release-corruption bug fixed at the same time

The build directory was populated with:

```
rsync ... --exclude='dist/' --exclude='releases/' "$APP_DIR/" "$BUILD_DIR/"
```

An rsync pattern ending in `/` matches directories only, and `$APP_DIR/dist` is
a **symlink**. The symlink was therefore copied into the build directory, and
`npm run build` wrote its output straight through it into the *previous*
release. Proven two ways:

```
$ rsync --dry-run --itemize-changes ... | grep dist
cL+++++++++ dist -> /var/www/frontend/releases/20260823051210/dist
```

and every release directory's newest file carried the mtime of the deploy that
came *after* it, with `deploy-meta.json` shifted by one release.

Consequences: retained releases did not contain the build they claimed, and the
automatic rollback in `deploy.sh` would have restored the same build it was
rolling back from — the pipeline's main safety net was inert.

Fixed by anchoring the patterns without a trailing slash (`/dist`, `/releases`)
and removing any inherited link before building:

```bash
rm -rf "$BUILD_DIR/dist"
```

Confirmed after the next deploy: release `20260823051210` kept its own build
(newest file 05:12, its own deploy time, instead of being stamped with the 05:46
deploy) and its `deploy-meta.json` now matches its directory name. The three
older releases still carry pre-existing shifted metadata that cannot be
retroactively repaired; it ages out of the retention window over the next four
deploys.

While fixing this, a literal carriage-return byte inside `tr -d '<CR>'` was
found on the `VITE_API_URL` check line. Normalising the file to LF would silently
turn it into a newline and strip the wrong character, failing the check against a
CRLF `.env`. It is now the explicit escape `tr -d '\r'`, verified to behave
identically for CRLF and LF `.env` files.

## Rollback

Everything lives in version-controlled `frontend/deploy.sh`. There is no nginx
change to revert.

Revert the deploy-script behaviour:

```bash
git revert 80f27314bddcfee23a762db42fd761a40b1411de
# then deploy normally
```

The merge is not destructive, so reverting simply stops future releases adopting
assets. Already-adopted hardlinks in existing releases are harmless and disappear
as those releases are pruned. To strip them from a specific release by hand:

```bash
cd /var/www/frontend/releases/<RELEASE_ID>
comm -13 own-assets.txt <(find dist/assets -maxdepth 1 -type f -printf '%f\n' | sort) \
  | while IFS= read -r f; do rm -f "dist/assets/$f"; done
```

Server-side backups taken before this work:

```
/var/www/frontend/deploy-backups/deploy.sh.bak-staleassets-20260823-052716
/var/www/frontend/deploy-backups/frontend.conf.bak-staleassets-20260823-052716
```

Emergency restore of a known-good document root, independent of the release tree:

```bash
ln -sfn /var/www/frontend/dist.known-good-b58d1bd /var/www/frontend/dist.restore
mv -Tf /var/www/frontend/dist.restore /var/www/frontend/dist
```

## Rejected alternative: nginx fallback chain

An `assets` fallback chain in nginx would keep release directories as pure build
artifacts and do the union at request time:

```nginx
location ~* \.(js|css|woff2?|ttf|eot|png|jpg|jpeg|gif|svg)$ {
    try_files $uri @stale_release_1;
}
location @stale_release_1 {
    root /var/www/frontend/dist.prev1;
    try_files $uri @stale_release_2;
}
# ... through @stale_release_4, ending in try_files $uri =404;
```

with `deploy.sh` repointing `dist.prev1..dist.prev4` after pruning.

Not adopted: `/etc/nginx` is root-owned and the deploy user has no passwordless
sudo, so this cannot be applied or rolled back by the deploy pipeline. It would
also still require the same `deploy.sh` change to maintain the pointers, for no
behavioural gain over the hardlink merge. Kept here in case nginx config
management moves under automation later.

## Second safety net: already present

A one-time reload recovery for dynamic-import failures already exists and is
wired up — no new work was needed:

- `src/lib/chunkLoadRecovery.ts` matches the five common failure messages
  (`Failed to fetch dynamically imported module`, `ChunkLoadError`,
  `Loading chunk X failed`, and so on).
- `src/main.tsx` installs global `error` and `unhandledrejection` listeners.
- `src/components/ui/ErrorBoundary.tsx` calls it from `componentDidCatch` and
  shows a specific message: *"A new version of the app was detected. We are
  trying to refresh to the latest build."*
- `src/App.tsx` clears the guard on a successful load.

The loop guard is doubled: a `sessionStorage` key **and** a `__chunk_reload`
query parameter are both checked before reloading, so a persistently broken
chunk degrades to the error UI instead of a reload loop. Covered by
`src/lib/chunkLoadRecovery.test.ts` (5 tests).

The asset merge and this reload net are complementary. The merge stops the error
happening for any release still in the retention window; the reload net covers
what the merge cannot, such as a session older than five releases or a genuinely
removed asset.
## Backlog

### Add release immutability / integrity assertion to `deploy.sh`

**Why.** The corruption above went unnoticed across at least four deploys. Every
signal needed to catch it was already on disk — `deploy-meta.json` recorded a
release id that no longer matched its own directory name — but nothing ever
compared them, so a silently broken rollback candidate looked healthy. The fix
stops that specific cause; an assertion would catch the next one, whatever it is.

**Shape.** After activation and verification, before pruning, assert that each
retained release is still the build it claims to be, and fail the deploy loudly
if not. Cheap checks that would have caught this exact bug:

- `deploy-meta.json`'s `release` field equals its own directory name.
- No file inside a non-active release is newer than that release's own directory,
  which is what betrayed the write-through. Note adopted hardlinks legitimately
  carry an older mtime, so the check is one-directional: newer is suspicious,
  older is fine.
- The active release's `index.html` references only asset filenames present in
  its own `own-assets.txt`.

A stronger version records a manifest of `sha256` sums per release at build time
and re-verifies the active release's own files on each deploy. That also turns
"is this rollback candidate safe?" into a question with an answer, which it
currently is not.

**Worth noting for whoever picks this up.** Releases `20260823035351`,
`20260822160356` and `20260821072604` still carry shifted metadata from before
the fix, so a naive assertion added today would fail on them. Either scope the
assertion to releases created after the fix, or wait until those three age out of
the retention window (four more deploys).
