-- Find replication slots that need investigation.
SELECT slot_name,
       active,
       pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) AS retained_bytes
FROM pg_replication_slots
WHERE slot_type = 'logical'
  AND restart_lsn IS NOT NULL
ORDER BY retained_bytes DESC;
