import express, { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

if (process.argv.includes("--stdio")) {
  await createServer().connect(new StdioServerTransport());
} else {
  const app = express();
  app.use(express.json());
  app.get("/health", (_req, res) => { res.json({ status: "ok" }); });
  app.post("/mcp", async (req: Request, res: Response) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
  const port = parseInt(process.env.PORT || "8080");
  const http = app.listen(port, () => console.log(`MCP server on http://localhost:${port}/mcp`));
  process.on("SIGTERM", () => http.close(() => process.exit(0)));
}
