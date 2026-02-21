// src/tools/posts.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";
import * as fs from "fs/promises";
import * as path from "path";

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
const syncFromGhostParams = {
  ids: z.array(z.string()).optional(),
};
const syncToGhostParams = {
  ids: z.array(z.string()).optional(),
};

async function resolveFileParam(value: string | undefined): Promise<string | undefined> {
  if (!value?.startsWith("file://")) return value;
  const filePath = value.slice(7);
  if (!path.isAbsolute(filePath)) throw new Error(`file:// path must be absolute: ${filePath}`);
  return await fs.readFile(filePath, "utf-8");
}

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
      try {
        const resolved = { ...args };
        if (args.html !== undefined) resolved.html = await resolveFileParam(args.html);
        if (args.lexical !== undefined) resolved.lexical = await resolveFileParam(args.lexical);
        const options: Record<string, string> = {};
        if (resolved.html) options.source = "html";
        if (resolved.html) options.formats = "html";
        const post = await ghostApiClient.posts.add(resolved, Object.keys(options).length ? options : undefined);
        return { content: [{ type: "text", text: JSON.stringify(post, null, 2) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text", text: err.message }] };
      }
    }
  );

  // Edit post
  server.tool(
    "posts_edit",
    "Update an existing post by ID with new content, metadata, or publishing settings. Supports updating title, content, tags, authors, status, and all other post properties. Use updated_at for conflict detection. Reference: https://docs.ghost.org/admin-api/posts",
    editParams,
    async (args, _extra) => {
      try {
        const resolved = { ...args };
        if (args.html !== undefined) resolved.html = await resolveFileParam(args.html);
        if (args.lexical !== undefined) resolved.lexical = await resolveFileParam(args.lexical);
        const options: Record<string, string> = {};
        if (resolved.html) options.source = "html";
        if (resolved.html) options.formats = "html";
        const post = await ghostApiClient.posts.edit(resolved, Object.keys(options).length ? options : undefined);
        return { content: [{ type: "text", text: JSON.stringify(post, null, 2) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text", text: err.message }] };
      }
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

  // Sync from Ghost
  server.tool(
    "posts_sync_from_ghost",
    "Sync posts from Ghost to local filesystem (ghost/posts/<slug>/ directories). Downloads posts as meta.json and lexical.json files. Supports syncing specific post IDs or all modified posts.",
    syncFromGhostParams,
    async (args, _extra) => {
      const postsDir = "ghost/posts";
      const report = { synced: 0, skipped: 0, errors: [] as any[] };

      try {
        // Fetch posts from Ghost
        const ghostPosts = args.ids
          ? await Promise.all(args.ids.map(id => ghostApiClient.posts.read({ id })))
          : await ghostApiClient.posts.browse({ limit: "all" });
        
        const posts = Array.isArray(ghostPosts) ? ghostPosts : [ghostPosts];

        for (const post of posts) {
          try {
            const postDir = path.join(postsDir, post.slug);
            const metaPath = path.join(postDir, "meta.json");
            const lexicalPath = path.join(postDir, "lexical.json");
            let shouldSync = false;

            // Check if local files exist
            try {
              const localMetaContent = await fs.readFile(metaPath, "utf-8");
              const localMeta = JSON.parse(localMetaContent);

              if (!localMeta.id || !localMeta.updated_at) {
                report.errors.push({ id: post.id, title: post.title, error: "Missing id or updated_at" });
                continue;
              }

              const localDate = new Date(localMeta.updated_at);
              const ghostDate = new Date(post.updated_at);

              if (localDate < ghostDate) {
                shouldSync = true;
              } else if (localDate.getTime() === ghostDate.getTime()) {
                // Compare content
                const { lexical: ghostLexical, ...ghostMeta } = post;
                const ghostLexicalParsed = ghostLexical ? JSON.parse(ghostLexical) : null;
                
                let localLexicalParsed = null;
                try {
                  const localLexicalContent = await fs.readFile(lexicalPath, "utf-8");
                  localLexicalParsed = JSON.parse(localLexicalContent);
                } catch (err: any) {
                  if (err.code !== "ENOENT") throw err;
                }

                if (JSON.stringify(localMeta) !== JSON.stringify(ghostMeta) || 
                    JSON.stringify(localLexicalParsed) !== JSON.stringify(ghostLexicalParsed)) {
                  report.errors.push({ id: post.id, title: post.title, error: "Conflict: same timestamp, different content" });
                  continue;
                } else {
                  report.skipped++;
                  continue;
                }
              } else {
                report.errors.push({ id: post.id, title: post.title, error: "Conflict: local is newer than Ghost" });
                continue;
              }
            } catch (err: any) {
              if (err.code === "ENOENT") {
                shouldSync = true;
              } else if (err instanceof SyntaxError) {
                report.errors.push({ id: post.id, title: post.title, error: "Invalid JSON in local file" });
                continue;
              } else {
                throw err;
              }
            }

            if (shouldSync) {
              await fs.mkdir(postDir, { recursive: true });
              
              // Separate lexical from meta
              const { lexical, ...meta } = post;
              
              // Save meta.json
              await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
              
              // Save lexical.json if lexical exists
              if (lexical) {
                const lexicalParsed = JSON.parse(lexical);
                await fs.writeFile(lexicalPath, JSON.stringify(lexicalParsed, null, 2));
              }
              
              report.synced++;
            }
          } catch (err: any) {
            report.errors.push({ id: post.id, title: post.title, error: err.message });
          }
        }

        const output: Record<string, any> = { synced: report.synced, skipped: report.skipped };
        if (report.errors.length > 0) output.errors = report.errors;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(output, null, 2),
            },
          ],
        };
      } catch (err: any) {
        throw new Error(`Sync failed: ${err.message}`);
      }
    }
  );

  // Sync to Ghost
  server.tool(
    "posts_sync_to_ghost",
    "Sync posts from local filesystem (ghost/posts/<slug>/ directories) to Ghost. Only updates existing posts. Use posts_add to create new posts. Requires local updated_at to match Ghost for optimistic locking.",
    syncToGhostParams,
    async (args, _extra) => {
      const postsDir = "ghost/posts";
      const report = { synced: 0, skipped: 0, errors: [] as any[], info: [] as any[] };

      try {
        const slugs = await fs.readdir(postsDir);

        for (const slug of slugs) {
          const postDir = path.join(postsDir, slug);
          const metaPath = path.join(postDir, "meta.json");
          const lexicalPath = path.join(postDir, "lexical.json");

          try {
            // Read meta.json
            const metaContent = await fs.readFile(metaPath, "utf-8");
            const localMeta = JSON.parse(metaContent);

            // Filter by ids if specified
            if (args.ids && localMeta.id && !args.ids.includes(localMeta.id)) {
              continue;
            }

            if (!localMeta.id) {
              report.skipped++;
              report.info.push({ slug, message: "Missing id field. Use posts_add to create new posts." });
              continue;
            }

            if (!localMeta.updated_at) {
              report.errors.push({ id: localMeta.id, title: localMeta.title, error: "Missing updated_at" });
              continue;
            }

            // Read lexical.json if exists
            let lexicalContent = null;
            try {
              const lexicalRaw = await fs.readFile(lexicalPath, "utf-8");
              lexicalContent = JSON.parse(lexicalRaw);
            } catch (err: any) {
              if (err.code !== "ENOENT") {
                if (err instanceof SyntaxError) {
                  report.errors.push({ id: localMeta.id, title: localMeta.title, error: "Invalid JSON in lexical.json" });
                  continue;
                }
                throw err;
              }
            }

            // Fetch from Ghost
            let ghostPost;
            try {
              ghostPost = await ghostApiClient.posts.read({ id: localMeta.id });
            } catch (err: any) {
              if (err.message?.includes("404")) {
                report.errors.push({ id: localMeta.id, title: localMeta.title, error: "Post not found in Ghost (may have been deleted)" });
                continue;
              }
              throw err;
            }

            // Check timestamps
            if (localMeta.updated_at !== ghostPost.updated_at) {
              report.errors.push({ id: localMeta.id, title: localMeta.title, error: "Timestamp mismatch. Sync from Ghost first." });
              continue;
            }

            // Compare content
            const { lexical: ghostLexical, ...ghostMeta } = ghostPost;
            const ghostLexicalParsed = ghostLexical ? JSON.parse(ghostLexical) : null;
            
            if (JSON.stringify(localMeta) === JSON.stringify(ghostMeta) && 
                JSON.stringify(lexicalContent) === JSON.stringify(ghostLexicalParsed)) {
              report.skipped++;
              continue;
            }

            // Prepare update payload - remove lexical from meta if present, add stringified lexical
            const { lexical: _, ...metaWithoutLexical } = localMeta as any;
            const updatePayload = lexicalContent 
              ? { ...metaWithoutLexical, lexical: JSON.stringify(lexicalContent) }
              : metaWithoutLexical;

            // Update in Ghost
            await ghostApiClient.posts.edit(updatePayload);
            report.synced++;
          } catch (err: any) {
            if (err instanceof SyntaxError) {
              report.errors.push({ slug, error: "Invalid JSON in meta.json" });
            } else {
              report.errors.push({ slug, error: err.message });
            }
          }
        }

        const output: Record<string, any> = { synced: report.synced, skipped: report.skipped };
        if (report.errors.length > 0) output.errors = report.errors;
        if (report.info.length > 0) output.info = report.info;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(output, null, 2),
            },
          ],
        };
      } catch (err: any) {
        throw new Error(`Sync failed: ${err.message}`);
      }
    }
  );
}