#!/usr/bin/env sh
set -eu

APP_DIR="${CAP_APP_DIR:-/opt/cap/app}"
cd "$APP_DIR"

if [ ! -f .env ]; then
	exit 0
fi

set -a
. ./.env
set +a

if [ -z "${TRANSCRIPT_SYNC_ORG_ID:-}" ] || [ -z "${TRANSCRIPT_SYNC_CRON_SECRET:-}" ] || [ -z "${DEEPGRAM_API_KEY:-}" ]; then
	exit 0
fi

BASE_URL="${CAP_URL:-}"
if [ -z "$BASE_URL" ]; then
	BASE_URL="${WEB_URL:-}"
fi

if [ -z "$BASE_URL" ]; then
	exit 0
fi

curl -fsS -X POST "$BASE_URL/api/cron/transcript-sync" \
	-H "Authorization: Bearer $TRANSCRIPT_SYNC_CRON_SECRET" \
	>/dev/null
