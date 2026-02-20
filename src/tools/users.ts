// src/tools/users.ts
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
  email: z.string().optional(),
  slug: z.string().optional(),
};
const editParams = {
  id: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  slug: z.string().optional(),
  bio: z.string().optional(),
  website: z.string().optional(),
  location: z.string().optional(),
  facebook: z.string().optional(),
  twitter: z.string().optional(),
  // Add more fields as needed
};
const deleteParams = {
  id: z.string(),
};

export function registerUserTools(server: McpServer) {
  // Browse users
  server.tool(
    "users_browse",
    "Browse and list staff users with essential fields optimized for listing and discovery. Returns lightweight user data with role information but excludes profile details and notification settings. Use users_read for full user details. Reference: https://docs.ghost.org/admin-api/users",
    browseParams,
    async (args, _extra) => {
      // Optimize browse to return only essential fields for listing
      const optimizedArgs = {
        ...args,
        fields: 'id,name,slug,email,status,last_seen,created_at,updated_at',
        include: 'roles'
      };
      const users = await ghostApiClient.users.browse(optimizedArgs);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(users, null, 2),
          },
        ],
      };
    }
  );

  // Read user
  server.tool(
    "users_read",
    "Read a specific staff user by ID or slug. Returns complete user data including name, email, role, profile information, and permissions. Use this to get detailed information about a single staff user. Reference: https://docs.ghost.org/admin-api/users",
    readParams,
    async (args, _extra) => {
      const user = await ghostApiClient.users.read(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(user, null, 2),
          },
        ],
      };
    }
  );

  // Edit user
  server.tool(
    "users_edit",
    "Update an existing staff user by ID with new profile information or settings. Can modify user name, bio, profile image, social links, and other profile details. Cannot change email or role through this endpoint. Reference: https://docs.ghost.org/admin-api/users",
    editParams,
    async (args, _extra) => {
      const user = await ghostApiClient.users.edit(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(user, null, 2),
          },
        ],
      };
    }
  );

  // Delete user
  server.tool(
    "users_delete",
    "Permanently delete a staff user by ID. This removes the user from your Ghost site and revokes their access. Note: The Ghost API may not support user deletion via integrations - this tool may return an error. Reference: https://docs.ghost.org/admin-api/users",
    deleteParams,
    async (args, _extra) => {
      await ghostApiClient.users.delete(args);
      return {
        content: [
          {
            type: "text",
            text: `User with id ${args.id} deleted.`,
          },
        ],
      };
    }
  );
}