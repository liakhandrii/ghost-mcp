// src/tools/tiers.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";

// Parameter schemas as ZodRawShape (object literals)
const browseParams = {
  filter: z.string().optional(),
  limit: z.number().optional(),
  page: z.number().optional(),
  order: z.string().optional(),
  include: z.string().optional(),
};
const readParams = {
  id: z.string().optional(),
  slug: z.string().optional(),
  include: z.string().optional(),
};
const addParams = {
  name: z.string(),
  description: z.string().optional(),
  welcome_page_url: z.string().optional(),
  visibility: z.string().optional(),
  monthly_price: z.number().optional(),
  yearly_price: z.number().optional(),
  currency: z.string().optional(),
  benefits: z.array(z.string()).optional(),
  // Add more fields as needed
};
const editParams = {
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  welcome_page_url: z.string().optional(),
  visibility: z.string().optional(),
  monthly_price: z.number().optional(),
  yearly_price: z.number().optional(),
  currency: z.string().optional(),
  benefits: z.array(z.string()).optional(),
  // Add more fields as needed
};
const deleteParams = {
  id: z.string(),
};

export function registerTierTools(server: McpServer) {
  // Browse tiers
  server.tool(
    "tiers_browse",
    "Browse and list membership tiers with filtering and pagination options. Tiers define subscription levels and pricing for paid memberships in Ghost. Supports filtering by type and status. Reference: https://docs.ghost.org/admin-api/tiers",
    browseParams,
    async (args, _extra) => {
      const tiers = await ghostApiClient.tiers.browse(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tiers, null, 2),
          },
        ],
      };
    }
  );

  // Read tier
  server.tool(
    "tiers_read",
    "Read a specific membership tier by ID. Returns complete tier data including name, description, pricing, benefits, and configuration settings. Use this to get detailed information about a single tier. Reference: https://docs.ghost.org/admin-api/tiers",
    readParams,
    async (args, _extra) => {
      const tier = await ghostApiClient.tiers.read(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tier, null, 2),
          },
        ],
      };
    }
  );

  // Add tier
  server.tool(
    "tiers_add",
    "Create a new membership tier with pricing and benefits. Tiers define subscription levels for paid memberships including monthly/yearly pricing, trial periods, and member benefits. Can set visibility and welcome page settings. Reference: https://docs.ghost.org/admin-api/tiers",
    addParams,
    async (args, _extra) => {
      const tier = await ghostApiClient.tiers.add(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tier, null, 2),
          },
        ],
      };
    }
  );

  // Edit tier
  server.tool(
    "tiers_edit",
    "Update an existing membership tier by ID with new pricing, benefits, or settings. Can modify tier name, description, pricing, trial periods, and visibility. Use updated_at for conflict detection. Reference: https://docs.ghost.org/admin-api/tiers",
    editParams,
    async (args, _extra) => {
      const tier = await ghostApiClient.tiers.edit(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tier, null, 2),
          },
        ],
      };
    }
  );

  // Delete tier
  server.tool(
    "tiers_delete",
    "Permanently delete a membership tier by ID. This removes the tier and may affect existing member subscriptions. Note: The Ghost API may not support tier deletion - this tool may return an error. Reference: https://docs.ghost.org/admin-api/tiers",
    deleteParams,
    async (args, _extra) => {
      await ghostApiClient.tiers.delete(args);
      return {
        content: [
          {
            type: "text",
            text: `Tier with id ${args.id} deleted.`,
          },
        ],
      };
    }
  );
}