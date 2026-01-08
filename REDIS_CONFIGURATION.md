# Redis Configuration Guide

## Eviction Policy Configuration

For BullMQ to work properly with job queues, Redis must be configured with the **`noeviction`** policy. This ensures that Redis will not evict keys when memory limit is reached, preventing job data loss.

### Setting the Eviction Policy

#### Option 1: Redis Configuration File (redis.conf)
Add or modify the following line in your `redis.conf` file:
```conf
maxmemory-policy noeviction
```

#### Option 2: Redis CLI Command
Connect to your Redis instance and run:
```bash
redis-cli CONFIG SET maxmemory-policy noeviction
```

To make it persistent across restarts:
```bash
redis-cli CONFIG SET maxmemory-policy noeviction
redis-cli CONFIG REWRITE
```

#### Option 3: Redis Cloud/Managed Service
If using a managed Redis service (like Redis Labs/Cloud):
1. Go to your database configuration in the web console
2. Find the "Advanced Settings" or "Configuration" section
3. Set `maxmemory-policy` to `noeviction`
4. Save and apply changes

### Verify Current Policy
Check your current Redis eviction policy:
```bash
redis-cli CONFIG GET maxmemory-policy
```

Expected output:
```
1) "maxmemory-policy"
2) "noeviction"
```

### Why noeviction?

- **`volatile-lru`** (default in some Redis versions): Evicts keys with TTL set, which could delete job data
- **`noeviction`**: Returns errors when memory limit is reached instead of evicting keys, protecting job queue data

For production BullMQ deployments, `noeviction` is **required** to prevent job loss.

## Connection Configuration

The application connects to Redis using these environment variables:

```env
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=your-password
```

The connection is configured in `src/app.module.ts` with BullMQ-optimized settings:
- `maxRetriesPerRequest: null` - Prevents timeout issues with long-running jobs
- `enableReadyCheck: false` - Improves connection startup time
- `prefix: 'payslip-mailer'` - Namespaces all queue keys

## Queue Configuration

### Registered Queues
- **Employee Queue** (`employeeQueue`): Handles bulk employee uploads
- **Payslip Queue** (`payslipQueue`): Handles bulk payslip processing

Each queue is registered in its respective module with proper consumers.
