// ABOUTME: Minimal typed client for the FinaFlow v1 API used by the MCP server.
// ABOUTME: Keeps authentication, error mapping and statement uploads in one place.

export class FinaFlowApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "FinaFlowApiError";
  }
}

export interface FinaFlowClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}

export class FinaFlowClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(options: FinaFlowClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/api/v1${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(init.body && typeof init.body === "string" ? { "Content-Type": "application/json" } : {}),
          ...(init.headers ?? {}),
        },
      });
      const text = await response.text();
      const body = text ? JSON.parse(text) as { data?: T; error?: { code?: string; message?: string }; meta?: { requestId?: string } } : {};
      if (!response.ok) {
        throw new FinaFlowApiError(
          response.status,
          body.error?.code ?? "HTTP_ERROR",
          body.error?.message ?? response.statusText,
          body.meta?.requestId,
        );
      }
      return (body.data ?? body) as T;
    } catch (error) {
      if (error instanceof FinaFlowApiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`FinaFlow request timed out after ${this.timeoutMs}ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body) });
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }

  analyzeStatements(input: {
    files: Array<{ fileName: string; contentBase64: string; password?: string }>;
    includeTransactions?: boolean;
  }): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>("/statements/analyze/full", input);
  }
}
