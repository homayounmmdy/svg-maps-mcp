import { CDN_BASE, FETCH_CONCURRENCY, GITHUB_API_URL } from "./config.js";
import { extractMapInfo } from "./parser.js";
import type { MapInfo } from "./types.js";

interface GitHubFileEntry {
  name: string;
  type: string;
}

let cache: MapInfo[] | null = null;
let inflight: Promise<MapInfo[]> | null = null;

async function fetchMapFileList(): Promise<string[]> {
  const res = await fetch(GITHUB_API_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) {
    throw new Error(
      `GitHub API responded with ${res.status} ${res.statusText}`
    );
  }
  const entries = (await res.json()) as GitHubFileEntry[];
  return entries
    .filter((e) => e.type === "file" && e.name.endsWith(".ts"))
    .map((e) => e.name);
}

async function fetchMapContent(fileName: string): Promise<string | null> {
  const res = await fetch(`${CDN_BASE}/${fileName}`);
  if (!res.ok) {
    console.warn(
      `[svg-world-maps] Failed to fetch ${fileName}: ${res.status}`
    );
    return null;
  }
  return res.text();
}

async function loadCatalog(): Promise<MapInfo[]> {
  const fileNames = await fetchMapFileList();
  const catalog: MapInfo[] = [];

  for (let i = 0; i < fileNames.length; i += FETCH_CONCURRENCY) {
    const batch = fileNames.slice(i, i + FETCH_CONCURRENCY);
    const contents = await Promise.all(
      batch.map(async (fileName) => ({
        fileName,
        text: await fetchMapContent(fileName),
      }))
    );

    for (const { fileName, text } of contents) {
      if (text !== null) catalog.push(extractMapInfo(text, fileName));
    }
  }

  return catalog;
}

export function getMapCatalog(): Promise<MapInfo[]> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;

  inflight = loadCatalog()
    .then((catalog) => {
      cache = catalog;
      return catalog;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}