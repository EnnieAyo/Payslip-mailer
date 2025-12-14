# PM2 Process Manager Setup

## Overview

The Payslip Mailer backend application is configured to run with PM2, a production-ready process manager for Node.js applications.

## Configuration

**File**: `ecosystem.config.js`

Key features:
- **Cluster mode** - Runs single instance (can be increased for load balancing)
- **Auto-restart** - Automatically restarts on crashes
- **Memory limit** - Restarts if memory exceeds 500MB
- **Log management** - Centralized logging in `./logs/` directory
- **Environment support** - Separate configs for development and production

## Installation

PM2 is already installed as a dev dependency. For global installation (optional):

```bash
npm install -g pm2
```

## Usage

### Development

```bash
# Build the application
npm run build

# Start with PM2 (development mode)
npm run pm2:start

# View logs
npm run pm2:logs

# Monitor application
npm run pm2:monit

# Check status
npm run pm2:status

# Restart application
npm run pm2:restart

# Stop application
npm run pm2:stop

# Remove from PM2
npm run pm2:delete
```

### Production

```bash
# Build for production
npm run build

# Start with PM2 (production mode)
npm run pm2:start:prod

# Save PM2 process list (survives reboots)
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run pm2:start` | Start app in development mode |
| `npm run pm2:start:prod` | Start app in production mode |
| `npm run pm2:stop` | Stop the application |
| `npm run pm2:restart` | Restart the application |
| `npm run pm2:delete` | Remove app from PM2 |
| `npm run pm2:logs` | View application logs |
| `npm run pm2:monit` | Real-time monitoring dashboard |
| `npm run pm2:status` | Check application status |

## Direct PM2 Commands

You can also use PM2 directly:

```bash
# Start
pm2 start ecosystem.config.js

# Start in production
pm2 start ecosystem.config.js --env production

# Restart
pm2 restart payslip-mailer-api

# Stop
pm2 stop payslip-mailer-api

# Delete
pm2 delete payslip-mailer-api

# View logs
pm2 logs payslip-mailer-api

# Flush logs
pm2 flush

# Monitor
pm2 monit

# List all processes
pm2 list
pm2 status

# Show detailed info
pm2 show payslip-mailer-api

# Zero-downtime reload (cluster mode)
pm2 reload payslip-mailer-api
```

## Log Files

Logs are stored in `./logs/` directory:
- `pm2-error.log` - Error logs
- `pm2-out.log` - Standard output logs
- `pm2-combined.log` - Combined logs

Add `logs/` to `.gitignore`:
```
logs/
```

## Cluster Mode

The application runs in cluster mode with 1 instance by default. To scale:

```javascript
// In ecosystem.config.js
instances: 4, // Run 4 instances
// or
instances: 'max', // Run instance per CPU core
```

Then restart:
```bash
pm2 reload payslip-mailer-api
```

## Environment Variables

The application uses environment variables from `.env` file. PM2 automatically loads them.

**Development**:
- `NODE_ENV=development`
- `PORT=5000`

**Production**:
- `NODE_ENV=production`
- `PORT=5000`

## Auto-Restart Configuration

PM2 will automatically restart the app if:
- It crashes or exits unexpectedly
- Memory usage exceeds 500MB
- More than 10 restarts in a short period (will stop to prevent crash loop)

Minimum uptime before considering stable: 10 seconds

## Process Monitoring

### Real-time Monitoring
```bash
npm run pm2:monit
```

Shows:
- CPU usage
- Memory usage
- Active instances
- Restart count
- Uptime

### Web Dashboard (Optional)

Install PM2 Plus for advanced monitoring:
```bash
pm2 plus
```

## Production Deployment Checklist

1. ✅ Build the application
   ```bash
   npm run build
   ```

2. ✅ Start with PM2 in production mode
   ```bash
   npm run pm2:start:prod
   ```

3. ✅ Verify it's running
   ```bash
   pm2 status
   ```

4. ✅ Save process list
   ```bash
   pm2 save
   ```

5. ✅ Setup startup script (run once per server)
   ```bash
   pm2 startup
   # Follow the instructions shown
   ```

6. ✅ Monitor logs
   ```bash
   pm2 logs payslip-mailer-api --lines 100
   ```

## Troubleshooting

### App won't start
```bash
# Check logs for errors
pm2 logs payslip-mailer-api --err

# Check if dist/ folder exists
ls dist/

# Rebuild
npm run build
```

### High memory usage
```bash
# Check memory
pm2 monit

# Reduce max_memory_restart in ecosystem.config.js
# or increase server RAM
```

### Need to update app
```bash
# 1. Stop app
npm run pm2:stop

# 2. Pull latest code / make changes
git pull

# 3. Rebuild
npm run build

# 4. Restart
npm run pm2:restart
```

### Zero-downtime deployment
```bash
# Build
npm run build

# Reload (0-downtime in cluster mode)
pm2 reload payslip-mailer-api
```

## Ecosystem Configuration

Current settings in `ecosystem.config.js`:

```javascript
{
  name: 'payslip-mailer-api',        // Process name
  script: './dist/main.js',          // Entry point
  instances: 1,                       // Number of instances
  exec_mode: 'cluster',              // Cluster mode
  watch: false,                       // Don't watch files
  max_memory_restart: '500M',        // Restart if > 500MB
  autorestart: true,                 // Auto-restart on crash
  max_restarts: 10,                  // Max restart attempts
  min_uptime: '10s',                 // Min uptime to consider stable
}
```

## Benefits of Using PM2

✅ **Auto-restart** - Never goes down permanently  
✅ **Load balancing** - Cluster mode for multi-core CPUs  
✅ **Zero-downtime** - Reload without stopping service  
✅ **Log management** - Centralized, timestamped logs  
✅ **Monitoring** - Real-time CPU/memory tracking  
✅ **Startup scripts** - Auto-start on server reboot  
✅ **Process management** - Easy start/stop/restart  

## Next Steps

1. Create `logs/` directory
2. Add `logs/` to `.gitignore`
3. Test PM2 startup: `npm run pm2:start`
4. Configure environment variables in `.env`
5. For production: Run `pm2 startup` and `pm2 save`
