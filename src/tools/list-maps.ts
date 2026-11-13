import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { getMapCatalog } from "../map-catalog.js";
import type { MapCatalogPayload } from "../types.js";

export function registerListMapsTool(server: McpServer): void {
  server.registerTool(
    "list_maps",
    {
      description:
        "List available SVG maps, including their identifiers, names, region counts, and label support.",
      inputSchema: z.object({}),
    },
    async () => {
      const maps = await getMapCatalog();
      const payload: MapCatalogPayload = { total: maps.length, maps };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    }
  );
}