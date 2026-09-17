import { createApp } from "./app.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

const { app } = await createApp();

await app.listen({ port: PORT, host: "0.0.0.0" });
