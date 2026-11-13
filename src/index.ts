import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./server.js";

const server = createServer();
await serveStdio(() => server);
