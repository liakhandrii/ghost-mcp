// src/tools/tags.ts
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
  slug: z.string().optional(),
  // Add more fields as needed
};
const editParams = {
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  slug: z.string().optional(),
  // Add more fields as needed
};
const deleteParams = {
  id: z.string(),
};

export function registerTagTools(server: McpServer) {
  // Browse tags
  server.tool(
    "tags_browse",
    "Browse and list tags with essential fields optimized for listing and discovery. Returns lightweight tag data including name, slug, and visibility. Use tags_read for full tag details including descriptions and metadata. Reference: https://docs.ghost.org/admin-api (tags endpoint)",
    browseParams,
    async (args, _extra) => {
      // Optimize browse to return only essential fields for listing
      const optimizedArgs = {
        ...args,
        fields: 'id,name,slug,visibility,created_at,updated_at'
      };
      const tags = await ghostApiClient.tags.browse(optimizedArgs);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tags, null, 2),
          },
        ],
      };
    }
  );

  // Read tag
  server.tool(
    "tags_read",
    "Read a specific tag by ID or slug. Returns complete tag data including name, description, metadata, and usage statistics. Use this to get detailed information about a single tag. Reference: https://docs.ghost.org/admin-api (tags endpoint)",
    readParams,
    async (args, _extra) => {
      const tag = await ghostApiClient.tags.read(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tag, null, 2),
          },
        ],
      };
    }
  );

  // Add tag
  server.tool(
    "tags_add",
    "Create a new tag with name and optional metadata. Tags help organize and categorize posts for better content discovery. Can set description, color, visibility, and SEO metadata. Reference: https://docs.ghost.org/admin-api (tags endpoint)",
    addParams,
    async (args, _extra) => {
      const tag = await ghostApiClient.tags.add(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tag, null, 2),
          },
        ],
      };
    }
  );

  // Edit tag
  server.tool(
    "tags_edit",
    "Update an existing tag by ID with new information or metadata. Can modify tag name, description, color, visibility, and SEO settings. Use updated_at for conflict detection. Reference: https://docs.ghost.org/admin-api (tags endpoint)",
    editParams,
    async (args, _extra) => {
      const tag = await ghostApiClient.tags.edit(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tag, null, 2),
          },
        ],
      };
    }
  );

  // Delete tag
  server.tool(
    "tags_delete",
    "Permanently delete a tag by ID. This removes the tag from your Ghost site and unassigns it from all posts. This action cannot be undone. Reference: https://docs.ghost.org/admin-api (tags endpoint)",
    deleteParams,
    async (args, _extra) => {
      await ghostApiClient.tags.delete(args);
      return {
        content: [
          {
            type: "text",
            text: `Tag with id ${args.id} deleted.`,
          },
        ],
      };
    }
  );
}