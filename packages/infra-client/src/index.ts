import { Redis } from 'ioredis';
import { Queue, Worker } from 'bullmq';

export interface TenantConfig {
  tenantId?: string;
}

// ── LLM Client types and functions ──────────────────────────────────────────
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'developer';
  content: string;
}

export interface LLMConfig extends TenantConfig {
  apiKey?: string;
  baseURL?: string;
}

export interface CompletionOptions {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export function createLLMClient(config: LLMConfig = {}) {
  const baseURL = config.baseURL || process.env.OMNI_ROUTE_URL || 'http://localhost:20128/v1';
  const apiKey = config.apiKey || process.env.ORCH_MCP_API_KEY || 'no-key-needed';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
  if (config.tenantId) {
    headers['X-Tenant-ID'] = config.tenantId;
  }

  return {
    chat: {
      completions: {
        create: async (options: CompletionOptions) => {
          const response = await fetch(`${baseURL}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(options)
          });
          if (!response.ok) {
            throw new Error(`OmniRoute error: ${response.status} ${response.statusText}`);
          }
          return response.json();
        },
        createStream: async function* (options: CompletionOptions) {
          const response = await fetch(`${baseURL}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ...options, stream: true })
          });
          if (!response.ok || !response.body) {
            throw new Error(`OmniRoute streaming error: ${response.status} ${response.statusText}`);
          }
          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              const cleanLine = line.trim();
              if (!cleanLine) continue;
              if (cleanLine === 'data: [DONE]') return;
              if (cleanLine.startsWith('data: ')) {
                try {
                  yield JSON.parse(cleanLine.slice(6));
                } catch {
                  // Ignore malformed JSON chunks
                }
              }
            }
          }
        }
      }
    },
    reportCost: async (usage: { promptTokens: number; completionTokens: number; model: string }) => {
      if (!config.tenantId) return { reported: false, reason: 'no tenant context' };
      return {
        reported: true,
        tenantId: config.tenantId,
        costEstimate: (usage.promptTokens + usage.completionTokens) * 0.00001,
        model: usage.model,
        timestamp: new Date().toISOString()
      };
    }
  };
}

// ── Vector Store types and functions ─────────────────────────────────────────
export interface VectorConfig extends TenantConfig {
  baseURL?: string;
  collection: string;
  alias?: string;
  dimension?: number;
}

export function createVectorStore(config: VectorConfig) {
  const baseURL = config.baseURL || process.env.QDRANT_URL || 'http://localhost:6333';
  const collection = config.collection;
  const effectiveCollection = config.tenantId ? `${config.tenantId}_${collection}` : collection;
  const dimension = config.dimension || 1536;

  const headers = () => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.tenantId) h['X-Tenant-ID'] = config.tenantId;
    return h;
  };

  let initialized = false;

  const init = async () => {
    if (initialized) return;
    const res = await fetch(`${baseURL}/collections/${effectiveCollection}`, {
      headers: headers()
    });
    if (res.status === 404) {
      await fetch(`${baseURL}/collections/${effectiveCollection}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({
          vectors: {
            size: dimension,
            distance: 'Cosine'
          }
        })
      });
    }

    if (config.alias) {
      await fetch(`${baseURL}/collections/aliases`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          actions: [
            { create_alias: { collection_name: collection, alias_name: config.alias } }
          ]
        })
      });
    }
    initialized = true;
  };

  return {
    init,
    upsert: async (points: Array<{ id: string | number; vector: number[]; payload?: any }>) => {
      await init();
      const res = await fetch(`${baseURL}/collections/${effectiveCollection}/points?wait=true`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ points })
      });
      return res.ok;
    },
    search: async (vector: number[], limit = 5, filter?: any) => {
      await init();
      const target = config.alias || effectiveCollection;
      const res = await fetch(`${baseURL}/collections/${target}/points/search`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          vector,
          limit,
          filter,
          with_payload: true,
          with_vector: false
        })
      });
      const data = await res.json() as any;
      return data.result || [];
    },
    createAlias: async (alias: string) => {
      await init();
      const res = await fetch(`${baseURL}/collections/aliases`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          actions: [{ create_alias: { collection_name: collection, alias_name: alias } }]
        })
      });
      return res.ok;
    },
    deleteAlias: async (alias: string) => {
      await init();
      const res = await fetch(`${baseURL}/collections/aliases`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          actions: [{ delete_alias: { alias_name: alias } }]
        })
      });
      return res.ok;
    },
    listAliases: async () => {
      await init();
      const res = await fetch(`${baseURL}/collections/${effectiveCollection}/aliases`, {
        headers: headers()
      });
      const data = await res.json() as any;
      return (data.result?.aliases || []).map((a: any) => a.alias_name || a);
    },
    listCollections: async () => {
      const res = await fetch(`${baseURL}/collections`, {
        headers: headers()
      });
      const data = await res.json() as any;
      const allCollections = (data.result?.collections || []).map((c: any) => c.name as string);
      if (config.tenantId) {
        const prefix = `${config.tenantId}_`;
        return allCollections.filter((name: string) => name.startsWith(prefix));
      }
      return allCollections;
    }
  };
}

// ── Redis & Queue types and functions ────────────────────────────────────────
export interface QueueConfig extends TenantConfig {
  name: string;
  redisURL?: string;
}

export function createQueue(config: QueueConfig) {
  const redisURL = config.redisURL || process.env.REDIS_URL || 'redis://localhost:6379';
  const connection = new Redis(redisURL, { maxRetriesPerRequest: null });
  const queue = new Queue(config.name, { connection });

  return {
    queue,
    enqueue: async (jobName: string, data: any) => {
      return queue.add(jobName, data);
    },
    createWorker: (processor: (job: any) => Promise<any>) => {
      return new Worker(config.name, processor, { connection });
    },
    close: async () => {
      await queue.close();
      await connection.quit();
    }
  };
}

// ── Hermes Agent types and functions ─────────────────────────────────────────
export interface HermesConfig extends TenantConfig {
  baseURL?: string;
}

export function createHermesClient(config: HermesConfig = {}) {
  const baseURL = config.baseURL || process.env.HERMES_URL || 'http://localhost:8080';

  const headers = () => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.tenantId) h['X-Tenant-ID'] = config.tenantId;
    return h;
  };

  return {
    chat: async (message: string, context?: any) => {
      const res = await fetch(`${baseURL}/chat`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ message, context })
      });
      if (!res.ok) {
        throw new Error(`Hermes API error: ${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    getSkills: async () => {
      const res = await fetch(`${baseURL}/skills`, {
        headers: headers()
      });
      if (!res.ok) {
        throw new Error(`Hermes API error: ${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    createSkill: async (skill: { name: string; description: string; code: string }) => {
      const res = await fetch(`${baseURL}/skills`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(skill)
      });
      if (!res.ok) {
        throw new Error(`Hermes API error: ${res.status} ${res.statusText}`);
      }
      return res.json();
    }
  };
}
