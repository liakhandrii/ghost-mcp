import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GHOST_API_URL } from "../config";

// Session management
let sessionCookie: string | null = null;

async function authenticate(): Promise<string> {
  const username = process.env.GHOST_USERNAME;
  const password = process.env.GHOST_PASSWORD;
  
  if (!username || !password) {
    throw new Error("Snippets require session-based authentication. Please set GHOST_USERNAME and GHOST_PASSWORD environment variables.");
  }

  const response = await fetch(`${GHOST_API_URL}/ghost/api/admin/session/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  if (!response.ok) {
    throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
  }

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('No session cookie received from authentication');
  }

  sessionCookie = setCookie.split(';')[0];
  return sessionCookie;
}

async function makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const username = process.env.GHOST_USERNAME;
  const password = process.env.GHOST_PASSWORD;
  
  if (!username || !password) {
    throw new Error("Snippets require session-based authentication. Please set GHOST_USERNAME and GHOST_PASSWORD environment variables.");
  }

  if (!sessionCookie) {
    await authenticate();
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Cookie': sessionCookie!,
    },
  });

  if (response.status === 401) {
    // Re-authenticate and retry once
    await authenticate();
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Cookie': sessionCookie!,
      },
    });
  }

  return response;
}

// Parameter schemas
const browseParams = {
  limit: z.number().optional(),
  page: z.number().optional(),
};
const readParams = {
  id: z.string(),
};
const addParams = {
  name: z.string(),
  lexical: z.union([z.string(), z.object({})]),
};
const editParams = {
  id: z.string(),
  name: z.string().optional(),
  lexical: z.union([z.string(), z.object({})]).optional(),
};
const deleteParams = {
  id: z.string(),
};

export function registerSnippetTools(server: McpServer) {
  // Browse snippets
  server.tool(
    "snippets_browse",
    "Browse and list Ghost CMS snippets with content fields. Snippets are reusable content blocks for the Ghost editor.",
    browseParams,
    async (args, _extra) => {
      try {
        const params = new URLSearchParams();
        params.append('formats', 'mobiledoc,lexical');
        if (args.limit) params.append('limit', args.limit.toString());
        if (args.page) params.append('page', args.page.toString());

        const response = await makeAuthenticatedRequest(
          `${GHOST_API_URL}/ghost/api/admin/snippets/?${params}`
        );

        if (!response.ok) {
          throw new Error(`Failed to browse snippets: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data.snippets || [], null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Read snippet
  server.tool(
    "snippets_read",
    "Read a specific Ghost CMS snippet by ID with full content fields including mobiledoc and lexical formats.",
    readParams,
    async (args, _extra) => {
      try {
        const params = new URLSearchParams();
        params.append('formats', 'mobiledoc,lexical');

        const response = await makeAuthenticatedRequest(
          `${GHOST_API_URL}/ghost/api/admin/snippets/${args.id}/?${params}`
        );

        if (!response.ok) {
          throw new Error(`Failed to read snippet: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data.snippets?.[0] || data, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Add snippet
  server.tool(
    "snippets_add",
    "Create a new Ghost CMS snippet with name and lexical content. Lexical can be provided as a string or object (will be auto-stringified).",
    addParams,
    async (args, _extra) => {
      try {
        const lexical = typeof args.lexical === 'object' ? JSON.stringify(args.lexical) : args.lexical;
        
        const response = await makeAuthenticatedRequest(
          `${GHOST_API_URL}/ghost/api/admin/snippets/`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              snippets: [{
                name: args.name,
                mobiledoc: "{}",
                lexical,
              }],
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to create snippet: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data.snippets?.[0] || data, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Edit snippet
  server.tool(
    "snippets_edit",
    "Update an existing Ghost CMS snippet by ID. Can update name and/or lexical content.",
    editParams,
    async (args, _extra) => {
      try {
        // First, read the existing snippet to get current values
        const readResponse = await makeAuthenticatedRequest(
          `${GHOST_API_URL}/ghost/api/admin/snippets/${args.id}/?formats=mobiledoc,lexical`
        );

        if (!readResponse.ok) {
          throw new Error(`Failed to read existing snippet: ${readResponse.status} ${readResponse.statusText}`);
        }

        const readData = await readResponse.json();
        const existingSnippet = readData.snippets?.[0];
        
        if (!existingSnippet) {
          throw new Error('Snippet not found');
        }

        // Merge the changes with existing data
        const payload: any = {
          name: args.name !== undefined ? args.name : existingSnippet.name,
          mobiledoc: existingSnippet.mobiledoc,
          lexical: args.lexical !== undefined 
            ? (typeof args.lexical === 'object' ? JSON.stringify(args.lexical) : args.lexical)
            : existingSnippet.lexical,
        };

        const response = await makeAuthenticatedRequest(
          `${GHOST_API_URL}/ghost/api/admin/snippets/${args.id}/`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ snippets: [payload] }),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to update snippet: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data.snippets?.[0] || data, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Delete snippet
  server.tool(
    "snippets_delete",
    "Delete a Ghost CMS snippet by ID. This permanently removes the snippet from Ghost.",
    deleteParams,
    async (args, _extra) => {
      try {
        const response = await makeAuthenticatedRequest(
          `${GHOST_API_URL}/ghost/api/admin/snippets/${args.id}/`,
          {
            method: 'DELETE',
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to delete snippet: ${response.status} ${response.statusText}`);
        }

        return {
          content: [
            {
              type: "text",
              text: `Snippet with ID ${args.id} has been deleted successfully.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
