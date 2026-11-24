import cluster from 'node:cluster';
import os from 'node:os';

// one worker per core (capped at 4 by default), override with WEB_CONCURRENCY
const cores = os.availableParallelism ? os.availableParallelism() : os.cpus().length;
const WORKERS = Number(process.env.WEB_CONCURRENCY) || Math.max(1, Math.min(cores, 4));

if (cluster.isPrimary) {
  console.log(`[cluster] primary ${process.pid} starting ${WORKERS} worker(s)`);

  let shuttingDown = false;
  let rapidDeaths = 0;

  const spawn = () => {
    const w = cluster.fork();
    w.startedAt = Date.now();
  };
  for (let i = 0; i < WORKERS; i++) spawn();

  cluster.on('exit', (worker, code, signal) => {
    if (shuttingDown) {
      if (Object.keys(cluster.workers).length === 0) process.exit(0);
      return;
    }
    console.error(`[cluster] worker ${worker.process.pid} exited (${signal || code}), restarting`);

    // a crash loop (bad config, DB down) should fail the container instead of spinning forever
    rapidDeaths = Date.now() - worker.startedAt < 10000 ? rapidDeaths + 1 : 0;
    if (rapidDeaths >= 5) {
      console.error('[cluster] workers keep crashing on startup, giving up');
      process.exit(1);
    }
    setTimeout(spawn, 1000);
  });

  const stop = (sig) => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const w of Object.values(cluster.workers)) w.process.kill(sig);
    setTimeout(() => process.exit(0), 12000).unref();
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
} else {
  await import('./server.js');
}