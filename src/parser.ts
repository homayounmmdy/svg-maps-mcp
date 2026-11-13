import type { MapInfo } from "./types.js";

/** Remove block + line comments, preserving `//` inside URLs. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

function extractName(clean: string, fallback: string): string {
  const match = clean.match(/\bname\s*:\s*["']([^"']+)["']/);
  return match ? match[1] : fallback;
}

/**
 * The top-level `code` is the last `code:` before the `states` array.
 * If the file has no states, fall back to any top-level `code:`.
 */
function extractCode(clean: string): string {
  const statesIdx = clean.search(/\bstates\s*:\s*\[/);

  if (statesIdx !== -1) {
    const beforeStates = clean.slice(0, statesIdx);
    const matches = [
      ...beforeStates.matchAll(/\bcode\s*:\s*["'`]([^"'`]+)["'`]/g),
    ];
    if (matches.length > 0) {
      return matches[matches.length - 1][1];
    }
  }

  const topLevel = clean.match(/\bcode\s*:\s*["'`]([^"'`]+)["'`]/);
  return topLevel ? topLevel[1] : "N/A";
}

/**
 * Count objects at the top level of the `states: [ ... ]` array.
 * String-aware so braces inside quoted paths/names don't inflate the count.
 */
function countStates(clean: string): number {
  const match = clean.match(/\bstates\s*:\s*\[/);
  if (!match || match.index === undefined) return 0;

  const startIdx = match.index + match[0].length - 1; // index of '['
  let depth = 0;
  let count = 0;
  let inString = false;
  let stringChar = "";

  for (let i = startIdx; i < clean.length; i++) {
    const ch = clean[i];
    const prev = i > startIdx ? clean[i - 1] : "";

    if (inString) {
      if (ch === stringChar && prev !== "\\") inString = false;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      inString = true;
      stringChar = ch;
    } else if (ch === "[") {
      depth++;
    } else if (ch === "]") {
      depth--;
      if (depth === 0) return count;
    } else if (ch === "{") {
      if (depth === 1) count++;
      depth++;
    } else if (ch === "}") {
      depth--;
    }
  }

  return 0;
}

function hasLabels(clean: string): boolean {
  return /\blabels\s*:\s*\[/.test(clean);
}

export function extractMapInfo(fileContent: string, fileName: string): MapInfo {
  const id = fileName.replace(/\.ts$/i, "").toLowerCase();
  const clean = stripComments(fileContent);

  return {
    id,
    name: extractName(clean, id),
    code: extractCode(clean),
    regions: countStates(clean),
    supportsLabels: hasLabels(clean),
  };
}