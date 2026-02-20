// src/tools/roles.ts
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
  name: z.string().optional(),
};

export function registerRoleTools(server: McpServer) {
  // Browse roles
  server.tool(
    "roles_browse",
    "Browse and list available staff roles with their permissions and descriptions. Roles define what staff users can access and modify in Ghost Admin including Owner, Administrator, Editor, Author, and Contributor levels. Note: This may use undocumented Ghost API endpoints.",
    browseParams,
    async (args, _extra) => {
      const roles = await ghostApiClient.roles.browse(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(roles, null, 2),
          },
        ],
      };
    }
  );

  // Read role
  server.tool(
    "roles_read",
    "Read a specific staff role by ID to get detailed information about permissions and capabilities. Returns role name, description, and permission levels for accessing different Ghost Admin features. Note: This may use undocumented Ghost API endpoints.",
    readParams,
    async (args, _extra) => {
      const role = await ghostApiClient.roles.read(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(role, null, 2),
          },
        ],
      };
    }
  );
}