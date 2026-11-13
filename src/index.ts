import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

// Temporary catalog.
// Replace this with the complete generated map catalog.
const maps = [
  {
    id: "world",
    name: "World",
    code: "WORLD",
    regions: 195,
    supportsLabels: false,
  },
  {
    id: "afghanistan",
    name: "Afghanistan",
    code: "AF",
    regions: 34,
    supportsLabels: true,
  },
  {
    id: "germany",
    name: "Germany",
    code: "DE",
    regions: 16,
    supportsLabels: true,
  },
  {
    id: "iran",
    name: "Iran",
    code: "IR",
    regions: 31,
    supportsLabels: false,
  },
  {
    id: "usa",
    name: "United States",
    code: "USA",
    regions: 51,
    supportsLabels: false,
  },
];

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
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              total: maps.length,
              maps,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

await serveStdio(() => server);