#!/usr/bin/env bash
# Probe Supabase project capabilities with the service key.
# Answers: reachable? components/packs tables exist? storage buckets? can we run DDL anywhere?
# Values come from environment variables (never commit real keys):
#   SUPABASE_URL                 e.g. https://<project-ref>.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY    the service_role key (sb_secret_... or legacy JWT)
set -u

URL="${SUPABASE_URL:?Set SUPABASE_URL=https://<project-ref>.supabase.co}"
SERVICE_JWT="${SUPABASE_SERVICE_ROLE_KEY:?Set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>}"

hr() { echo; echo "===== $1 ====="; }

hr "1. REST root reachability (service key)"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$URL/rest/v1/" \
  -H "apikey: $SERVICE_JWT" -H "Authorization: Bearer $SERVICE_JWT")
echo "GET /rest/v1/ -> HTTP $code"

hr "2. components table"
curl -s --max-time 15 "$URL/rest/v1/components?select=id,name,category&limit=5" \
  -H "apikey: $SERVICE_JWT" -H "Authorization: Bearer $SERVICE_JWT" | head -c 500
echo

hr "3. packs / pack_components / installs tables"
for t in packs pack_components installs; do
  echo "-- $t --"
  curl -s --max-time 15 "$URL/rest/v1/$t?select=*&limit=2" \
    -H "apikey: $SERVICE_JWT" -H "Authorization: Bearer $SERVICE_JWT" | head -c 300
  echo
done

hr "4. Storage buckets (service key)"
curl -s --max-time 15 "$URL/storage/v1/bucket" \
  -H "apikey: $SERVICE_JWT" -H "Authorization: Bearer $SERVICE_JWT" | head -c 500
echo

hr "5. Management API SQL (long shot: needs sbp_ personal token, trying service key)"
REF="${URL#https://}"; REF="${REF%%.*}"
curl -s --max-time 15 -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $SERVICE_JWT" -H "Content-Type: application/json" \
  -d '{"query":"select 1 as ok"}' | head -c 400
echo

hr "6. exec_sql RPC existence (long shot)"
curl -s --max-time 15 -X POST "$URL/rest/v1/rpc/exec_sql" \
  -H "apikey: $SERVICE_JWT" -H "Authorization: Bearer $SERVICE_JWT" \
  -H "Content-Type: application/json" -d '{"query":"select 1"}' | head -c 300
echo

hr "DONE"
