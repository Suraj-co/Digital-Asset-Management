import { Redis } from 'ioredis';

export type RedisCheck = {
  status: 'up' | 'down' | 'not_configured';
  latencyMs: number | null;
};

export async function checkRedis(url: string | null): Promise<RedisCheck> {
  if (!url) {
    return { status: 'not_configured', latencyMs: null };
  }
  if (!/^rediss?:\/\//.test(url)) {
    return { status: 'down', latencyMs: null };
  }
  const started = performance.now();
  const client = new Redis(url, {
    connectTimeout: 1000,
    commandTimeout: 1000,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
  });
  try {
    await client.connect();
    const pong = await client.ping();
    return {
      status: pong === 'PONG' ? 'up' : 'down',
      latencyMs: Math.round(performance.now() - started),
    };
  } catch {
    return { status: 'down', latencyMs: null };
  } finally {
    client.disconnect();
  }
}
