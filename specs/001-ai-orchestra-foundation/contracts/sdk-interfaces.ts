// SDK Interface Contracts for @undrestrator/infra-client
// These interfaces define the public API surface of the SDK.

// ── Chat / LLM Interfaces ──────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'developer';
  content: string;
}

export interface LLMConfig {
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

export interface CompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: { role?: string; content?: string };
    finish_reason: string | null;
  }>;
}

export interface LLMClient {
  chat: {
    completions: {
      create(options: CompletionOptions): Promise<CompletionResponse>;
      createStream(options: CompletionOptions): AsyncIterable<StreamChunk>;
    };
  };
}

// ── Vector Store Interfaces ─────────────────────────────────────────────────

export interface VectorConfig {
  baseURL?: string;
  collection: string;
  alias?: string;
  dimension?: number;
  distanceMetric?: 'Cosine' | 'Euclid' | 'Dot';
}

export interface VectorPoint {
  id: string | number;
  vector: number[];
  payload?: Record<string, unknown>;
}

export interface SearchResult {
  id: string | number;
  score: number;
  payload?: Record<string, unknown>;
  vector?: number[];
}

export interface SearchOptions {
  limit?: number;
  filter?: Record<string, unknown>;
  minScore?: number;
  withPayload?: boolean;
  withVector?: boolean;
}

export interface VectorStore {
  init(): Promise<void>;
  upsert(points: VectorPoint[]): Promise<boolean>;
  search(vector: number[], limit?: number, filter?: Record<string, unknown>): Promise<SearchResult[]>;
  createAlias(alias: string): Promise<boolean>;
  deleteAlias(alias: string): Promise<boolean>;
  listAliases(): Promise<string[]>;
}

// ── Queue Interfaces ────────────────────────────────────────────────────────

export interface QueueConfig {
  name: string;
  redisURL?: string;
}

export interface QueueJob<T = unknown> {
  id: string;
  data: T;
  name: string;
}

export interface QueueClient<T = unknown> {
  queue: import('bullmq').Queue;
  enqueue(jobName: string, data: T): Promise<import('bullmq').Job>;
  createWorker(processor: (job: import('bullmq').Job<T>) => Promise<unknown>): import('bullmq').Worker;
  close(): Promise<void>;
}

// ── Hermes Agent Interfaces ─────────────────────────────────────────────────

export interface HermesConfig {
  baseURL?: string;
}

export interface HermesChatResponse {
  message: string;
  context?: Record<string, unknown>;
}

export interface HermesSkill {
  name: string;
  description: string;
  code?: string;
  auto_created?: boolean;
  last_used?: string;
}

export interface HermesClient {
  chat(message: string, context?: Record<string, unknown>): Promise<HermesChatResponse>;
  getSkills(): Promise<HermesSkill[]>;
  createSkill(skill: { name: string; description: string; code: string }): Promise<HermesSkill>;
}

// ── Factory Functions ───────────────────────────────────────────────────────

export declare function createLLMClient(config?: LLMConfig): LLMClient;
export declare function createVectorStore(config: VectorConfig): VectorStore;
export declare function createQueue<T = unknown>(config: QueueConfig): QueueClient<T>;
export declare function createHermesClient(config?: HermesConfig): HermesClient;
