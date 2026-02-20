// src/tools/posts.ts
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
  title: z.string(),
  html: z.string().optional(),
  lexical: z.string().optional(),
  status: z.string().optional(),
};
const editParams = {
  id: z.string(),
  title: z.string().optional(),
  html: z.string().optional(),
  lexical: z.string().optional(),
  status: z.string().optional(),
  updated_at: z.string(),
};
const deleteParams = {
  id: z.string(),
};

export function registerPostTools(server: McpServer) {
  // Browse posts
  server.tool(
    "posts_browse", 
    "Browse and list posts with essential fields optimized for listing and discovery. Returns lightweight post data including title, status, dates, and primary author/tag. Use posts_read for full post details including content and complete metadata. Reference: https://docs.ghost.org/admin-api/posts",
    browseParams,
    async (args, _extra) => {
      // Optimize browse to return only essential fields for listing
      const optimizedArgs = {
        ...args,
        fields: 'id,slug,title,url,status,visibility,featured,published_at,updated_at,excerpt,feature_image',
        include: 'primary_author,primary_tag'
      };
      const posts = await ghostApiClient.posts.browse(optimizedArgs);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(posts, null, 2),
          },
        ],
      };
    }
  );

  // Read post
  server.tool(
    "posts_read",
    "Read a specific post by ID or slug. Returns complete post data including content, metadata, tags, authors, and publishing status. Use this to retrieve detailed information about a single post. Reference: https://docs.ghost.org/admin-api/posts",
    readParams,
    async (args, _extra) => {
      const post = await ghostApiClient.posts.read(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(post, null, 2),
          },
        ],
      };
    }
  );

  // Add post
  server.tool(
    "posts_add",
    "Create a new post with title, content, and metadata. Supports both HTML and Lexical content formats, along with publishing options like status, visibility, and scheduling. Can set tags, authors, featured images, and SEO metadata. Reference: https://docs.ghost.org/admin-api/posts",
    addParams,
    async (args, _extra) => {
      // If html is present, use source: "html" to ensure Ghost uses the html content
      const options = args.html ? { source: "html" } : undefined;
      const post = await ghostApiClient.posts.add(args, options);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(post, null, 2),
          },
        ],
      };
    }
  );

  // Edit post
  server.tool(
    "posts_edit",
    "Update an existing post by ID with new content, metadata, or publishing settings. Supports updating title, content, tags, authors, status, and all other post properties. Use updated_at for conflict detection. Reference: https://docs.ghost.org/admin-api/posts",
    editParams,
    async (args, _extra) => {
      // If html is present, use source: "html" to ensure Ghost uses the html content for updates
      const options = args.html ? { source: "html" } : undefined;
      const post = await ghostApiClient.posts.edit(args, options);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(post, null, 2),
          },
        ],
      };
    }
  );

  // Delete post
  server.tool(
    "posts_delete",
    "Permanently delete a post by ID. This action cannot be undone and will remove the post from your Ghost site completely. Use with caution as deleted posts cannot be recovered. Reference: https://docs.ghost.org/admin-api/posts",
    deleteParams,
    async (args, _extra) => {
      await ghostApiClient.posts.delete(args);
      return {
        content: [
          {
            type: "text",
            text: `Post with id ${args.id} deleted.`,
          },
        ],
      };
    }
  );
}