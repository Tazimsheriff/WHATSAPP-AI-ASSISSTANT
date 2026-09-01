module.exports = {
  apps: [
    {
      name: 'whatsapp-ai-bot',
      script: 'npx',
      args: 'tsx src/index.ts',
      restart_delay: 5000,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
