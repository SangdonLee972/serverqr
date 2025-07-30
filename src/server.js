// src/server.js
const cluster = require('cluster');
const os = require('os');

if (cluster.isMaster) {
  const workers = parseInt(process.env.WORKER_COUNT, 10) || os.cpus().length;
  console.log(`Master ${process.pid} running, forking ${workers} workers`);
  for (let i = 0; i < workers; i++) cluster.fork();
  cluster.on('exit', worker => {
    console.warn(`Worker ${worker.process.pid} died — respawning`);
    cluster.fork();
  });
} else {
  require('./app').start();
}
