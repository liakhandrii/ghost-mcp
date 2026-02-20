// src/tools/newsletters.ts
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
  slug: z.string().optional(),
};
const addParams = {
  name: z.string(),
  description: z.string().optional(),
  sender_reply_to: z.string().optional(),
  status: z.string().optional(),
  subscribe_on_signup: z.boolean().optional(),
  show_header_icon: z.boolean().optional(),
  show_header_title: z.boolean().optional(),
  show_header_name: z.boolean().optional(),
  title_font_category: z.string().optional(),
  title_alignment: z.string().optional(),
  show_feature_image: z.boolean().optional(),
  body_font_category: z.string().optional(),
  show_badge: z.boolean().optional(),
  // Add more fields as needed
};
const editParams = {
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  sender_name: z.string().optional(),
  sender_email: z.string().optional(),
  sender_reply_to: z.string().optional(),
  status: z.string().optional(),
  subscribe_on_signup: z.boolean().optional(),
  sort_order: z.number().optional(),
  header_image: z.string().optional(),
  show_header_icon: z.boolean().optional(),
  show_header_title: z.boolean().optional(),
  title_font_category: z.string().optional(),
  title_alignment: z.string().optional(),
  show_feature_image: z.boolean().optional(),
  body_font_category: z.string().optional(),
  footer_content: z.string().optional(),
  show_badge: z.boolean().optional(),
  show_header_name: z.boolean().optional(),
  // Add more fields as needed
};
const deleteParams = {
  id: z.string(),
};

export function registerNewsletterTools(server: McpServer) {
  // Browse newsletters
  server.tool(
    "newsletters_browse",
    "Browse and list newsletters with filtering and pagination options. Newsletters define email publication settings and branding for sending posts to subscribers. Supports filtering by status and visibility. Reference: https://docs.ghost.org/admin-api/newsletters",
    browseParams,
    async (args, _extra) => {
      const newsletters = await ghostApiClient.newsletters.browse(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(newsletters, null, 2),
          },
        ],
      };
    }
  );

  // Read newsletter
  server.tool(
    "newsletters_read",
    "Read a specific newsletter by ID. Returns complete newsletter data including name, description, sender settings, design options, and subscriber preferences. Use this to get detailed information about a single newsletter. Reference: https://docs.ghost.org/admin-api/newsletters",
    readParams,
    async (args, _extra) => {
      const newsletter = await ghostApiClient.newsletters.read(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(newsletter, null, 2),
          },
        ],
      };
    }
  );

  // Add newsletter
  server.tool(
    "newsletters_add",
    "Create a new newsletter with name and email settings. Newsletters define how posts are sent to subscribers including sender name, reply-to address, and design preferences. Can configure header, footer, and subscription settings. Reference: https://docs.ghost.org/admin-api/newsletters",
    addParams,
    async (args, _extra) => {
      const newsletter = await ghostApiClient.newsletters.add(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(newsletter, null, 2),
          },
        ],
      };
    }
  );

  // Edit newsletter
  server.tool(
    "newsletters_edit",
    "Update an existing newsletter by ID with new settings or design options. Can modify newsletter name, sender details, design preferences, and subscription settings. Use updated_at for conflict detection. Reference: https://docs.ghost.org/admin-api/newsletters",
    editParams,
    async (args, _extra) => {
      const newsletter = await ghostApiClient.newsletters.edit(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(newsletter, null, 2),
          },
        ],
      };
    }
  );

  // Delete newsletter
  server.tool(
    "newsletters_delete",
    "Permanently delete a newsletter by ID. This removes the newsletter configuration and may affect email sending for associated posts. Note: The Ghost API may not support newsletter deletion - this tool may return an error. Reference: https://docs.ghost.org/admin-api/newsletters",
    deleteParams,
    async (args, _extra) => {
      await ghostApiClient.newsletters.delete(args);
      return {
        content: [
          {
            type: "text",
            text: `Newsletter with id ${args.id} deleted.`,
          },
        ],
      };
    }
  );
}