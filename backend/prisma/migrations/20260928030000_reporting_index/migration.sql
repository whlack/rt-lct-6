-- The acceptance EXPLAIN showed a full scan of 200k events for the period semi-join.
-- Cover both the date predicate and project membership without fetching event payloads.
CREATE INDEX "project_events_created_at_project_id_idx" ON "project_events"("created_at", "project_id");
