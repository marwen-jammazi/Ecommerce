module.exports = {
  apps: [
    {
      name: 'ecommerce-api',
      script: 'src/cluster.js', // Node cluster handles the CPU cores, PM2 handles restarts, logs and boot
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '600M',
      kill_timeout: 15000,
      env: { NODE_ENV: 'production' },
    },
  ],
};