import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';
export const metrics = new Registry();
collectDefaultMetrics({ register: metrics });
export const apiDuration = new Histogram({
  name: 'crm_api_seconds',
  help: 'API latency including authorization',
  labelNames: ['method', 'route', 'status'],
  registers: [metrics],
  buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});
export const sqlDuration = new Histogram({
  name: 'crm_sql_seconds',
  help: 'SQL execution latency without statements or parameter labels',
  registers: [metrics],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});
export const queueLength = new Gauge({
  name: 'crm_queue_jobs',
  help: 'Redis queue size',
  labelNames: ['queue', 'state'],
  registers: [metrics],
});
export const jobDuration = new Histogram({
  name: 'crm_job_seconds',
  help: 'Job execution latency',
  labelNames: ['kind', 'result'],
  registers: [metrics],
  buckets: [0.1, 1, 5, 15, 30, 60, 120, 300, 600],
});
export const jobWait = new Histogram({
  name: 'crm_job_wait_seconds',
  help: 'Job waiting before an attempt',
  labelNames: ['kind'],
  registers: [metrics],
  buckets: [1, 5, 15, 30, 60, 300, 600],
});
export const retries = new Counter({
  name: 'crm_job_retries_total',
  help: 'Repeated job attempts',
  labelNames: ['kind'],
  registers: [metrics],
});
export const errors = new Counter({
  name: 'crm_job_errors_total',
  help: 'Job failures by safe code',
  labelNames: ['kind', 'code'],
  registers: [metrics],
});
export const cleaned = new Counter({
  name: 'crm_files_cleaned_total',
  help: 'Expired file deletion',
  labelNames: ['kind'],
  registers: [metrics],
});

export const syncRunsCleaned = new Counter({
  name: 'crm_sync_runs_cleaned_total',
  help: 'Expired terminal synchronization audit records deleted',
  registers: [metrics],
});
