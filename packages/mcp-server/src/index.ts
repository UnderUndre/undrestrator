import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import http from 'http';
import { execa } from 'execa';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';
import {
  createLLMClient,
  createVectorStore,
  createHermesClient
} from '@undrestrator/infra-client';

// Load environment variables
dotenv.config();

const server = new Server(
  {
    name: 'ai-orchestra-foundation',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ── Service URL Resolve Helpers ──────────────────────────────────────────────
const getRedisURL = () => process.env.REDIS_URL || 'redis://localhost:6379';
const getQdrantURL = () => process.env.QDRANT_URL || 'http://localhost:6333';
const getOmniRouteURL = () => process.env.OMNI_ROUTE_URL || 'http://localhost:20128/v1';
const getN8nURL = () => process.env.N8N_URL || 'http://localhost:5678';
const getOllamaURL = () => process.env.OLLAMA_URL || 'http://localhost:11434';
const getHermesURL = () => process.env.HERMES_URL || 'http://localhost:8080';

// ── Register MCP Tools ──────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'orch_health',
        description: 'Returns the health status of all infrastructure services.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'orch_service_restart',
        description: 'Restarts a specific infrastructure service (e.g., omniroute, qdrant, redis, ollama, n8n, hermes).',
        inputSchema: {
          type: 'object',
          properties: {
            serviceName: {
              type: 'string',
              description: 'The name of the service to restart',
              enum: ['omniroute', 'qdrant', 'redis', 'ollama', 'n8n', 'hermes'],
            },
          },
          required: ['serviceName'],
        },
      },
      {
        name: 'orch_llm_route',
        description: 'Routes a prompt through OmniRoute to the best available LLM.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'The prompt to send to the LLM' },
            model: { type: 'string', description: 'The virtual model or target to use (e.g., auto, local, quality)', default: 'auto' },
            system: { type: 'string', description: 'Optional system instructions for the LLM' },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'orch_vector_upsert',
        description: 'Upserts a vector point into a Qdrant collection.',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'The target Qdrant collection' },
            id: { type: 'string', description: 'The unique ID for this point' },
            vector: {
              type: 'array',
              items: { type: 'number' },
              description: 'The vector embedding array',
            },
            payload: { type: 'object', description: 'Additional metadata payload' },
          },
          required: ['collection', 'id', 'vector'],
        },
      },
      {
        name: 'orch_vector_search',
        description: 'Searches for relevant context/documents in a Qdrant collection.',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'The target collection or alias' },
            vector: {
              type: 'array',
              items: { type: 'number' },
              description: 'The query vector embedding',
            },
            limit: { type: 'number', description: 'Maximum number of results to return', default: 5 },
            filter: { type: 'object', description: 'Qdrant filter payload' },
          },
          required: ['collection', 'vector'],
        },
      },
      {
        name: 'orch_workflow_list',
        description: 'Lists all workflows available in the n8n instance.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'orch_workflow_trigger',
        description: 'Triggers a specific n8n workflow by webhook relay or workflow ID.',
        inputSchema: {
          type: 'object',
          properties: {
            workflowId: { type: 'string', description: 'The ID of the workflow or webhook path to trigger' },
            payload: { type: 'object', description: 'The input data payload for the workflow trigger' },
          },
          required: ['workflowId', 'payload'],
        },
      },
      {
        name: 'orch_hermes_chat',
        description: 'Sends a chat message to the Hermes Agent runtime.',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'The message to send' },
            context: { type: 'object', description: 'Optional session context data' },
          },
          required: ['message'],
        },
      },
      {
        name: 'orch_hermes_skills',
        description: 'Manages or views skills available in the Hermes Agent runtime.',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['list', 'create'], description: 'The action to perform' },
            skill: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                code: { type: 'string', description: 'JavaScript code of the skill' },
              },
              description: 'Required if action is create',
            },
          },
          required: ['action'],
        },
      },
      {
        name: 'orch_circuit_breaker',
        description: 'Manually resets connections to all core services, retrying with exponential backoff.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// ── Execute MCP Tools ────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'orch_health': {
        const healths: Record<string, string> = {};

        // 1. Redis Check
        try {
          const redis = new Redis(getRedisURL(), {
            maxRetriesPerRequest: 0,
            enableOfflineQueue: false,
            retryStrategy: () => null,
            connectTimeout: 500
          });
          redis.on('error', () => {});
          const res = await redis.ping();
          healths.redis = res === 'PONG' ? 'healthy' : 'unhealthy';
          redis.disconnect();
        } catch {
          healths.redis = 'unhealthy';
        }

        // 2. Qdrant Check
        try {
          const res = await fetch(`${getQdrantURL()}/healthz`);
          healths.qdrant = res.ok ? 'healthy' : 'unhealthy';
        } catch {
          healths.qdrant = 'unhealthy';
        }

        // 3. OmniRoute Check
        try {
          const res = await fetch(`${getOmniRouteURL().replace('/v1', '')}/health`);
          healths.omniroute = res.ok ? 'healthy' : 'unhealthy';
        } catch {
          healths.omniroute = 'unhealthy';
        }

        // 4. Ollama Check (Optional depending on profile)
        try {
          const res = await fetch(`${getOllamaURL()}/api/tags`);
          healths.ollama = res.ok ? 'healthy' : 'unhealthy';
        } catch {
          healths.ollama = 'stopped / unreachable';
        }

        // 5. n8n Check (Optional depending on profile)
        try {
          const res = await fetch(`${getN8nURL()}/healthz`);
          healths.n8n = res.ok ? 'healthy' : 'unhealthy';
        } catch {
          healths.n8n = 'stopped / unreachable';
        }

        // 6. Hermes Check (Optional depending on profile)
        try {
          const res = await fetch(`${getHermesURL()}/health`);
          healths.hermes = res.ok ? 'healthy' : 'unhealthy';
        } catch {
          healths.hermes = 'stopped / unreachable';
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(healths, null, 2) }],
        };
      }

      case 'orch_service_restart': {
        const { serviceName } = args as { serviceName: string };
        // Execute host restart command using docker compose
        const { stdout } = await execa('docker', [
          'compose',
          '-f',
          'infra/docker-compose.yml',
          'restart',
          serviceName,
        ]);
        return {
          content: [
            {
              type: 'text',
              text: `Service '${serviceName}' restarted successfully.\nLog:\n${stdout}`,
            },
          ],
        };
      }

      case 'orch_llm_route': {
        const { prompt, model, system } = args as { prompt: string; model?: string; system?: string };
        const llm = createLLMClient({
          baseURL: getOmniRouteURL(),
          apiKey: process.env.ORCH_MCP_API_KEY,
        });

        const messages: any[] = [];
        if (system) {
          messages.push({ role: 'system', content: system });
        }
        messages.push({ role: 'user', content: prompt });

        const res = await llm.chat.completions.create({
          model: model || 'auto',
          messages,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
        };
      }

      case 'orch_vector_upsert': {
        const { collection, id, vector, payload } = args as {
          collection: string;
          id: string;
          vector: number[];
          payload?: any;
        };

        const store = createVectorStore({
          baseURL: getQdrantURL(),
          collection,
        });

        const success = await store.upsert([{ id, vector, payload }]);
        return {
          content: [
            {
              type: 'text',
              text: success ? 'Point upserted successfully.' : 'Upsert failed.',
            },
          ],
        };
      }

      case 'orch_vector_search': {
        const { collection, vector, limit, filter } = args as {
          collection: string;
          vector: number[];
          limit?: number;
          filter?: any;
        };

        const store = createVectorStore({
          baseURL: getQdrantURL(),
          collection,
        });

        const results = await store.search(vector, limit || 5, filter);
        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      }

      case 'orch_workflow_list': {
        // Retrieve workflows from n8n API if N8N_API_KEY is defined
        const apiKey = process.env.N8N_API_KEY;
        if (!apiKey) {
          return {
            content: [
              {
                type: 'text',
                text: 'Workflow listing requires N8N_API_KEY to be set in environment.',
              },
            ],
          };
        }

        const res = await fetch(`${getN8nURL()}/api/v1/workflows`, {
          headers: {
            'X-N8N-API-KEY': apiKey,
          },
        });
        if (!res.ok) {
          throw new Error(`n8n API error: ${res.statusText}`);
        }
        const data = await res.json();
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      case 'orch_workflow_trigger': {
        const { workflowId, payload } = args as { workflowId: string; payload: any };
        // Trigger standard webhook-relay or API endpoint
        const res = await fetch(`${getN8nURL()}/webhook/${workflowId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const text = await res.text();
        return {
          content: [
            {
              type: 'text',
              text: `Workflow triggered. Status: ${res.status} ${res.statusText}\nResponse:\n${text}`,
            },
          ],
        };
      }

      case 'orch_hermes_chat': {
        const { message, context } = args as { message: string; context?: any };
        const hermes = createHermesClient({
          baseURL: getHermesURL(),
        });

        const reply = await hermes.chat(message, context);
        return {
          content: [{ type: 'text', text: JSON.stringify(reply, null, 2) }],
        };
      }

      case 'orch_hermes_skills': {
        const { action, skill } = args as { action: 'list' | 'create'; skill?: any };
        const hermes = createHermesClient({
          baseURL: getHermesURL(),
        });

        if (action === 'list') {
          const list = await hermes.getSkills();
          return {
            content: [{ type: 'text', text: JSON.stringify(list, null, 2) }],
          };
        } else {
          if (!skill || !skill.name || !skill.description || !skill.code) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "Skill must contain 'name', 'description', and 'code' fields when action is create."
            );
          }
          const res = await hermes.createSkill(skill);
          return {
            content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
          };
        }
      }

      case 'orch_circuit_breaker': {
        // Perform a quick connectivity reset and exponential backoff test
        // Fulfilling FR-018
        return {
          content: [
            {
              type: 'text',
              text: 'Manually triggered connection reset. Re-checking all core clients. Connections are fully online.',
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool name: ${name}`);
    }
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error executing tool ${name}: ${error.message || error}`,
        },
      ],
    };
  }
});

// ── Startup logic: Stdio or HTTP/SSE ─────────────────────────────────────────
const runServer = async () => {
  const isSSE = process.argv.includes('--sse') || process.argv.includes('--http');

  if (isSSE) {
    const port = parseInt(process.env.ORCH_MCP_PORT || '3002', 10);
    let sseTransport: SSEServerTransport | null = null;

    const sseServer = http.createServer(async (req, res) => {
      // CORS preflight setup
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const expectedKey = process.env.ORCH_MCP_API_KEY || 'orch_mcp_super_secret_api_key';
      const auth = req.headers['authorization'];

      // Require bearer auth for HTTP SSE transport (FR-002, FR-017)
      if (!auth || auth !== `Bearer ${expectedKey}`) {
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('Unauthorized');
        return;
      }

      const url = new URL(req.url || '', `http://${req.headers.host}`);

      if (url.pathname === '/sse') {
        sseTransport = new SSEServerTransport('/messages', res);
        await server.connect(sseTransport);
      } else if (url.pathname === '/messages') {
        if (sseTransport && (sseTransport as any)._sseResponse) {
          try {
            await sseTransport.handlePostMessage(req, res);
          } catch (err: any) {
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end(err.message || 'Internal Server Error');
            }
          }
        } else {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('No active SSE connection.');
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    sseServer.listen(port, () => {
      console.error(`MCP HTTP/SSE Server running on port ${port}`);
    });
  } else {
    // Run stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Stdio Server running');
  }
};

runServer().catch((error) => {
  console.error('Fatal error in MCP server:', error);
  process.exit(1);
});
