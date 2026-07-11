# ExonHost Deployment Runbook

This runbook records the deployment method that has already worked for Blackkin on ExonHost/Webuzo. Use it for future first-time setup or production updates.

Do not store server, portal, SMS, Convex, R2, or payment credentials in this file.

## Current Known Production Setup

- Domain: `blackkin.com`
- Existing WordPress site on same server: `banglanest.com`
- ExonHost server IP: `103.159.36.106`
- Server hostname shown in ExonHost portal: `server.banglanest.com`
- ExonHost service: dedicated server, AlmaLinux 9
- Blackkin app root: `/home/banglan/nodeapps/blackkin`
- Blackkin backup root: `/home/banglan/nodeapps/backups`
- Release upload root: `/home/banglan/nodeapps/releases`
- App user/group: `banglan:banglan`
- Runtime: Node.js 22 from `/usr/local/apps/nodejs22/bin/node`
- Live app bind: `HOSTNAME=127.0.0.1`, `PORT=30001`
- Webuzo/LiteSpeed proxies `blackkin.com` to the local Node port.
- Convex live URL: `https://elated-labrador-720.convex.cloud`
- Convex site URL: `https://elated-labrador-720.convex.site`
- Cloudflare stays active for DNS/proxy/SSL/R2.

## Static Storefront And Media Delivery

- `media.blackkin.com` is the public custom domain for the `blackkin-storage` R2 bucket.
- The Cloudflare cache rule `Cache Blackkin R2 media` applies only when the hostname equals `media.blackkin.com` and sets one-year edge/browser TTLs.
- Production builds must set `NEXT_PUBLIC_R2_PUBLIC_BASE_URL=https://media.blackkin.com`. Without it, storefront media falls back to a dynamic signed-URL redirect route.
- The expected production build classification is:
  - `/` and `/products`: static ISR with a 15-minute fallback refresh.
  - `/products/[slug]`: SSG for all active product slugs with a 15-minute fallback refresh.
  - account, checkout, admin, auth, and API routes: dynamic.
- Stock remains a live Convex subscription on product pages; cart and authentication remain fully dynamic.
- Product, landing-page, navigation, size/color, category/tag, discount, and marketing admin saves request an immediate storefront cache refresh. The 15-minute ISR window remains the safety fallback.

## Safety Rules

- Never edit OpenLiteSpeed/Webuzo vhost files manually for routine updates.
- Never stop or restart services for `banglanest.com`.
- Never change Cloudflare DNS, proxy settings, SSL, Workers, or R2 during an ExonHost app update unless the task explicitly requires it.
- Never package `.env.local`, source secrets, `.git`, `.next/cache`, `.open-next`, or `.wrangler`.
- Preserve these live Webuzo app files during every replacement:
  - `/home/banglan/nodeapps/blackkin/blackkin.env`
  - `/home/banglan/nodeapps/blackkin/start-blackkin.sh`
- Stop only the Blackkin Node process, not LiteSpeed globally.
- Always keep a timestamped server backup before replacing the app.
- If Blackkin fails after a swap, roll back the app directory first. Do not touch Convex data.
- Avoid `npm run dev` on the Windows machine for deployment verification. It has previously been unstable on this PC.

## Getting Server Access

1. Log in to ExonHost client area: `https://my.exonhost.com/login`.
2. Go to `My Services`.
3. Open the active dedicated server service for `server.banglanest.com`.
4. Reveal the server password from `Server Details`.
5. SSH as `root` to `103.159.36.106` on port `22`.

Important: the revealed password may differ subtly from screenshots, especially uppercase `I` versus lowercase `l`. Use the current value from the ExonHost portal.

Do not write the password into scripts, docs, commits, or chat summaries.

## First-Time Webuzo-Native Setup

Use this only if `blackkin.com` is not already configured in Webuzo.

1. Preflight checks:

   ```powershell
   curl.exe --ssl-no-revoke -I -L --max-time 20 https://banglanest.com/
   curl.exe --ssl-no-revoke -I -L --max-time 20 https://blackkin.com/
   ```

2. In Webuzo end-user panel, create `blackkin.com` as an Addon Domain under the existing `banglan` account.

3. Add `www.blackkin.com` as an alias/subdomain if Webuzo offers it.

4. Let Webuzo create and own the domain/vhost entries. Do not hand-edit LiteSpeed config.

5. Create the Node app directory:

   ```bash
   mkdir -p /home/banglan/nodeapps/blackkin
   chown -R banglan:banglan /home/banglan/nodeapps/blackkin
   ```

6. In Webuzo Application Manager, create a Node.js app:

   - Type: Node.js
   - Mode: Self Managed
   - Domain: `blackkin.com`
   - Application root: `/home/banglan/nodeapps/blackkin`
   - Startup command/file: `node server.js` or the Webuzo-created equivalent
   - Node version: Node 22.x if available, otherwise Node 20.x

7. Environment variables must include:

   ```bash
   NODE_ENV=production
   HOSTNAME=127.0.0.1
   PORT=<Webuzo assigned port>
   NEXT_PUBLIC_SITE_URL=https://blackkin.com
   NEXT_PUBLIC_CONVEX_URL=https://elated-labrador-720.convex.cloud
   NEXT_PUBLIC_CONVEX_SITE_URL=https://elated-labrador-720.convex.site
   NEXT_PUBLIC_R2_PUBLIC_BASE_URL=https://media.blackkin.com
   OPENNEXT_CLOUDFLARE_DEV=false
   ```

   Also include any production-only secret env values already used by the app, such as SMS credentials. Do not overwrite existing working secrets unless required.

8. After the first app works, future updates should use the update flow below.

## Update Existing Deployment

### 1. Local Preflight

From the repo root:

```powershell
npx tsc --noEmit --pretty false
```

Push Convex functions to the same deployment used by production:

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED='0'
npx convex dev --once --typecheck enable --tail-logs disable
```

The TLS workaround is only for the local command if Windows certificate verification fails. Convex data is not deleted by this command.

### 2. Build Production Standalone Output

```powershell
$env:NEXT_PUBLIC_SITE_URL='https://blackkin.com'
$env:NEXT_PUBLIC_CONVEX_URL='https://elated-labrador-720.convex.cloud'
$env:NEXT_PUBLIC_CONVEX_SITE_URL='https://elated-labrador-720.convex.site'
$env:NEXT_PUBLIC_R2_PUBLIC_BASE_URL='https://media.blackkin.com'
$env:OPENNEXT_CLOUDFLARE_DEV='false'
$env:NODE_ENV='production'
npm run build
```

Expected build output: Next standalone app under `.next/standalone`.

### 3. Package Release

Use a timestamp, for example `YYYYMMDD-HHMMSS`.

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$release = Join-Path $env:TEMP "blackkin-release-$stamp"
$tarball = "$release.tar.gz"

Remove-Item -LiteralPath $release -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $release | Out-Null

Copy-Item -LiteralPath ".next\standalone\*" -Destination $release -Recurse -Force
New-Item -ItemType Directory -Path (Join-Path $release ".next") -Force | Out-Null
Copy-Item -LiteralPath ".next\static" -Destination (Join-Path $release ".next") -Recurse -Force
Copy-Item -LiteralPath "public" -Destination $release -Recurse -Force

tar -czf $tarball -C $release .
Get-Item -LiteralPath $tarball
```

Confirm the tarball contains `server.js`, `package.json`, `node_modules`, `.next/static`, and `public`.

```powershell
tar -tzf $tarball | Select-Object -First 40
```

### 4. Server Preflight

Before uploading or swapping:

```powershell
curl.exe --ssl-no-revoke -I -L --max-time 20 https://banglanest.com/
curl.exe --ssl-no-revoke -I -L --max-time 20 https://blackkin.com/
```

On the server, inspect only:

```bash
ls -ld /home/banglan/nodeapps/blackkin
find /home/banglan/nodeapps/blackkin -maxdepth 1 -printf "%M %u:%g %s %p\n" | sort
ps -eo pid,user,ppid,cmd | grep -E "nodeapps/blackkin|next-server" | grep -v grep
ss -ltnp 2>/dev/null | grep "127.0.0.1:30001" || true
awk -F= '/^(NODE_ENV|PORT|HOSTNAME|NEXT_PUBLIC_SITE_URL|NEXT_PUBLIC_CONVEX_URL|NEXT_PUBLIC_CONVEX_SITE_URL|NEXT_PUBLIC_R2_PUBLIC_BASE_URL|OPENNEXT_CLOUDFLARE_DEV)=/ {print $1"="$2}' /home/banglan/nodeapps/blackkin/blackkin.env
```

Expected env:

```bash
NODE_ENV=production
PORT=30001
HOSTNAME=127.0.0.1
NEXT_PUBLIC_SITE_URL=https://blackkin.com
NEXT_PUBLIC_CONVEX_URL=https://elated-labrador-720.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://elated-labrador-720.convex.site
NEXT_PUBLIC_R2_PUBLIC_BASE_URL=https://media.blackkin.com
OPENNEXT_CLOUDFLARE_DEV=false
```

### 5. Upload Release

Upload the tarball to:

```bash
/home/banglan/nodeapps/releases/blackkin-YYYYMMDD-HHMMSS.tar.gz
```

Create these directories if needed:

```bash
mkdir -p /home/banglan/nodeapps/releases /home/banglan/nodeapps/backups /home/banglan/nodeapps/failed
```

### 6. Swap Release

Set variables:

```bash
APP=/home/banglan/nodeapps/blackkin
STAMP=YYYYMMDD-HHMMSS
TAR=/home/banglan/nodeapps/releases/blackkin-$STAMP.tar.gz
RELEASE=/home/banglan/nodeapps/releases/blackkin-$STAMP
BACKUP=/home/banglan/nodeapps/backups/blackkin-before-$STAMP
FAILED=/home/banglan/nodeapps/failed/blackkin-failed-$STAMP
LOG=/home/banglan/blackkin.com_ggA6wc0r.log
NODEPATH=/usr/local/apps/nodejs22/bin:/usr/kerberos/sbin:/usr/kerberos/bin:/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin:/root/bin:/usr/local/emps/bin:/usr/local/emps/sbin
```

Prepare the release and preserve Webuzo files:

```bash
set -euo pipefail
rm -rf "$RELEASE"
mkdir -p "$RELEASE"
tar -xzf "$TAR" -C "$RELEASE"

test -f "$RELEASE/server.js"
test -d "$RELEASE/.next/static"
test -d "$RELEASE/public"
test -f "$APP/blackkin.env"
test -f "$APP/start-blackkin.sh"

cp -p "$APP/blackkin.env" "$RELEASE/blackkin.env"
cp -p "$APP/start-blackkin.sh" "$RELEASE/start-blackkin.sh"

chown -R banglan:banglan "$RELEASE"
find "$RELEASE" -type d -exec chmod 755 {} +
find "$RELEASE" -type f -exec chmod 644 {} +
chmod 600 "$RELEASE/blackkin.env"
chmod 700 "$RELEASE/start-blackkin.sh"
```

Stop only Blackkin:

```bash
pids=$(ps -eo pid,user,cmd | awk '$2=="banglan" && ($0 ~ /nodeapps\/blackkin/ || $0 ~ /next-server \(v16\.2\.4\)/) {print $1}')
if [ -n "${pids:-}" ]; then
  kill $pids 2>/dev/null || true
  sleep 3
fi
still=$(ps -eo pid,user,cmd | awk '$2=="banglan" && ($0 ~ /nodeapps\/blackkin/ || $0 ~ /next-server \(v16\.2\.4\)/) {print $1}')
if [ -n "${still:-}" ]; then
  kill -9 $still 2>/dev/null || true
  sleep 1
fi
```

Swap and start:

```bash
test ! -e "$BACKUP"
mv "$APP" "$BACKUP"
mv "$RELEASE" "$APP"
chown -R banglan:banglan "$APP"

runuser -u banglan -- bash -lc "cd /home/banglan/nodeapps/blackkin && export PATH=$NODEPATH && export TMPDIR=/home/banglan/tmp/ && export NODE_ENV=production && nohup bash start-blackkin.sh >> $LOG 2>&1 &"
sleep 5
```

Startup check:

```bash
ss -ltnp 2>/dev/null | grep "127.0.0.1:30001"
curl -sS -I --max-time 20 http://127.0.0.1:30001/ | sed -n '1,12p'
tail -80 "$LOG"
```

If Windows-created file modes become too open after extraction, fix them:

```bash
chown -R banglan:banglan "$APP"
find "$APP" -type d -exec chmod 755 {} +
find "$APP" -type f -exec chmod 644 {} +
chmod 600 "$APP/blackkin.env"
chmod 700 "$APP/start-blackkin.sh"
```

## Rollback

Rollback only the Blackkin app:

```bash
APP=/home/banglan/nodeapps/blackkin
BACKUP=/home/banglan/nodeapps/backups/blackkin-before-YYYYMMDD-HHMMSS
FAILED=/home/banglan/nodeapps/failed/blackkin-failed-YYYYMMDD-HHMMSS
LOG=/home/banglan/blackkin.com_ggA6wc0r.log
NODEPATH=/usr/local/apps/nodejs22/bin:/usr/kerberos/sbin:/usr/kerberos/bin:/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin:/root/bin:/usr/local/emps/bin:/usr/local/emps/sbin

pids=$(ps -eo pid,user,cmd | awk '$2=="banglan" && ($0 ~ /nodeapps\/blackkin/ || $0 ~ /next-server/) {print $1}')
if [ -n "${pids:-}" ]; then
  kill $pids 2>/dev/null || true
  sleep 3
fi

rm -rf "$FAILED"
mv "$APP" "$FAILED"
mv "$BACKUP" "$APP"
chown -R banglan:banglan "$APP"

runuser -u banglan -- bash -lc "cd /home/banglan/nodeapps/blackkin && export PATH=$NODEPATH && export TMPDIR=/home/banglan/tmp/ && export NODE_ENV=production && nohup bash start-blackkin.sh >> $LOG 2>&1 &"
sleep 5

ss -ltnp 2>/dev/null | grep "127.0.0.1:30001"
curl -sS -I --max-time 20 http://127.0.0.1:30001/ | sed -n '1,12p'
```

Use Convex rollback only if the frontend rollback still fails because of backend behavior. Do not delete Convex data.

## Smoke Tests

Run after every deployment:

```powershell
curl.exe --ssl-no-revoke -I -L --max-time 20 https://banglanest.com/
curl.exe --ssl-no-revoke -I -L --max-time 20 https://blackkin.com/
curl.exe --ssl-no-revoke -I -L --max-time 20 https://blackkin.com/products
curl.exe --ssl-no-revoke -I -L --max-time 20 "https://blackkin.com/products?onSale=true"
curl.exe --ssl-no-revoke -I -L --max-time 20 https://blackkin.com/challenge
curl.exe --ssl-no-revoke -I -L --max-time 20 https://blackkin.com/account
```

Expected:

- `banglanest.com` returns `200`.
- `blackkin.com` returns `200`.
- `/products` returns `200`.
- `/products?onSale=true` returns `200`.
- `/challenge` returns `404`.
- `/account` returns `307` to `/login?next=%2Faccount`, then login page returns `200` if following redirects.

Optional content checks:

- Product detail page has no visible `Size guide`.
- Product detail sizes do not show legacy `M`.
- Checkout is behind login; avoid OTP tests unless SMS sending is intentional.
- Checkout should show Cash on Delivery only after login.
- Checkout delivery should be BDT 80 unless a free-delivery bundle rule applies.

## Notes From The Successful 2026-07-04 Update

- The working production env was stored in `/home/banglan/nodeapps/blackkin/blackkin.env`.
- The working startup wrapper was `/home/banglan/nodeapps/blackkin/start-blackkin.sh`:

  ```bash
  #!/usr/bin/env bash
  set -euo pipefail
  cd /home/banglan/nodeapps/blackkin
  set -a
  . /home/banglan/nodeapps/blackkin/blackkin.env
  set +a
  exec /usr/local/apps/nodejs22/bin/node server.js
  ```

- The update reduced the app directory from about `1.4G` to about `103M` because only standalone output was deployed.
- A Paramiko/local timeout occurred after the remote script had already completed. Always re-check server state before retrying a swap.
- After the swap, permissions from the Windows tar extraction were too open (`777`/`666`) and were corrected to `755` dirs, `644` files, `600` env, `700` start script.
- The deployed package no longer used OpenNext scripts or dependencies. The string `wrangler` may still appear in a lint ignore pattern; that is not a Cloudflare deployment path.
