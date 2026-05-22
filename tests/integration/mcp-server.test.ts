import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execa } from "execa";
import http from "http";

describe("MCP Server - HTTP/SSE Transport Authentication (TASK-5.2)", () => {
  let mcpProcess: any;
  const PORT = 3311;
  const API_KEY = "test-secret-key-123";
  const BASE_URL = `http://localhost:${PORT}`;

  beforeAll(async () => {
    // Start MCP server in a separate process with --sse flag and test environment variables
    mcpProcess = execa("node", ["packages/mcp-server/dist/index.js", "--sse"], {
      env: {
        ORCH_MCP_PORT: String(PORT),
        ORCH_MCP_API_KEY: API_KEY,
        NODE_ENV: "test",
      },
    });

    // Capture standard error / output to help debug if needed
    mcpProcess.stderr?.on("data", (data: Buffer) => {
      console.log(`[MCP Server stderr]: ${data.toString()}`);
    });

    // Wait 1.5s for server to start up and bind to the port
    await new Promise((resolve) => setTimeout(resolve, 1500));
  });

  afterAll(async () => {
    if (mcpProcess) {
      mcpProcess.kill("SIGTERM");
      try {
        await mcpProcess;
      } catch {
        // Ignore expected exit errors from SIGTERM
      }
    }
  });

  it("returns 401 Unauthorized when connecting to /sse without Authorization header", async () => {
    const res = await fetch(`${BASE_URL}/sse`);
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toBe("Unauthorized");
  });

  it("returns 401 Unauthorized when connecting to /sse with incorrect API key", async () => {
    const res = await fetch(`${BASE_URL}/sse`, {
      headers: {
        Authorization: "Bearer wrong-api-key",
      },
    });
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toBe("Unauthorized");
  });

  it("successfully connects to /sse with valid Authorization header", async () => {
    // SSE requests keep the connection open, so we use http.request to abort it early
    const options = {
      hostname: "localhost",
      port: PORT,
      path: "/sse",
      method: "GET",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
    };

    const reqPromise = new Promise<{ statusCode: number; headers: Record<string, string> }>((resolve, reject) => {
      const req = http.request(options, (res) => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers as Record<string, string>,
        });
        // Abort to prevent hanging
        req.destroy();
      });

      req.on("error", (err) => {
        reject(err);
      });

      req.end();
    });

    const res = await reqPromise;
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
  });

  it("returns 401 Unauthorized when posting to /messages without valid API key", async () => {
    const res = await fetch(`${BASE_URL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "ping",
        id: 1,
      }),
    });
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toBe("Unauthorized");
  });

  it("returns 400 Bad Request when posting to /messages with valid API key but no active SSE session", async () => {
    const res = await fetch(`${BASE_URL}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "ping",
        id: 1,
      }),
    });
    // The server handles missing/inactive SSE session by returning 400 No active SSE connection.
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toBe("No active SSE connection.");
  });
});
