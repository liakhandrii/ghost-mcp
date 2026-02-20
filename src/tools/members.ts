// src/tools/members.ts
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
};
const addParams = {
  email: z.string(),
  name: z.string().optional(),
  note: z.string().optional(),
  labels: z.array(z.object({ name: z.string(), slug: z.string().optional() })).optional(),
  newsletters: z.array(z.object({ id: z.string() })).optional(),
};
const editParams = {
  id: z.string(),
  email: z.string().optional(),
  name: z.string().optional(),
  note: z.string().optional(),
  labels: z.array(z.object({ name: z.string(), slug: z.string().optional() })).optional(),
  newsletters: z.array(z.object({ id: z.string() })).optional(),
};
const deleteParams = {
  id: z.string(),
};

export function registerMemberTools(server: McpServer) {
  // Browse members
  server.tool(
    "members_browse",
    "Browse and list members with essential fields optimized for listing and discovery. Returns lightweight member data including identity, status, and engagement metrics. Use members_read for full member details including subscriptions and labels. Reference: https://docs.ghost.org/admin-api/members",
    browseParams,
    async (args, _extra) => {
      // Optimize browse to return only essential fields for listing
      const optimizedArgs = {
        ...args,
        fields: 'id,email,name,status,created_at,last_seen_at,email_count,email_open_rate'
      };
      const members = await ghostApiClient.members.browse(optimizedArgs);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(members, null, 2),
          },
        ],
      };
    }
  );

  // Read member
  server.tool(
    "members_read",
    "Read a specific member by ID or email address. Returns complete member data including subscription status, tiers, labels, and activity history. Use this to get detailed information about a single member. Reference: https://docs.ghost.org/admin-api/members",
    readParams,
    async (args, _extra) => {
      const member = await ghostApiClient.members.read(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(member, null, 2),
          },
        ],
      };
    }
  );

  // Add member
  server.tool(
    "members_add",
    "Create a new member with email address and optional metadata. Can set member name, labels, notes, and subscription preferences. Members can be created with or without sending welcome emails. Reference: https://docs.ghost.org/admin-api/members",
    addParams,
    async (args, _extra) => {
      const member = await ghostApiClient.members.add(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(member, null, 2),
          },
        ],
      };
    }
  );

  // Edit member
  server.tool(
    "members_edit",
    "Update an existing member by ID with new information or subscription details. Can modify member name, email, labels, notes, and subscription preferences. Use updated_at for conflict detection. Reference: https://docs.ghost.org/admin-api/members",
    editParams,
    async (args, _extra) => {
      const member = await ghostApiClient.members.edit(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(member, null, 2),
          },
        ],
      };
    }
  );

  // Delete member
  server.tool(
    "members_delete",
    "Permanently delete a member by ID. This removes the member from your subscriber list and cancels any active subscriptions. This action cannot be undone. Reference: https://docs.ghost.org/admin-api/members",
    deleteParams,
    async (args, _extra) => {
      await ghostApiClient.members.delete(args);
      return {
        content: [
          {
            type: "text",
            text: `Member with id ${args.id} deleted.`,
          },
        ],
      };
    }
  );
}