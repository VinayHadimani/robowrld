#!/usr/bin/env bash
# Initialize remote Supabase resources we CAN create with the service key:
# - 'models' storage bucket (idempotent)
# - CORS probe on the public object URL (needed for browser-side useGLTF)
# - two long-shot DDL attempts (Management API with service JWT, pg-meta gateway)
# Values come from environment variables (never commit real keys):
#   SUPABASE_URL                 e.g. https://<project-ref>.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY    the service_role key
set -u

URL="${SUPABASE_URL:?Set SUPABASE_URL=https://<project-ref>.supabase.co}"
SERVICE_JWT="${SUPABASE_SERVICE_ROLE_KEY:?Set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>}"
AUTH=(-H "apikey: $SERVICE_JWT" -H "Authorization: Bearer $SERVICE_JWT")

echo "== long-shot A: Management API with service key =="
REF="${URL#https://}"; REF="${REF%%.*}"
curl -s --max-time 15 -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $SERVICE_JWT" -H "Content-Type: application/json" \
  -d '{"query":"select 1 as ok"}' | head -c 300; echo

echo "== long-shot B: pg-meta tables via project gateway =="
curl -s --max-time 15 "$URL/pg/meta/tables" "${AUTH[@]}" | head -c 300; echo

echo "== create 'models' bucket (idempotent) =="
if curl -s --max-time 15 "$URL/storage/v1/bucket" "${AUTH[@]}" | tr -d ' ' | grep -q '"name":"models"'; then
  echo "bucket 'models' already exists"
else
  echo "trying POST /storage/v1/bucket (singular route)..."
  curl -s --max-time 15 -X POST "$URL/storage/v1/bucket" "${AUTH[@]}" \
    -H "Content-Type: application/json" \
    -d '{"name":"models","public":true,"file_size_limit":52428800}' | head -c 300; echo
fi

echo "== bucket list now =="
curl -s --max-time 15 "$URL/storage/v1/bucket" "${AUTH[@]}" | head -c 600; echo

echo "== upload probe object =="
curl -s --max-time 15 -X POST "$URL/storage/v1/object/models/_probe.txt" "${AUTH[@]}" \
  -H "Content-Type: text/plain" --data-binary 'supabase-probe-ok' | head -c 300; echo

echo "== public URL fetch + CORS headers (Origin: localhost:3000) =="
curl -s -D - -o /dev/null --max-time 15 -H "Origin: http://localhost:3000" \
  "$URL/storage/v1/object/public/models/_probe.txt" | grep -iE "^HTTP|access-control|content-type|cache-control"; echo

echo "== cleanup probe object =="
curl -s --max-time 15 -X DELETE "$URL/storage/v1/object/models/_probe.txt" "${AUTH[@]}" | head -c 200; echo

echo "== DONE =="
