import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

// ─── Configuration ──────────────────────────────────────────────────────────
const GITHUB_API_URL =
  "https://api.github.com/repos/homayounmmdy/svg-world-maps-data/contents/maps";
const CDN_BASE =
  "https://cdn.jsdelivr.net/gh/homayounmmdy/svg-world-maps-data@main/maps";

// Simple in‑memory cache so the list is built once and reused.
let cachedMaps: any[] | null = null;

// ─── Helper: extract metadata from a single map file ────────────────────────
// Mirrors the logic in scripts/generate-maps-report.mjs
function extractMapInfo(fileContent: string, fileName: string) {
  const command = fileName.replace(/\.ts$/i, "").toLowerCase();
  const nameMatch = fileContent.match(/\bname\s*:\s*["']([^"']+)["']/);
  const mapName = nameMatch ? nameMatch[1] : command;

  // Code extraction: take the last `code` before the `states` array if it exists,
  // otherwise fall back to the top‑level `code` field.
  const clean = fileContent
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
  const statesIdx = clean.search(/\bstates\s*:\s*\[/);
  let mapCode = "N/A";
  if (statesIdx !== -1) {
    const beforeStates = clean.slice(0, statesIdx);
    const codeMatches = [
      ...beforeStates.matchAll(/\bcode\s*:\s*["'`]([^"'`]+)["'`]/g),
    ];
    if (codeMatches.length) {
      mapCode = codeMatches[codeMatches.length - 1][1];
    }
  }
  if (mapCode === "N/A") {
    const topCode = clean.match(/\bcode\s*:\s*["'`]([^"'`]+)["'`]/);
    if (topCode) mapCode = topCode[1];
  }

  // Region count = number of elements in the `states` array.
  let regions = 0;
  const statesMatch = fileContent.match(/\bstates\s*:\s*\[/);
  if (statesMatch) {
    const startIdx = statesMatch.index! + statesMatch[0].length;
    const rest = fileContent.slice(startIdx);
    let depth = 1;
    for (let i = 0; i < rest.length; i++) {
      const ch = rest[i];
      if (ch === "[") depth++;
      else if (ch === "]") depth--;
      if (depth === 0) {
        // The substring between the opening `[` and this closing `]`
        // contains the individual objects; count commas at depth 1.
        const arrayContent = rest.slice(0, i);
        regions = (arrayContent.match(/,/g) || []).length + 1;
        break;
      }
    }
  }

  const supportsLabels = fileContent.includes("labels:");

  return {
    id: command,
    name: mapName,
    code: mapCode,
    regions,
    supportsLabels,
  };
}

// ─── Fetch the list of map files from GitHub ────────────────────────────────
async function fetchMapFileList(): Promise<string[]> {
  const res = await fetch(GITHUB_API_URL);
  if (!res.ok) {
    throw new Error(`GitHub API returned ${res.status}`);
  }
  const files = (await res.json()) as Array<{ name: string; type: string }>;
  return files
    .filter((f) => f.type === "file" && f.name.endsWith(".ts"))
    .map((f) => f.name);
}

// ─── Build the dynamic map catalog ──────────────────────────────────────────
async function buildMapCatalog(): Promise<any[]> {
  const fileNames = await fetchMapFileList();
  const catalog: any[] = [];

  // Fetch files in parallel but with a small concurrency limit to be polite.
  const concurrency = 10;
  for (let i = 0; i < fileNames.length; i += concurrency) {
    const batch = fileNames.slice(i, i + concurrency);
    const contents = await Promise.all(
      batch.map(async (fileName) => {
        const url = `${CDN_BASE}/${fileName}`;
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`Failed to fetch ${fileName}: ${res.status}`);
          return null;
        }
        const text = await res.text();
        return { fileName, text };
      }),
    );

    for (const item of contents) {
      if (!item) continue;
      const info = extractMapInfo(item.text, item.fileName);
      catalog.push(info);
    }
  }

  return catalog;
}

// ─── MCP server setup ────────────────────────────────────────────────────────
const server = new McpServer({
  name: "svg-world-maps",
  version: "0.1.0",
});

server.registerTool(
  "list_maps",
  {
    description:
      "List available SVG maps, including their identifiers, names, region counts, and label support.",
    inputSchema: z.object({}),
  },
  async () => {
    if (!cachedMaps) {
      cachedMaps = await buildMapCatalog();
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              total: cachedMaps.length,
              maps: cachedMaps,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

await serveStdio(() => server);
