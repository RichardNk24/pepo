export type InfrastructureConfig = {
  postgresUrl?: string;
  redisUrl?: string;
  requireExternal: boolean;
};

export function readInfrastructureConfig(
  env: NodeJS.ProcessEnv = process.env,
): InfrastructureConfig {
  const requireExternal = env.REQUIRE_EXTERNAL_INFRA === "true";
  const postgresUrl = env.DATABASE_URL?.trim() || undefined;
  const redisUrl = env.REDIS_URL?.trim() || undefined;

  if (postgresUrl) assertUrl(postgresUrl, ["postgres:", "postgresql:"], "DATABASE_URL");
  if (redisUrl) assertUrl(redisUrl, ["redis:", "rediss:"], "REDIS_URL");
  if (requireExternal && (!postgresUrl || !redisUrl)) {
    throw new Error(
      "REQUIRE_EXTERNAL_INFRA=true nécessite DATABASE_URL et REDIS_URL.",
    );
  }

  return { postgresUrl, redisUrl, requireExternal };
}

function assertUrl(value: string, protocols: string[], name: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} doit être une URL valide.`);
  }
  if (!protocols.includes(parsed.protocol) || !parsed.hostname) {
    throw new Error(`${name} doit utiliser ${protocols.join(" ou ")}.`);
  }
}
