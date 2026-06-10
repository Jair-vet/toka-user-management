# Exercise 4 — Incident Diagnosis: Production System Performance Degradation

## Scenario

A production microservices system (similar to Toka's architecture) experiences sudden latency spikes and partial service unavailability at 14:23 UTC. Users report 504 Gateway Timeout errors on the User Management dashboard. The on-call engineer is paged.

---

## Phase 1: Triage — First 5 Minutes

### 1.1 Immediate Observability Check

```bash
# Check overall system health via Traefik metrics
curl http://traefik:8090/metrics | grep -E 'requests_total|duration'

# Check all service health endpoints in parallel
for svc in auth-service:3001 user-service:3002 role-service:3003 audit-service:3004 bff-service:3005 ai-agent-service:8000; do
  echo -n "$svc: " && curl -sf "http://$svc/health" | jq '.status' || echo "UNHEALTHY"
done

# Check container status
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}"

# Check recent logs for ERROR/WARN across all services
docker compose logs --since 10m --tail 100 | grep -E 'ERROR|WARN|exception|timeout'
```

### 1.2 Narrow Down the Fault Domain

**Observation from logs:**

```
[bff-service] WARN Circuit breaker OPEN for service: user
[bff-service] ERROR ServiceUnavailableException: Service user is temporarily unavailable
[user-service] ERROR Unable to acquire connection from pool: timeout after 10000ms
```

**Conclusion**: BFF circuit breaker opened on `user-service`. Root cause is downstream — user-service cannot acquire DB connections.

---

## Phase 2: Root Cause Analysis

### 2.1 Database Connection Pool Exhaustion

**Symptom**: User service logs show `timeout acquiring pool connection`.

**Evidence**:

```bash
# Check PostgreSQL active connections
docker exec toka_postgres psql -U toka_user -d toka_main -c \
  "SELECT count(*), state, wait_event_type, wait_event
   FROM pg_stat_activity
   GROUP BY state, wait_event_type, wait_event
   ORDER BY count DESC;"
```

Result:
```
count | state  | wait_event_type | wait_event
------+--------+-----------------+-----------
 95   | active | Lock            | relation
  5   | idle   |                 |
```

95 of 100 max connections are active and waiting on a lock — classic connection pool exhaustion triggered by lock contention.

### 2.2 Identify the Lock Holder

```sql
-- Find blocking queries
SELECT pid, age(clock_timestamp(), query_start) AS age, usename, query, state
FROM pg_stat_activity
WHERE state != 'idle'
  AND query NOT ILIKE '%pg_stat_activity%'
ORDER BY age DESC
LIMIT 10;
```

**Finding**: A long-running `UPDATE users SET ... WHERE id = $1` transaction started 23 minutes ago at 14:00 UTC — right before the alerts fired. It holds a row-level lock on a high-traffic user record and was never committed or rolled back.

### 2.3 Timeline Correlation

```
13:58 UTC — Deploy: user-service v2.3.1 released (added bulk-update endpoint)
14:00 UTC — First slow UPDATE query started (from the new bulk endpoint)
14:18 UTC — TypeORM pool reaches 80% utilization
14:23 UTC — Pool exhausted, circuit breaker trips, 504s start
14:25 UTC — On-call paged
```

**Root Cause**: The new `/users/bulk-update` endpoint in v2.3.1 opened a TypeORM transaction but had a missing `await` on the commit call (`await queryRunner.commitTransaction()`), leaving transactions open until TCP timeout (~30 min). Under load, this drained the connection pool.

---

## Phase 3: Remediation

### 3.1 Immediate Mitigation (< 2 minutes)

```bash
# 1. Terminate the blocking query to release locks
docker exec toka_postgres psql -U toka_user -d toka_main -c \
  "SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'active'
     AND age(clock_timestamp(), query_start) > interval '10 minutes';"

# 2. Restart user-service to flush connection pool
docker compose restart user-service

# 3. Verify circuit breaker resets (30s timeout)
sleep 35
curl -sf http://localhost:3005/health | jq .
```

### 3.2 Deploy Fix

```typescript
// BEFORE (broken — missing await on commit)
async bulkUpdate(updates: UpdateUserDto[]) {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    for (const update of updates) {
      await queryRunner.manager.update(UserOrmEntity, update.id, update);
    }
    queryRunner.commitTransaction(); // ← BUG: missing await
  } catch (e) {
    await queryRunner.rollbackTransaction();
    throw e;
  } finally {
    await queryRunner.release();
  }
}

// AFTER (fixed)
async bulkUpdate(updates: UpdateUserDto[]) {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    for (const update of updates) {
      await queryRunner.manager.update(UserOrmEntity, update.id, update);
    }
    await queryRunner.commitTransaction(); // ← FIXED
  } catch (e) {
    await queryRunner.rollbackTransaction();
    throw e;
  } finally {
    await queryRunner.release();
  }
}
```

### 3.3 Rollback Strategy (if fix unavailable)

```bash
# Rollback to last known good image
docker compose up -d --no-deps \
  --image ghcr.io/toka/user-service:v2.3.0 user-service
```

---

## Phase 4: Verification

```bash
# Confirm pool is healthy
docker exec toka_postgres psql -U toka_user -d toka_main -c \
  "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
# Expected: < 10

# Confirm circuit breaker closed
curl -sf http://localhost:3005/health | jq .
# Expected: {"status":"ok",...}

# Run smoke test
bash scripts/smoke-test.sh
# Expected: all GREEN
```

---

## Phase 5: Post-Mortem & Prevention

### What Went Wrong

| Factor | Detail |
|--------|--------|
| **Code bug** | Missing `await` on `queryRunner.commitTransaction()` — TypeScript/Node silently ignores unawaited promises |
| **Missing test** | No integration test exercised the bulk-update transaction path end-to-end |
| **Observability gap** | No alert on `pg_stat_activity` long-running transactions (> 5 min) |
| **Deploy gap** | No canary / gradual rollout — 100% traffic hit the broken endpoint immediately |

### Prevention Actions

1. **Code**: Add ESLint rule `@typescript-eslint/no-floating-promises` (strict mode) to catch unawaited promises at compile time.

2. **Tests**: Add integration test for every TypeORM transaction path:
   ```typescript
   it('bulk update commits and releases connections', async () => {
     const before = await getActiveConnections();
     await service.bulkUpdate([{ id: 'u1', firstName: 'Test' }]);
     const after = await getActiveConnections();
     expect(after).toBeLessThanOrEqual(before); // no leaked connections
   });
   ```

3. **Alerting**: Add Postgres monitoring alert:
   ```yaml
   # Prometheus alert rule
   - alert: PostgresLongRunningTransaction
     expr: pg_stat_activity_max_tx_duration{datname="toka_main"} > 300
     for: 1m
     labels:
       severity: warning
     annotations:
       summary: "Transaction running > 5 min on {{ $labels.datname }}"
   ```

4. **Connection pool**: Configure TypeORM with a hard statement timeout:
   ```typescript
   extra: {
     statement_timeout: 30000,       // 30s max query time
     idle_in_transaction_session_timeout: 60000, // 1min max idle tx
   }
   ```

5. **Deployment**: Implement canary deployments (10% → 50% → 100% with automatic rollback on error rate > 1%).

6. **Runbook**: Document this incident pattern in `docs/runbooks/db-connection-exhaustion.md` for future on-call engineers.

---

## Summary

| | Detail |
|--|--------|
| **Incident duration** | 14:23–14:38 UTC (15 minutes) |
| **User impact** | 504 errors on User Management dashboard |
| **Root cause** | Missing `await` on TypeORM `commitTransaction()` → connection pool exhaustion |
| **Deploy correlation** | 23 min after v2.3.1 deploy |
| **MTTR** | ~15 minutes (terminate + restart) |
| **Permanent fix** | `await` added, ESLint rule, integration test, connection timeout config |
