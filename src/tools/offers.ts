// src/tools/offers.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";

// Parameter schemas as ZodRawShape (object literals)
const browseParams = {
  filter: z.string().optional(),
  limit: z.number().optional(),
  page: z.number().optional(),
  order: z.string().optional(),
};
const readParams = {
  id: z.string().optional(),
  code: z.string().optional(),
};
const addParams = {
  name: z.string(),
  code: z.string(),
  cadence: z.string(),
  duration: z.string(),
  amount: z.number(),
  tier_id: z.string(),
  type: z.string(),
  display_title: z.string().optional(),
  display_description: z.string().optional(),
  duration_in_months: z.number().optional(),
  currency: z.string().optional(),
  // Add more fields as needed
};
const editParams = {
  id: z.string(),
  name: z.string().optional(),
  code: z.string().optional(),
  display_title: z.string().optional(),
  display_description: z.string().optional(),
  // Only a subset of fields are editable per Ghost API docs
};
const deleteParams = {
  id: z.string(),
};

export function registerOfferTools(server: McpServer) {
  // Browse offers
  server.tool(
    "offers_browse",
    "Browse and list membership offers with filtering and pagination options. Offers provide discounts and promotions for membership tiers in Ghost. Supports filtering by status and tier. Reference: https://docs.ghost.org/admin-api/offers",
    browseParams,
    async (args, _extra) => {
      const offers = await ghostApiClient.offers.browse(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(offers, null, 2),
          },
        ],
      };
    }
  );

  // Read offer
  server.tool(
    "offers_read",
    "Read a specific membership offer by ID. Returns complete offer data including discount details, tier association, redemption limits, and usage statistics. Use this to get detailed information about a single offer. Reference: https://docs.ghost.org/admin-api/offers",
    readParams,
    async (args, _extra) => {
      const offer = await ghostApiClient.offers.read(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(offer, null, 2),
          },
        ],
      };
    }
  );

  // Add offer
  server.tool(
    "offers_add",
    "Create a new membership offer with discount and promotion settings. Offers provide percentage or fixed amount discounts for membership tiers with optional redemption limits and expiry dates. Can set display name and portal settings. Reference: https://docs.ghost.org/admin-api/offers",
    addParams,
    async (args, _extra) => {
      const offer = await ghostApiClient.offers.add(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(offer, null, 2),
          },
        ],
      };
    }
  );

  // Edit offer
  server.tool(
    "offers_edit",
    "Update an existing membership offer by ID with new discount settings or limits. Can modify offer name, discount amount, redemption limits, and expiry dates. Use updated_at for conflict detection. Reference: https://docs.ghost.org/admin-api/offers",
    editParams,
    async (args, _extra) => {
      const offer = await ghostApiClient.offers.edit(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(offer, null, 2),
          },
        ],
      };
    }
  );

  // Delete offer
  server.tool(
    "offers_delete",
    "Permanently delete a membership offer by ID. This removes the offer and prevents new redemptions, but existing subscriptions using the offer remain active. Note: The Ghost API may not support offer deletion - this tool may return an error. Reference: https://docs.ghost.org/admin-api/offers",
    deleteParams,
    async (args, _extra) => {
      await ghostApiClient.offers.delete(args);
      return {
        content: [
          {
            type: "text",
            text: `Offer with id ${args.id} deleted.`,
          },
        ],
      };
    }
  );
}