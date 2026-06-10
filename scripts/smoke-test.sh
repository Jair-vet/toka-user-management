#!/usr/bin/env bash
# Toka System Smoke Test
# Usage: bash scripts/smoke-test.sh [BASE_URL]
# Requires: curl, jq

set -euo pipefail

BASE_URL="${1:-http://localhost}"
AUTH_URL="${AUTH_URL:-http://localhost:3001}"
USER_URL="${USER_URL:-http://localhost:3002}"
ROLE_URL="${ROLE_URL:-http://localhost:3003}"
AUDIT_URL="${AUDIT_URL:-http://localhost:3004}"
AI_URL="${AI_URL:-http://localhost:8000}"
BFF_URL="${BFF_URL:-http://localhost:3005}"

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@toka.com}"
ADMIN_PASS="${ADMIN_PASS:-Admin123!}"

PASS=0
FAIL=0
ERRORS=()

# ── Helpers ─────────────────────────────────────────────────────────────────

green() { echo -e "\033[0;32m✓ $1\033[0m"; }
red()   { echo -e "\033[0;31m✗ $1\033[0m"; }
blue()  { echo -e "\033[0;34m→ $1\033[0m"; }

assert_status() {
  local description="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    green "$description"
    PASS=$((PASS+1))
  else
    red "$description (expected $expected, got $actual)"
    FAIL=$((FAIL+1))
    ERRORS+=("$description")
  fi
}

assert_json_key() {
  local description="$1" body="$2" key="$3"
  local val
  val=$(echo "$body" | jq -r ".$key" 2>/dev/null || echo "")
  if [[ -n "$val" && "$val" != "null" ]]; then
    green "$description ($key=$val)"
    PASS=$((PASS+1))
  else
    red "$description (missing key: $key)"
    FAIL=$((FAIL+1))
    ERRORS+=("$description")
  fi
}

# ── Tests ────────────────────────────────────────────────────────────────────

echo ""
blue "=== TOKA SMOKE TEST ==="
echo ""

# 1. Service Health Checks
blue "[1] Service health checks"
for svc in \
  "Auth Service:$AUTH_URL/auth/health" \
  "User Service:$USER_URL/users/health" \
  "Role Service:$ROLE_URL/roles/health" \
  "Audit Service:$AUDIT_URL/audit/health" \
  "AI Agent:$AI_URL/health" \
  "BFF Service:$BFF_URL/health"; do
  name="${svc%%:*}"
  url="${svc#*:}"
  status=$(curl -sf -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  assert_status "$name health" "200" "$status"
done

echo ""

# 2. Auth — Login
blue "[2] Auth: Login"
LOGIN_RESP=$(curl -sf -X POST "$AUTH_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" \
  2>/dev/null || echo "{}")
LOGIN_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "$AUTH_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" 2>/dev/null || echo "000")
assert_status "POST /auth/login" "200" "$LOGIN_STATUS"
assert_json_key "Login returns accessToken" "$LOGIN_RESP" "accessToken"

ACCESS_TOKEN=$(echo "$LOGIN_RESP" | jq -r '.accessToken' 2>/dev/null || echo "")
REFRESH_TOKEN=$(echo "$LOGIN_RESP" | jq -r '.refreshToken' 2>/dev/null || echo "")
AUTH_HEADER="Authorization: Bearer $ACCESS_TOKEN"

echo ""

# 3. Users CRUD
blue "[3] User Service CRUD"

# Create user
NEW_USER_EMAIL="smoke-$(date +%s)@test.com"
CREATE_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "$USER_URL/users" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d "{\"email\":\"$NEW_USER_EMAIL\",\"firstName\":\"Smoke\",\"lastName\":\"Test\"}" \
  2>/dev/null || echo "000")
assert_status "POST /users (create)" "201" "$CREATE_STATUS"

CREATE_RESP=$(curl -sf -X POST "$USER_URL/users" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d "{\"email\":\"smoke2-$(date +%s)@test.com\",\"firstName\":\"Smoke2\",\"lastName\":\"Test\"}" \
  2>/dev/null || echo "{}")
USER_ID=$(echo "$CREATE_RESP" | jq -r '.id' 2>/dev/null || echo "")

# Get by ID
if [[ -n "$USER_ID" && "$USER_ID" != "null" ]]; then
  GET_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$USER_URL/users/$USER_ID" \
    -H "$AUTH_HEADER" 2>/dev/null || echo "000")
  assert_status "GET /users/:id" "200" "$GET_STATUS"

  # Update
  UPDATE_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -X PATCH "$USER_URL/users/$USER_ID" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d '{"firstName":"Updated"}' 2>/dev/null || echo "000")
  assert_status "PATCH /users/:id" "200" "$UPDATE_STATUS"

  # Delete
  DELETE_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -X DELETE "$USER_URL/users/$USER_ID" \
    -H "$AUTH_HEADER" 2>/dev/null || echo "000")
  assert_status "DELETE /users/:id" "204" "$DELETE_STATUS"
else
  red "Skipping user CRUD - could not create user"
  FAIL=$((FAIL+3))
fi

echo ""

# 4. Roles
blue "[4] Role Service"

ROLES_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$ROLE_URL/roles" \
  -H "$AUTH_HEADER" 2>/dev/null || echo "000")
assert_status "GET /roles" "200" "$ROLES_STATUS"

ROLE_COUNT=$(curl -sf "$ROLE_URL/roles" -H "$AUTH_HEADER" 2>/dev/null | jq 'length' 2>/dev/null || echo "0")
if [[ "$ROLE_COUNT" -ge 4 ]]; then
  green "Seed roles present (count=$ROLE_COUNT)"
  PASS=$((PASS+1))
else
  red "Expected >= 4 seed roles, got $ROLE_COUNT"
  FAIL=$((FAIL+1))
fi

echo ""

# 5. Audit
blue "[5] Audit Service"
AUDIT_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$AUDIT_URL/audit/events" \
  -H "$AUTH_HEADER" 2>/dev/null || echo "000")
assert_status "GET /audit/events" "200" "$AUDIT_STATUS"

echo ""

# 6. AI Agent
blue "[6] AI Agent Service"

# Ingest a document
INGEST_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "$AI_URL/ai/documents/ingest" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"content":"Toka is a user management platform with RBAC.","source_type":"smoke_test","source_id":"smoke-1"}' \
  2>/dev/null || echo "000")
assert_status "POST /ai/documents/ingest" "200" "$INGEST_STATUS"

# Chat
CHAT_RESP=$(curl -sf -X POST "$AI_URL/ai/chat" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"message":"What is Toka?"}' 2>/dev/null || echo "{}")
assert_json_key "POST /ai/chat returns answer" "$CHAT_RESP" "answer"
assert_json_key "POST /ai/chat returns session_id" "$CHAT_RESP" "session_id"

echo ""

# 7. Auth Logout
blue "[7] Auth: Logout"
LOGOUT_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "$AUTH_URL/auth/logout" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}" 2>/dev/null || echo "000")
assert_status "POST /auth/logout" "204" "$LOGOUT_STATUS"

echo ""

# ── Results ──────────────────────────────────────────────────────────────────
echo "══════════════════════════════════════"
echo "Results: ${PASS} passed, ${FAIL} failed"
if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "Failed checks:"
  for err in "${ERRORS[@]}"; do
    echo "  - $err"
  done
  echo ""
  exit 1
else
  echo ""
  green "All smoke tests passed!"
  echo ""
  exit 0
fi
