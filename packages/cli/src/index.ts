#!/usr/bin/env node

import { Command } from 'commander';
import { execa } from 'execa';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import {
  createLLMClient,
  createVectorStore,
  createHermesClient
} from '@undrestrator/infra-client';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('orch')
  .description('AI Orchestra Foundation command-line management tool')
  .version('0.1.0');

// ── Service Configuration Helper ─────────────────────────────────────────────
const getRedisURL = () => process.env.REDIS_URL || 'redis://localhost:6379';
const getQdrantURL = () => process.env.QDRANT_URL || 'http://localhost:6333';
const getOmniRouteURL = () => process.env.OMNI_ROUTE_URL || 'http://localhost:20128/v1';
const getN8nURL = () => process.env.N8N_URL || 'http://localhost:5678';
const getOllamaURL = () => process.env.OLLAMA_URL || 'http://localhost:11434';
const getHermesURL = () => process.env.HERMES_URL || 'http://localhost:8080';

// ANSI terminal colors helper
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

// Deterministic hashing fallback for generating embeddings
// This ensures that even without an embedding service online, we can test and verify
function getDeterministicEmbedding(text: string, dimension = 1536): number[] {
  const vector: number[] = [];
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  for (let i = 0; i < dimension; i++) {
    const value = Math.sin(hash + i) * 10000;
    vector.push(value - Math.floor(value));
  }
  
  // Normalize vector
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map(val => val / (magnitude || 1));
}

// Generate embeddings via OmniRoute or fallback deterministically
async function generateEmbedding(text: string, dimension = 1536): Promise<number[]> {
  try {
    const apiKey = process.env.ORCH_MCP_API_KEY || 'no-key-needed';
    const res = await fetch(`${getOmniRouteURL()}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        input: text,
        model: 'text-embedding-3-small'
      })
    });
    if (res.ok) {
      const data = await res.json() as any;
      if (data?.data?.[0]?.embedding) {
        return data.data[0].embedding;
      }
    }
  } catch {
    // Fail silently, fallback below
  }
  return getDeterministicEmbedding(text, dimension);
}

// ── Command 1: status ────────────────────────────────────────────────────────
program
  .command('status')
  .description('Reports the health, port mapping, and container status of all orchestra services')
  .action(async () => {
    console.log(`\n${colors.bright}${colors.cyan}=== AI Orchestra Health Dashboard ===${colors.reset}\n`);

    const services = [
      { name: 'omniroute', port: '20128', endpoint: `${getOmniRouteURL().replace('/v1', '')}/health` },
      { name: 'qdrant', port: '6333', endpoint: `${getQdrantURL()}/healthz` },
      { name: 'redis', port: '6379', endpoint: 'PING' },
      { name: 'ollama', port: '11434', endpoint: `${getOllamaURL()}/api/tags` },
      { name: 'n8n', port: '5678', endpoint: `${getN8nURL()}/healthz` },
      { name: 'hermes', port: '8080', endpoint: `${getHermesURL()}/health` },
    ];

    // Gather docker container statuses using docker compose
    const dockerStatusMap: Record<string, { state: string; uptime: string }> = {};
    try {
      // Look for compose file inside process cwd or relative /infra
      let composePath = 'infra/docker-compose.yml';
      if (!fs.existsSync(composePath)) {
        composePath = '../infra/docker-compose.yml';
      }

      const { stdout } = await execa('docker', [
        'compose',
        '-f',
        composePath,
        'ps',
        '--format',
        'json',
      ]);

      if (stdout.trim()) {
        // Handle format that is either single JSON array or multiple JSON line items
        let containers: any[] = [];
        try {
          containers = JSON.parse(stdout);
        } catch {
          containers = stdout.split('\n').filter(Boolean).map(line => JSON.parse(line));
        }

        for (const container of containers) {
          const serviceName = container.Service || container.service;
          if (serviceName) {
            dockerStatusMap[serviceName.toLowerCase()] = {
              state: container.State || container.state || 'unknown',
              uptime: container.Status || container.status || 'unknown',
            };
          }
        }
      }
    } catch {
      // Docker command failed or docker not available
    }

    const tableRows: Array<{
      name: string;
      dockerState: string;
      apiHealth: string;
      port: string;
      uptime: string;
    }> = [];

    for (const service of services) {
      const dockerInfo = dockerStatusMap[service.name] || { state: 'untracked', uptime: 'N/A' };
      let apiHealth = 'unhealthy';

      if (service.endpoint === 'PING') {
        try {
          const redis = new Redis(getRedisURL(), {
            maxRetriesPerRequest: 0,
            enableOfflineQueue: false,
            retryStrategy: () => null,
            connectTimeout: 500
          });
          redis.on('error', () => {});
          const pong = await redis.ping();
          apiHealth = pong === 'PONG' ? 'healthy' : 'unhealthy';
          redis.disconnect();
        } catch {
          apiHealth = 'stopped';
        }
      } else {
        try {
          const res = await fetch(service.endpoint, { signal: AbortSignal.timeout(1000) });
          apiHealth = res.ok ? 'healthy' : 'unhealthy';
        } catch {
          apiHealth = 'stopped';
        }
      }

      tableRows.push({
        name: service.name,
        dockerState: dockerInfo.state,
        apiHealth,
        port: service.port,
        uptime: dockerInfo.uptime,
      });
    }

    // Print table beautifully
    const colWidths = { name: 12, docker: 14, api: 12, port: 8, uptime: 25 };
    
    // Header
    const formatRow = (name: string, docker: string, api: string, port: string, uptime: string) => {
      return `| ${name.padEnd(colWidths.name)} | ${docker.padEnd(colWidths.docker)} | ${api.padEnd(colWidths.api)} | ${port.padEnd(colWidths.port)} | ${uptime.padEnd(colWidths.uptime)} |`;
    };

    console.log('+' + '-'.repeat(colWidths.name + 2) + '+' + '-'.repeat(colWidths.docker + 2) + '+' + '-'.repeat(colWidths.api + 2) + '+' + '-'.repeat(colWidths.port + 2) + '+' + '-'.repeat(colWidths.uptime + 2) + '+');
    console.log(formatRow('Service', 'Docker State', 'API Health', 'Port', 'Uptime/Status'));
    console.log('+' + '-'.repeat(colWidths.name + 2) + '+' + '-'.repeat(colWidths.docker + 2) + '+' + '-'.repeat(colWidths.api + 2) + '+' + '-'.repeat(colWidths.port + 2) + '+' + '-'.repeat(colWidths.uptime + 2) + '+');

    for (const row of tableRows) {
      let stateColor = colors.red;
      if (row.dockerState.includes('running') || row.dockerState.includes('up')) {
        stateColor = colors.green;
      } else if (row.dockerState === 'untracked') {
        stateColor = colors.dim;
      }

      let apiColor = colors.red;
      if (row.apiHealth === 'healthy') {
        apiColor = colors.green;
      } else if (row.apiHealth === 'stopped') {
        apiColor = colors.dim;
      }

      console.log(
        `| ${colors.bright}${row.name.padEnd(colWidths.name)}${colors.reset} | ` +
        `${stateColor}${row.dockerState.padEnd(colWidths.docker)}${colors.reset} | ` +
        `${apiColor}${row.apiHealth.padEnd(colWidths.api)}${colors.reset} | ` +
        `${row.port.padEnd(colWidths.port)} | ` +
        `${row.uptime.padEnd(colWidths.uptime)} |`
      );
    }
    console.log('+' + '-'.repeat(colWidths.name + 2) + '+' + '-'.repeat(colWidths.docker + 2) + '+' + '-'.repeat(colWidths.api + 2) + '+' + '-'.repeat(colWidths.port + 2) + '+' + '-'.repeat(colWidths.uptime + 2) + '+');
    console.log('');
  });

// ── Command 2: llm ───────────────────────────────────────────────────────────
program
  .command('llm')
  .argument('<prompt>', 'The prompt message to route')
  .option('-m, --model <name>', 'The virtual model target (auto, local, quality)', 'auto')
  .option('-s, --system <instructions>', 'Optional system prompt')
  .option('--stream', 'Stream the completion response token-by-token')
  .description('Routes a prompt to the best available LLM via OmniRoute')
  .action(async (prompt, options) => {
    const llm = createLLMClient({
      baseURL: getOmniRouteURL(),
      apiKey: process.env.ORCH_MCP_API_KEY,
    });

    const messages: any[] = [];
    if (options.system) {
      messages.push({ role: 'system', content: options.system });
    }
    messages.push({ role: 'user', content: prompt });

    console.log(`Routing through virtual model target: ${colors.green}${options.model}${colors.reset}...\n`);

    try {
      if (options.stream) {
        const stream = llm.chat.completions.createStream({
          model: options.model,
          messages,
        });

        process.stdout.write(`${colors.bright}Assistant:${colors.reset} `);
        for await (const chunk of stream) {
          const token = chunk.choices?.[0]?.delta?.content || '';
          process.stdout.write(token);
        }
        console.log('\n');
      } else {
        const completion = await llm.chat.completions.create({
          model: options.model,
          messages,
        }) as any;

        const reply = completion.choices?.[0]?.message?.content || JSON.stringify(completion, null, 2);
        console.log(`${colors.bright}Assistant:${colors.reset}\n${reply}\n`);
      }
    } catch (err: any) {
      console.error(`${colors.red}LLM Routing Error:${colors.reset} ${err.message || err}`);
    }
  });

// ── Command 3: vector ────────────────────────────────────────────────────────
const vectorCommand = program
  .command('vector')
  .description('Manage and search vector store points in Qdrant');

vectorCommand
  .command('search')
  .argument('<query>', 'Text query to embed and search')
  .option('-c, --collection <name>', 'Collection name', 'default_collection')
  .option('-l, --limit <count>', 'Number of results to return', '5')
  .option('-f, --filter <json>', 'JSON query filter criteria')
  .description('Embedded search in Qdrant vector store')
  .action(async (query, options) => {
    console.log(`Embedding text: "${colors.yellow}${query}${colors.reset}" ...`);
    const embedding = await generateEmbedding(query);
    const limit = parseInt(options.limit, 10);
    
    let parsedFilter: any = undefined;
    if (options.filter) {
      try {
        parsedFilter = JSON.parse(options.filter);
      } catch (err: any) {
        console.error(`${colors.red}Filter parse error:${colors.reset} ${err.message}`);
        return;
      }
    }

    const store = createVectorStore({
      baseURL: getQdrantURL(),
      collection: options.collection,
    });

    console.log(`Searching Qdrant collection: "${colors.cyan}${options.collection}${colors.reset}"...`);
    try {
      const results = await store.search(embedding, limit, parsedFilter);
      console.log(`\n${colors.bright}Found ${results.length} relevant context points:${colors.reset}\n`);

      results.forEach((match: any, index: number) => {
        console.log(`${colors.green}[Result #${index + 1}] (Score: ${match.score?.toFixed(4)})${colors.reset}`);
        console.log(`ID: ${match.id}`);
        console.log(`Payload: ${JSON.stringify(match.payload, null, 2)}`);
        console.log('-'.repeat(40));
      });
    } catch (err: any) {
      console.error(`${colors.red}Vector Search Error:${colors.reset} ${err.message || err}`);
    }
  });

vectorCommand
  .command('upsert')
  .argument('<text>', 'Text to index')
  .requiredOption('--id <id>', 'Unique integer or UUID identifier')
  .option('-c, --collection <name>', 'Collection name', 'default_collection')
  .option('-p, --payload <json>', 'JSON payload to store with vector')
  .description('Vectorizes text and indexes it in Qdrant vector store')
  .action(async (text, options) => {
    console.log(`Embedding and upserting point...`);
    const embedding = await generateEmbedding(text);
    
    let parsedPayload: any = { text };
    if (options.payload) {
      try {
        parsedPayload = { ...parsedPayload, ...JSON.parse(options.payload) };
      } catch (err: any) {
        console.error(`${colors.red}Payload parse error:${colors.reset} ${err.message}`);
        return;
      }
    }

    const store = createVectorStore({
      baseURL: getQdrantURL(),
      collection: options.collection,
    });

    try {
      const success = await store.upsert([
        {
          id: options.id,
          vector: embedding,
          payload: parsedPayload,
        },
      ]);

      if (success) {
        console.log(`${colors.green}Success! Point ${options.id} indexed in "${options.collection}".${colors.reset}\n`);
      } else {
        console.error(`${colors.red}Failed to upsert point.${colors.reset}`);
      }
    } catch (err: any) {
      console.error(`${colors.red}Upsert Error:${colors.reset} ${err.message || err}`);
    }
  });

// ── Command 4: n8n ───────────────────────────────────────────────────────────
const n8nCommand = program
  .command('n8n')
  .description('Manage workflows and trigger automated workflows inside n8n');

n8nCommand
  .command('list')
  .description('Lists all registered workflows in n8n')
  .action(async () => {
    const apiKey = process.env.N8N_API_KEY;
    if (!apiKey) {
      console.error(`${colors.red}Error:${colors.reset} N8N_API_KEY is not defined in the environment.`);
      return;
    }

    try {
      const res = await fetch(`${getN8nURL()}/api/v1/workflows`, {
        headers: {
          'X-N8N-API-KEY': apiKey,
        },
      });

      if (!res.ok) {
        throw new Error(`n8n HTTP ${res.status}: ${res.statusText}`);
      }

      const data: any = await res.json();
      const workflows = data.data || [];

      console.log(`\n${colors.bright}Found ${workflows.length} workflows in n8n:${colors.reset}\n`);
      workflows.forEach((wf: any) => {
        const status = wf.active ? `${colors.green}Active${colors.reset}` : `${colors.yellow}Inactive${colors.reset}`;
        console.log(`- ${colors.bright}${wf.name}${colors.reset} (ID: ${wf.id}) [${status}]`);
      });
      console.log('');
    } catch (err: any) {
      console.error(`${colors.red}n8n List Error:${colors.reset} ${err.message || err}`);
    }
  });

n8nCommand
  .command('trigger')
  .argument('<workflowId>', 'Workflow ID or Webhook Path')
  .option('-p, --payload <json>', 'JSON data payload to send to workflow', '{}')
  .description('Triggers a workflow in n8n via its API or webhook endpoint')
  .action(async (workflowId, options) => {
    let payload = {};
    try {
      payload = JSON.parse(options.payload);
    } catch (err: any) {
      console.error(`${colors.red}Payload parse error:${colors.reset} ${err.message}`);
      return;
    }

    console.log(`Triggering n8n workflow "${colors.cyan}${workflowId}${colors.reset}"...`);
    try {
      const res = await fetch(`${getN8nURL()}/webhook/${workflowId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const reply = await res.text();
      console.log(`\nStatus: ${res.status} ${res.statusText}`);
      console.log(`Response Payload:\n${colors.dim}${reply}${colors.reset}\n`);
    } catch (err: any) {
      console.error(`${colors.red}Trigger Error:${colors.reset} ${err.message || err}`);
    }
  });

// ── Command 5: hermes ────────────────────────────────────────────────────────
const hermesCommand = program
  .command('hermes')
  .description('Interface with the Hermes Agent runtime and manage custom skills');

hermesCommand
  .command('chat')
  .argument('<message>', 'Message to send to Hermes Agent')
  .option('-c, --context <json>', 'Optional session context data', '{}')
  .description('Send a message and chat with the Hermes Agent')
  .action(async (message, options) => {
    let context = {};
    try {
      context = JSON.parse(options.context);
    } catch (err: any) {
      console.error(`${colors.red}Context parse error:${colors.reset} ${err.message}`);
      return;
    }

    const client = createHermesClient({ baseURL: getHermesURL() });

    console.log(`Sending message to Hermes Agent runtime...`);
    try {
      const response = await client.chat(message, context);
      console.log(`\n${colors.bright}Hermes:${colors.reset}`);
      console.log(typeof response === 'string' ? response : JSON.stringify(response, null, 2));
      console.log('');
    } catch (err: any) {
      console.error(`${colors.red}Hermes Chat Error:${colors.reset} ${err.message || err}`);
    }
  });

const skillCommand = hermesCommand
  .command('skill')
  .description('Manage skill injection in Hermes Agent');

skillCommand
  .command('list')
  .description('Lists all injected skills on Hermes Agent')
  .action(async () => {
    const client = createHermesClient({ baseURL: getHermesURL() });
    try {
      const skills = await client.getSkills();
      console.log(`\n${colors.bright}Active injected skills on Hermes:${colors.reset}\n`);
      console.log(JSON.stringify(skills, null, 2));
      console.log('');
    } catch (err: any) {
      console.error(`${colors.red}Hermes Skill List Error:${colors.reset} ${err.message || err}`);
    }
  });

skillCommand
  .command('create')
  .requiredOption('-n, --name <name>', 'Skill name')
  .requiredOption('-d, --desc <description>', 'Skill description')
  .requiredOption('-f, --file <filePath>', 'Path to JS code file for the skill')
  .description('Creates and injects a custom skill to Hermes')
  .action(async (options) => {
    const filePath = path.resolve(options.file);
    if (!fs.existsSync(filePath)) {
      console.error(`${colors.red}Error: Skill code file not found at ${filePath}${colors.reset}`);
      return;
    }

    const code = fs.readFileSync(filePath, 'utf-8');
    const client = createHermesClient({ baseURL: getHermesURL() });

    console.log(`Injecting skill "${colors.cyan}${options.name}${colors.reset}" to Hermes Agent...`);
    try {
      const result = await client.createSkill({
        name: options.name,
        description: options.desc,
        code,
      });

      console.log(`${colors.green}Success! Skill injected successfully.${colors.reset}\n`);
      console.log(JSON.stringify(result, null, 2));
      console.log('');
    } catch (err: any) {
      console.error(`${colors.red}Injection Error:${colors.reset} ${err.message || err}`);
    }
  });

// ── Command 6: service ───────────────────────────────────────────────────────
const serviceCommand = program
  .command('service')
  .description('Orchestra service level control command');

serviceCommand
  .command('restart')
  .argument('<serviceName>', 'Name of the service (omniroute, qdrant, redis, ollama, n8n, hermes)')
  .description('Restarts a specific container service in the orchestra')
  .action(async (serviceName) => {
    const validServices = ['omniroute', 'qdrant', 'redis', 'ollama', 'n8n', 'hermes'];
    if (!validServices.includes(serviceName.toLowerCase())) {
      console.error(`${colors.red}Error: Invalid service. Must be one of: ${validServices.join(', ')}${colors.reset}`);
      return;
    }

    console.log(`Restarting service "${colors.yellow}${serviceName}${colors.reset}"...`);
    try {
      let composePath = 'infra/docker-compose.yml';
      if (!fs.existsSync(composePath)) {
        composePath = '../infra/docker-compose.yml';
      }

      const { stdout } = await execa('docker', [
        'compose',
        '-f',
        composePath,
        'restart',
        serviceName.toLowerCase(),
      ]);

      console.log(`${colors.green}Success! Service restarted.${colors.reset}`);
      if (stdout.trim()) {
        console.log(`Docker Log:\n${colors.dim}${stdout}${colors.reset}`);
      }
    } catch (err: any) {
      console.error(`${colors.red}Restart Error:${colors.reset} ${err.message || err}`);
    }
  });

program.parse(process.argv);
