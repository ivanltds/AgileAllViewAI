/**
 * lib/azure/connector.ts
 * Thin wrapper around Azure DevOps REST API v7.0.
 * Uses plain fetch — no SDK, no heavy dependencies.
 * Token must be provided per-request (never stored here).
 */
import type {
  AzureIteration, AzureCapacityMember,
  AzureWorkItem, AzureRevision,
} from "../types";

const API_VERSION = "7.0";
const BATCH_SIZE = 200;

export class AzureConnector {
  private headers: HeadersInit;

  constructor(pat: string) {
    const b64 = Buffer.from(`:${pat}`).toString("base64");
    this.headers = {
      Authorization: `Basic ${b64}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  // ─── Internal fetch with retry on 429 ──────────────────────────
  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    let attempt = 0;
    while (true) {
      const res = await fetch(url, { headers: this.headers, ...options });

      if (res.status === 401 || res.status === 403) {
        throw new Error("PAT_INVALID");
      }
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") ?? "5", 10);
        await sleep((retryAfter + attempt) * 1000);
        attempt++;
        continue;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} — ${url}\n${body}`);
      }
      return res.json() as T;
    }
  }

  // ─── 1. Validate PAT + list projects ───────────────────────────
  async getProjects(org: string): Promise<{ id: string; name: string }[]> {
    const data = await this.request<{ value: { id: string; name: string }[] }>(
      `https://dev.azure.com/${enc(org)}/_apis/projects?api-version=${API_VERSION}`
    );
    return data.value ?? [];
  }

  // ─── 2. List teams in a project ────────────────────────────────
  async getTeams(org: string, projectId: string): Promise<{ id: string; name: string }[]> {
    const data = await this.request<{ value: { id: string; name: string }[] }>(
      `https://dev.azure.com/${enc(org)}/_apis/projects/${enc(projectId)}/teams?api-version=${API_VERSION}`
    );
    return data.value ?? [];
  }

  // ─── 3. Team members ───────────────────────────────────────────
  async getMembers(org: string, project: string, teamId: string) {
    const data = await this.request<{ value: { identity: { id: string; displayName: string; uniqueName: string } }[] }>(
      `https://dev.azure.com/${enc(org)}/_apis/projects/${enc(project)}/teams/${enc(teamId)}/members?api-version=${API_VERSION}`
    );
    return (data.value ?? []).map((m) => ({
      id: m.identity.id,
      displayName: m.identity.displayName,
      uniqueName: m.identity.uniqueName,
    }));
  }

  // ─── 4. Iterations (sprints) ───────────────────────────────────
  async getIterations(org: string, project: string, team: string): Promise<AzureIteration[]> {
    const data = await this.request<{ value: AzureIteration[] }>(
      `https://dev.azure.com/${enc(org)}/${enc(project)}/${enc(team)}/_apis/work/teamsettings/iterations?api-version=${API_VERSION}`
    );
    return data.value ?? [];
  }

  // ─── 5. Sprint capacity ────────────────────────────────────────
  async getCapacity(org: string, project: string, team: string, iterationId: string): Promise<AzureCapacityMember[]> {
    try {
      const data = await this.request<{ value: AzureCapacityMember[] }>(
        `https://dev.azure.com/${enc(org)}/${enc(project)}/${enc(team)}/_apis/work/teamsettings/iterations/${iterationId}/capacities?api-version=${API_VERSION}`
      );
      return data.value ?? [];
    } catch {
      return []; // capacity not always available (future sprints)
    }
  }

  // ─── 6. WIQL — returns IDs only ────────────────────────────────
  async wiql(org: string, project: string, query: string): Promise<number[]> {
    const data = await this.request<{ workItems: { id: number }[] }>(
      `https://dev.azure.com/${enc(org)}/${enc(project)}/_apis/wit/wiql?api-version=${API_VERSION}`,
      { method: "POST", body: JSON.stringify({ query }) }
    );
    return (data.workItems ?? []).map((w) => w.id);
  }

  // ─── 7. Work items in batch ────────────────────────────────────
  async getWorkItemsBatch(org: string, ids: number[], fields: string[]): Promise<AzureWorkItem[]> {
    if (!ids.length) return [];
    const results: AzureWorkItem[] = [];
    const fieldParam = fields.join(",");
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const chunk = ids.slice(i, i + BATCH_SIZE).join(",");
      const data = await this.request<{ value: AzureWorkItem[] }>(
        `https://dev.azure.com/${enc(org)}/_apis/wit/workitems?ids=${chunk}&fields=${fieldParam}&api-version=${API_VERSION}`
      );
      results.push(...(data.value ?? []));
    }
    return results;
  }

  // ─── 8. All revisions for a single work item ───────────────────
  async getRevisions(org: string, workItemId: number): Promise<AzureRevision[]> {
    const results: AzureRevision[] = [];
    let skip = 0;
    while (true) {
      const data = await this.request<{ value: AzureRevision[]; count: number }>(
        `https://dev.azure.com/${enc(org)}/_apis/wit/workItems/${workItemId}/revisions?$top=200&$skip=${skip}&api-version=${API_VERSION}`
      );
      const batch = data.value ?? [];
      results.push(...batch);
      if (batch.length < 200) break;
      skip += 200;
    }
    return results;
  }

  // ─── 9. Work item updates (incremental diffs) ──────────────────
  async getUpdates(org: string, workItemId: number, sinceRev = 0): Promise<AzureRevision[]> {
    const data = await this.request<{ value: AzureRevision[] }>(
      `https://dev.azure.com/${enc(org)}/_apis/wit/workItems/${workItemId}/updates?$top=200&api-version=${API_VERSION}`
    );
    return (data.value ?? []).filter((u) => u.rev > sinceRev);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────
function enc(s: string) { return encodeURIComponent(s); }
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
