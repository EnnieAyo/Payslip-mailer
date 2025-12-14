# PM2 Quick Reference

## Common Commands

```bash
# Start application
npm run pm2:start              # Development mode
npm run pm2:start:prod         # Production mode

# Control application
npm run pm2:stop               # Stop app
npm run pm2:restart            # Restart app
npm run pm2:delete             # Remove from PM2

# Monitoring
npm run pm2:status             # Check status
npm run pm2:logs               # View logs (Ctrl+C to exit)
npm run pm2:monit              # Real-time monitoring dashboard

# Production setup (one-time)
pm2 save                       # Save process list
pm2 startup                    # Generate startup script
```

## Status Overview

✅ **Application**: payslip-mailer-api  
✅ **Status**: Online  
✅ **Port**: 5000  
✅ **Logs**: `./logs/pm2-*.log`  

## Deployment Workflow

### Development
```bash
npm run build        # Build
npm run pm2:restart  # Restart with new code
```

### Production
```bash
git pull             # Get latest code
npm install          # Update dependencies
npm run build        # Build
pm2 reload payslip-mailer-api  # Zero-downtime reload
```

## Troubleshooting

### View errors
```bash
pm2 logs payslip-mailer-api --err --lines 50
```

### Restart if stuck
```bash
npm run pm2:delete
npm run pm2:start
```

### Check memory/CPU
```bash
npm run pm2:monit
```

### Flush old logs
```bash
pm2 flush
```

## Files

- **Config**: `ecosystem.config.js`
- **Logs**: `logs/pm2-*.log`
- **Guide**: `PM2_GUIDE.md`

## Current Status

```
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 0  │ payslip-mailer-api │ cluster  │ 0    │ online    │ 0%       │ 118mb    │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
```

Application is running on: http://localhost:5000
