#!/usr/bin/env bash
#
# Bring the whole ShopCore stack up: MySQL, migrations, seed, backend, frontend.
#
# Idempotent — safe to re-run at any time. Skips whatever is already healthy,
# so it doubles as "start the stack" and "put the stack back after my machine
# or container restarted".
#
#   ./scripts/dev-up.sh            start everything
#   ./scripts/dev-up.sh --reset    drop and recreate the database first
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${SHOPCORE_LOG_DIR:-${TMPDIR:-/tmp}/shopcore-dev}"
DB_NAME="shopcore_v2"
DB_USER="shopcore"
DB_PASS="shopcore_dev_pw"
RESET=0

[[ "${1:-}" == "--reset" ]] && RESET=1
mkdir -p "$LOG_DIR"

say() { printf '\033[1;36m==>\033[0m %s\n' "$1"; }
ok()  { printf '\033[1;32m  ok\033[0m %s\n' "$1"; }
die() { printf '\033[1;31m  !!\033[0m %s\n' "$1" >&2; exit 1; }

wait_for() { # wait_for <seconds> <description> <command...>
  local timeout=$1 what=$2; shift 2
  local waited=0
  until "$@" >/dev/null 2>&1; do
    sleep 1
    waited=$((waited + 1))
    # Written as a full `if` on purpose. As `[[ ... ]] && die`, the normal
    # not-yet-timed-out path makes this the last command in the loop body and
    # returns non-zero, which `set -e` treats as a failure and kills the
    # script — so the very first start of a service always aborted.
    if [[ $waited -ge $timeout ]]; then
      die "timed out after ${timeout}s waiting for $what"
    fi
  done
}

# ---------------------------------------------------------------- MySQL ----
say "MySQL"
if ! mysqladmin ping --silent >/dev/null 2>&1; then
  command -v mysqld >/dev/null 2>&1 || die "mysqld not installed (apt-get install mysql-server)"
  mkdir -p /var/run/mysqld /var/log/mysql
  chown -R mysql:mysql /var/run/mysqld /var/log/mysql /var/lib/mysql 2>/dev/null || true
  # setsid detaches from this shell's process group so the server outlives it.
  setsid nohup mysqld --user=mysql --daemonize >"$LOG_DIR/mysqld.log" 2>&1 </dev/null || true
  wait_for 90 "mysqld" mysqladmin ping --silent
fi
ok "running ($(mysql -uroot -sN -e 'SELECT VERSION()' 2>/dev/null || echo 'version unknown'))"

# ------------------------------------------------------------- Database ----
say "Database"
if [[ $RESET -eq 1 ]]; then
  mysql -uroot -e "DROP DATABASE IF EXISTS ${DB_NAME}"
  ok "dropped ${DB_NAME}"
fi

# The app user exists because Ubuntu's root uses auth_socket and cannot
# connect over TCP, which is how Prisma connects. See docs/LOCAL-DEV.md.
mysql -uroot <<SQL
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS ${DB_NAME}_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'%';
GRANT ALL PRIVILEGES ON ${DB_NAME}_shadow.* TO '${DB_USER}'@'%';
GRANT CREATE, DROP, ALTER, REFERENCES ON *.* TO '${DB_USER}'@'%';
FLUSH PRIVILEGES;
SQL
ok "${DB_NAME} ready"

# -------------------------------------------------------------- Backend ----
say "Backend"
cd "$ROOT/backend"
[[ -d node_modules ]] || { npm install --silent; ok "installed dependencies"; }

if [[ ! -f .env ]]; then
  cp .env.example .env
  # Secrets are generated per machine; committing them would defeat the point.
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"mysql://${DB_USER}:${DB_PASS}@127.0.0.1:3306/${DB_NAME}\"|" .env
  sed -i "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=\"$(openssl rand -hex 32)\"|" .env
  sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=\"$(openssl rand -hex 32)\"|" .env
  sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=\"$(openssl rand -hex 32)\"|" .env
  sed -i "s|^BLIND_INDEX_KEY=.*|BLIND_INDEX_KEY=\"$(openssl rand -hex 32)\"|" .env
  sed -i "s|^RESEND_API_KEY=.*|RESEND_API_KEY=\"\"|" .env
  ok "generated .env with fresh keys"
else
  # Repair, don't just create. A .env written before a secret was introduced
  # is the worst failure mode this project has: the server exits at boot with
  # a message only visible in its own log, so the API never answers and every
  # request — login included — fails with nothing to go on. Backfilling the
  # missing keys here means pulling new work never leaves a dead backend.
  #
  # Only ever fills in a key that is absent or blank. It must never replace a
  # key that already holds a value, even a malformed one: ENCRYPTION_KEY is
  # what every encrypted column was written with, so overwriting it silently
  # turns readable data into ciphertext nobody can open. A key that is present
  # but wrong is reported by `npm run doctor` for a human to judge, not
  # rewritten here.
  added=()
  for key in JWT_ACCESS_SECRET JWT_REFRESH_SECRET ENCRYPTION_KEY BLIND_INDEX_KEY; do
    current=$(sed -nE "s/^\s*${key}\s*=\s*\"?([^\"]*)\"?\s*$/\1/p" .env | head -1)
    if [[ -z "$current" ]]; then
      sed -i "/^\s*${key}\s*=/d" .env   # drop a blank/placeholder line
      printf '%s="%s"\n' "$key" "$(openssl rand -hex 32)" >> .env
      added+=("$key")
    fi
  done
  if [[ ${#added[@]} -gt 0 ]]; then
    ok "added missing secrets to existing .env: ${added[*]}"
  fi
fi

npx prisma generate >/dev/null 2>&1
npx prisma migrate deploy 2>&1 | grep -qE "already in sync|successfully applied|No pending" \
  && ok "migrations applied" || die "prisma migrate deploy failed"

# Seed is idempotent (upserts), so this is safe on every boot.
npx prisma db seed >/dev/null 2>&1 && ok "seeded reference data"

if ! curl -sf http://127.0.0.1:4000/api/health >/dev/null 2>&1; then
  setsid nohup npm run dev >"$LOG_DIR/backend.log" 2>&1 </dev/null &
  wait_for 120 "backend" curl -sf http://127.0.0.1:4000/api/health
fi
ok "http://127.0.0.1:4000  (docs at /api/docs)"

# ------------------------------------------------------------- Frontend ----
say "Frontend"
cd "$ROOT/frontend"
[[ -d node_modules ]] || { npm install --silent; ok "installed dependencies"; }

if [[ ! -f .env ]]; then
  printf 'VITE_ENCRYPTION_KEY="local-dev-encryption-key-not-for-production"\n' > .env
  ok "generated .env"
fi

if ! curl -sf http://127.0.0.1:5173/ >/dev/null 2>&1; then
  setsid nohup npm run dev >"$LOG_DIR/frontend.log" 2>&1 </dev/null &
  wait_for 180 "frontend" curl -sf http://127.0.0.1:5173/
fi
ok "http://127.0.0.1:5173"

echo
say "Stack is up. Logs in $LOG_DIR"
