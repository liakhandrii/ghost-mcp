// src/tools/invites.ts
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
const addParams = {
  role_id: z.string(),
  email: z.string(),
};
const deleteParams = {
  id: z.string(),
};

export function registerInviteTools(server: McpServer) {
  // Browse invites
  server.tool(
    "invites_browse",
    "Browse and list pending staff invitations with filtering and pagination options. Invites are sent to new staff members to join your Ghost site with specific role permissions. Shows pending invitations that haven't been accepted yet. Note: This may use undocumented Ghost API endpoints.",
    browseParams,
    async (args, _extra) => {
      const invites = await ghostApiClient.invites.browse(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(invites, null, 2),
          },
        ],
      };
    }
  );

  // Add invite
  server.tool(
    "invites_add",
    "Send a new staff invitation to join your Ghost site. Creates an invitation email sent to the specified address with a role assignment for accessing Ghost Admin. The recipient can accept the invite to become a staff user. Note: This may use undocumented Ghost API endpoints.",
    addParams,
    async (args, _extra) => {
      const invite = await ghostApiClient.invites.add(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(invite, null, 2),
          },
        ],
      };
    }
  );

  // Delete invite
  server.tool(
    "invites_delete",
    "Cancel a pending staff invitation by ID. This revokes the invitation and prevents the recipient from accepting it to join your Ghost site. The invitation link becomes invalid. Note: This may use undocumented Ghost API endpoints.",
    deleteParams,
    async (args, _extra) => {
      await ghostApiClient.invites.delete(args);
      return {
        content: [
          {
            type: "text",
            text: `Invite with id ${args.id} deleted.`,
          },
        ],
      };
    }
  );
}