import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import { createClient, type RedisClientType } from "redis";
import type { InfrastructureConfig } from "./config";

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private client?: RedisClientType;

  constructor(private readonly config: InfrastructureConfig) {}

  get configured() {
    return Boolean(this.config.redisUrl);
  }

  get ready() {
    return Boolean(this.client?.isReady);
  }

  async onModuleInit() {
    if (!this.config.redisUrl) {
      if (this.config.requireExternal) throw new Error("REDIS_URL est requis.");
      this.logger.warn("Redis non configuré; les limites historiques restent locales au processus.");
      return;
    }

    this.client = createClient({
      url: this.config.redisUrl,
      socket: { connectTimeout: 5000, reconnectStrategy: (retries) => Math.min(250 * retries, 3000) },
    });
    this.client.on("error", (error) => this.logger.error(`Redis: ${error.message}`));
    try {
      await this.client.connect();
      await this.client.ping();
    } catch (error) {
      this.client.destroy();
      this.client = undefined;
      throw error;
    }
    this.logger.log("Redis connected.");
  }

  async onApplicationShutdown() {
    if (this.client?.isOpen) await this.client.quit();
  }

  async ping() {
    if (!this.client?.isReady) return false;
    return (await this.client.ping()) === "PONG";
  }

  async get(key: string) {
    if (!this.client?.isReady) return null;
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number) {
    if (!this.client?.isReady) return false;
    await this.client.set(key, value, { EX: ttlSeconds });
    return true;
  }

  async delete(key: string) {
    if (!this.client?.isReady) return false;
    await this.client.del(key);
    return true;
  }

  /** Atomic shared fixed-window counter for route throttles and OTP budgets. */
  async incrementWindow(key: string, ttlSeconds: number) {
    if (!this.client?.isReady) return null;
    const result = await this.client.eval(
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return n",
      { keys: [key], arguments: [String(ttlSeconds)] },
    );
    return Number(result);
  }
}
