import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock ioredis and bullmq
vi.mock("ioredis", () => {
  const mockRedisInstance = {
    on: vi.fn(),
    ping: vi.fn().mockResolvedValue("PONG"),
    disconnect: vi.fn(),
    quit: vi.fn().mockResolvedValue(undefined),
  };
  return {
    Redis: vi.fn().mockImplementation(() => mockRedisInstance),
  };
});

vi.mock("bullmq", () => {
  const mockQueueInstance = {
    add: vi.fn().mockResolvedValue({ id: "job-123", name: "test-job" }),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const mockWorkerInstance = {};
  return {
    Queue: vi.fn().mockImplementation(() => mockQueueInstance),
    Worker: vi.fn().mockImplementation(() => mockWorkerInstance),
  };
});

// Import the client SDK
import {
  createLLMClient,
  createVectorStore,
  createQueue,
  createHermesClient,
} from "../../packages/infra-client/src/index.js";

describe("Client SDK - @undrestrator/infra-client", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("createLLMClient", () => {
    it("sends standard chat completion request successfully", async () => {
      const mockResponseData = {
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1677652288,
        choices: [{ message: { role: "assistant", content: "Hello there!" } }],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponseData,
      });

      const client = createLLMClient({
        baseURL: "http://omniroute.test/v1",
        apiKey: "test-api-key",
      });

      const result = await client.chat.completions.create({
        messages: [{ role: "user", content: "Hello" }],
        model: "auto",
      });

      expect(global.fetch).toHaveBeenCalledWith("http://omniroute.test/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-api-key",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Hello" }],
          model: "auto",
        }),
      });
      expect(result).toEqual(mockResponseData);
    });

    it("handles error responses from OmniRoute gracefully", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const client = createLLMClient({
        baseURL: "http://omniroute.test/v1",
        apiKey: "test-api-key",
      });

      await expect(
        client.chat.completions.create({
          messages: [{ role: "user", content: "Hello" }],
        })
      ).rejects.toThrow("OmniRoute error: 500 Internal Server Error");
    });

    it("parses server-sent event streams correctly in createStream", async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world!"}}]}\n\n',
        "data: [DONE]\n\n",
      ];

      const encoder = new TextEncoder();
      let chunkIdx = 0;

      const mockReadableStream = {
        getReader() {
          return {
            async read() {
              if (chunkIdx < chunks.length) {
                const value = encoder.encode(chunks[chunkIdx++]);
                return { done: false, value };
              }
              return { done: true, value: undefined };
            },
          };
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: mockReadableStream,
      });

      const client = createLLMClient({
        baseURL: "http://omniroute.test/v1",
        apiKey: "test-api-key",
      });

      const stream = client.chat.completions.createStream({
        messages: [{ role: "user", content: "Stream test" }],
      });

      const results = [];
      for await (const chunk of stream) {
        results.push(chunk);
      }

      expect(results).toHaveLength(2);
      expect(results[0].choices[0].delta.content).toBe("Hello");
      expect(results[1].choices[0].delta.content).toBe(" world!");
    });
  });

  describe("createVectorStore", () => {
    it("initializes a collection if it does not exist", async () => {
      let initCollectionChecked = false;
      let initCollectionCreated = false;

      global.fetch = vi.fn().mockImplementation(async (url, options) => {
        const urlStr = String(url);
        if (urlStr.endsWith("/collections/test-col")) {
          if (!options) {
            initCollectionChecked = true;
            return { status: 404, ok: false };
          }
          if (options.method === "PUT") {
            initCollectionCreated = true;
            return { status: 200, ok: true, json: async () => ({}) };
          }
        }
        return { status: 200, ok: true, json: async () => ({}) };
      });

      const store = createVectorStore({
        baseURL: "http://qdrant.test",
        collection: "test-col",
        dimension: 1536,
      });

      await store.init();

      expect(initCollectionChecked).toBe(true);
      expect(initCollectionCreated).toBe(true);
    });

    it("upserts vector points correctly", async () => {
      let upsertCalled = false;

      global.fetch = vi.fn().mockImplementation(async (url, options) => {
        const urlStr = String(url);
        if (urlStr.endsWith("/collections/test-col")) {
          // Mock collection exists
          return { status: 200, ok: true };
        }
        if (urlStr.endsWith("/collections/test-col/points?wait=true") && options?.method === "PUT") {
          upsertCalled = true;
          const body = JSON.parse(options.body as string);
          expect(body.points).toHaveLength(1);
          expect(body.points[0].id).toBe("point-1");
          expect(body.points[0].vector).toEqual([0.1, 0.2]);
          expect(body.points[0].payload).toEqual({ text: "hello" });
          return { status: 200, ok: true };
        }
        return { status: 200, ok: true };
      });

      const store = createVectorStore({
        baseURL: "http://qdrant.test",
        collection: "test-col",
      });

      const success = await store.upsert([{ id: "point-1", vector: [0.1, 0.2], payload: { text: "hello" } }]);

      expect(success).toBe(true);
      expect(upsertCalled).toBe(true);
    });

    it("performs search query correctly", async () => {
      let searchCalled = false;
      const mockResultPoints = [
        { id: "point-1", score: 0.99, payload: { text: "hello" } },
      ];

      global.fetch = vi.fn().mockImplementation(async (url, options) => {
        const urlStr = String(url);
        if (urlStr.endsWith("/collections/test-col")) {
          return { status: 200, ok: true };
        }
        if (urlStr.endsWith("/collections/test-col/points/search") && options?.method === "POST") {
          searchCalled = true;
          const body = JSON.parse(options.body as string);
          expect(body.vector).toEqual([0.1, 0.2]);
          expect(body.limit).toBe(3);
          return {
            status: 200,
            ok: true,
            json: async () => ({ result: mockResultPoints }),
          };
        }
        return { status: 200, ok: true };
      });

      const store = createVectorStore({
        baseURL: "http://qdrant.test",
        collection: "test-col",
      });

      const results = await store.search([0.1, 0.2], 3);

      expect(searchCalled).toBe(true);
      expect(results).toEqual(mockResultPoints);
    });
  });

  describe("createQueue", () => {
    it("configures BullMQ Queue and handles enqueueing jobs", async () => {
      const qClient = createQueue({
        name: "test-queue",
        redisURL: "redis://localhost:6379",
      });

      const job = await qClient.enqueue("test-job", { foo: "bar" });
      expect(job.id).toBe("job-123");

      const processor = async () => {};
      const worker = qClient.createWorker(processor);
      expect(worker).toBeDefined();

      await qClient.close();
    });
  });

  describe("createHermesClient", () => {
    it("makes standard post request on chat", async () => {
      const mockResponse = { reply: "Yes, master." };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const client = createHermesClient({ baseURL: "http://hermes.test" });
      const res = await client.chat("Hello!", { userId: "user-1" });

      expect(global.fetch).toHaveBeenCalledWith("http://hermes.test/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hello!", context: { userId: "user-1" } }),
      });
      expect(res).toEqual(mockResponse);
    });

    it("obtains list of skills successfully", async () => {
      const mockSkills = [{ name: "skill1", description: "desc" }];
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSkills,
      });

      const client = createHermesClient({ baseURL: "http://hermes.test" });
      const res = await client.getSkills();

      expect(global.fetch).toHaveBeenCalledWith("http://hermes.test/skills");
      expect(res).toEqual(mockSkills);
    });

    it("creates a new skill successfully", async () => {
      const mockSkill = { name: "sum", description: "adds two numbers", code: "return a + b;" };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const client = createHermesClient({ baseURL: "http://hermes.test" });
      const res = await client.createSkill(mockSkill);

      expect(global.fetch).toHaveBeenCalledWith("http://hermes.test/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockSkill),
      });
      expect(res).toEqual({ success: true });
    });
  });
});
