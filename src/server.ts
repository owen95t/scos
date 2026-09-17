import { createApp } from "./app.ts";
import { getEnv } from "./config/env.ts";

let env;
try {
  env = getEnv();
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}

const { app } = await createApp();

await app.listen({ port: env.PORT, host: "0.0.0.0" });
