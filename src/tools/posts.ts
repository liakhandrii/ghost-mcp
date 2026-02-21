// src/tools/posts.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";
import * as fs from "fs/promises";
import * as path from "path";
import MarkdownIt from "markdown-it";
import { NodeHtmlMarkdown } from "node-html-markdown";

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
  markdown: z.string().optional(),
  status: z.string().optional(),
};
const editParams = {
  id: z.string(),
  title: z.string().optional(),
  html: z.string().optional(),
  lexical: z.string().optional(),
  markdown: z.string().optional(),
  status: z.string().optional(),
  updated_at: z.string(),
};
const deleteParams = {
  id: z.string(),
};
const syncFromGhostParams = {
  ids: z.array(z.string()).optional(),
  format: z.enum(["lexical", "html", "markdown"]).optional(),
};
const syncToGhostParams = {
  ids: z.array(z.string()).optional(),
  format: z.enum(["lexical", "html", "markdown"]).optional(),
};

// Markdown conversion functions
function ghostHtmlToMarkdown(html: string): string {
  const cards: string[] = [];
  const prepped = html.replace(
    /<!--kg-card-begin: html-->([\s\S]*?)<!--kg-card-end: html-->/g,
    (m, content) => {
      cards.push(content.trim());
      return '<p>GHOSTCARDPLACEHOLDER' + (cards.length - 1) + '</p>';
    }
  );

  let md = NodeHtmlMarkdown.translate(prepped);

  cards.forEach((c, i) => {
    md = md.replace(
      'GHOSTCARDPLACEHOLDER' + i,
      '\n<!--kg-card-begin: html-->\n' + c + '\n<!--kg-card-end: html-->\n'
    );
  });

  return md;
}

function markdownToGhostHtml(markdown: string): string {
  const md = new MarkdownIt({ html: true });
  // Disable automatic header ID generation to match test expectations
  md.disable(['linkify']);
  return md.render(markdown);
}

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
      const post = await ghostApiClient.posts.read(args, { formats: "html" });
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
    "Create a new post with title, content, and metadata. Supports HTML, Lexical, and Markdown content formats, along with publishing options like status, visibility, and scheduling. Can set tags, authors, featured images, and SEO metadata. Reference: https://docs.ghost.org/admin-api/posts",
    addParams,
    async (args, _extra) => {
      try {
        const resolved = { ...args };
        if (args.html !== undefined) resolved.html = await resolveFileParam(args.html);
        if (args.lexical !== undefined) resolved.lexical = await resolveFileParam(args.lexical);
        if (args.markdown !== undefined) resolved.markdown = await resolveFileParam(args.markdown);
        
        // Convert markdown to HTML if provided
        if (resolved.markdown) {
          resolved.html = markdownToGhostHtml(resolved.markdown);
          delete resolved.markdown;
        }
        
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
    "Update an existing post by ID with new content, metadata, or publishing settings. Supports updating title, content (HTML, Lexical, or Markdown), tags, authors, status, and all other post properties. Use updated_at for conflict detection. Reference: https://docs.ghost.org/admin-api/posts",
    editParams,
    async (args, _extra) => {
      try {
        const resolved = { ...args };
        if (args.html !== undefined) resolved.html = await resolveFileParam(args.html);
        if (args.lexical !== undefined) resolved.lexical = await resolveFileParam(args.lexical);
        if (args.markdown !== undefined) resolved.markdown = await resolveFileParam(args.markdown);
        
        // Convert markdown to HTML if provided
        if (resolved.markdown) {
          resolved.html = markdownToGhostHtml(resolved.markdown);
          delete resolved.markdown;
        }
        
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
    "Sync posts from Ghost to local filesystem (ghost/posts/<slug>/ directories). Downloads posts as meta.json and content files (lexical.json, html.html, or markdown.md). Supports syncing specific post IDs or all modified posts.",
    syncFromGhostParams,
    async (args, _extra) => {
      const postsDir = "ghost/posts";
      const format = args.format || "lexical";
      const isHtml = format === "html";
      const isMarkdown = format === "markdown";
      const contentField = isHtml || isMarkdown ? "html" : "lexical";
      const contentFile = isMarkdown ? "markdown.md" : (isHtml ? "html.html" : "lexical.json");
      const report = { synced: 0, skipped: 0, errors: [] as any[] };

      try {
        const browseOpts: any = { limit: "all" };
        if (isHtml || isMarkdown) browseOpts.formats = "html";
        const ghostPosts = args.ids
          ? await Promise.all(args.ids.map(id => ghostApiClient.posts.read({ id }, (isHtml || isMarkdown) ? { formats: "html" } : undefined)))
          : await ghostApiClient.posts.browse(browseOpts);
        
        const posts = Array.isArray(ghostPosts) ? ghostPosts : [ghostPosts];

        for (const post of posts) {
          try {
            const postDir = path.join(postsDir, post.slug);
            const metaPath = path.join(postDir, "meta.json");
            const contentPath = path.join(postDir, contentFile);
            let shouldSync = false;

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
                const { [contentField]: ghostContent, ...ghostMeta } = post as any;
                let ghostContentParsed: any;
                if (isMarkdown) {
                  ghostContentParsed = ghostContent ? ghostHtmlToMarkdown(ghostContent) : "";
                } else if (isHtml) {
                  ghostContentParsed = ghostContent || "";
                } else {
                  ghostContentParsed = ghostContent ? JSON.parse(ghostContent) : null;
                }
                
                let localContent: any = null;
                try {
                  const raw = await fs.readFile(contentPath, "utf-8");
                  localContent = (isHtml || isMarkdown) ? raw : JSON.parse(raw);
                } catch (err: any) {
                  if (err.code !== "ENOENT") throw err;
                }

                if (JSON.stringify(localMeta) !== JSON.stringify(ghostMeta) || 
                    ((isHtml || isMarkdown) ? localContent !== ghostContentParsed : JSON.stringify(localContent) !== JSON.stringify(ghostContentParsed))) {
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
              const { [contentField]: content, ...meta } = post as any;
              await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
              if (content) {
                if (isMarkdown) {
                  await fs.writeFile(contentPath, ghostHtmlToMarkdown(content));
                } else if (isHtml) {
                  await fs.writeFile(contentPath, content);
                } else {
                  await fs.writeFile(contentPath, JSON.stringify(JSON.parse(content), null, 2));
                }
              }
              report.synced++;
            }
          } catch (err: any) {
            report.errors.push({ id: post.id, title: post.title, error: err.message });
          }
        }

        const output: Record<string, any> = { synced: report.synced, skipped: report.skipped };
        if (report.errors.length > 0) output.errors = report.errors;
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] };
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
      const format = args.format || "lexical";
      const isHtml = format === "html";
      const isMarkdown = format === "markdown";
      const contentField = isHtml || isMarkdown ? "html" : "lexical";
      const contentFile = isMarkdown ? "markdown.md" : (isHtml ? "html.html" : "lexical.json");
      const report = { synced: 0, skipped: 0, errors: [] as any[], info: [] as any[] };

      try {
        const slugs = await fs.readdir(postsDir);

        for (const slug of slugs) {
          const postDir = path.join(postsDir, slug);
          const metaPath = path.join(postDir, "meta.json");
          const contentPath = path.join(postDir, contentFile);

          try {
            const metaContent = await fs.readFile(metaPath, "utf-8");
            const localMeta = JSON.parse(metaContent);

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

            // Read content file if exists
            let localContent: any = null;
            try {
              const raw = await fs.readFile(contentPath, "utf-8");
              if (isHtml || isMarkdown) {
                localContent = raw;
              } else {
                localContent = JSON.parse(raw);
              }
            } catch (err: any) {
              if (err.code !== "ENOENT") {
                if (err instanceof SyntaxError) {
                  report.errors.push({ id: localMeta.id, title: localMeta.title, error: `Invalid JSON in ${contentFile}` });
                  continue;
                }
                throw err;
              }
              // For markdown format, if markdown.md doesn't exist, we'll check later if there are other changes
            }

            // Fetch from Ghost
            let ghostPost;
            try {
              ghostPost = await ghostApiClient.posts.read({ id: localMeta.id }, (isHtml || isMarkdown) ? { formats: "html" } : undefined);
            } catch (err: any) {
              if (err.message?.includes("404")) {
                report.errors.push({ id: localMeta.id, title: localMeta.title, error: "Post not found in Ghost (may have been deleted)" });
                continue;
              }
              throw err;
            }

            if (localMeta.updated_at !== ghostPost.updated_at) {
              report.errors.push({ id: localMeta.id, title: localMeta.title, error: "Timestamp mismatch. Sync from Ghost first." });
              continue;
            }

            // Compare content
            const { [contentField]: ghostContent, ...ghostMeta } = ghostPost as any;
            let ghostContentParsed: any;
            if (isMarkdown) {
              ghostContentParsed = ghostContent ? ghostHtmlToMarkdown(ghostContent) : "";
            } else if (isHtml) {
              ghostContentParsed = ghostContent || "";
            } else {
              ghostContentParsed = ghostContent ? JSON.parse(ghostContent) : null;
            }
            
            // Strip content field from local meta for comparison
            const { [contentField]: _ignored, ...localMetaClean } = localMeta as any;

            const hasMetaChanges = JSON.stringify(localMetaClean) !== JSON.stringify(ghostMeta);
            const hasContentChanges = localContent != null && 
              ((isHtml || isMarkdown) ? localContent !== ghostContentParsed : JSON.stringify(localContent) !== JSON.stringify(ghostContentParsed));

            if (!hasMetaChanges && !hasContentChanges) {
              // If no changes and markdown.md is missing for markdown format, error
              if (isMarkdown && localContent == null) {
                report.errors.push({ id: localMeta.id, title: localMeta.title, error: "markdown.md does not exist" });
                continue;
              }
              report.skipped++;
              continue;
            }

            // Build update payload — strip content field from meta
            const { [contentField]: _stripped, ...metaWithoutContent } = localMeta as any;
            const updatePayload: any = { ...metaWithoutContent };
            if (localContent != null) {
              if (isMarkdown) {
                updatePayload.html = markdownToGhostHtml(localContent);
              } else if (isHtml) {
                updatePayload.html = localContent;
              } else {
                updatePayload.lexical = JSON.stringify(localContent);
              }
            }

            const editOpts = (isHtml || isMarkdown) ? { source: "html" } : undefined;
            await ghostApiClient.posts.edit(updatePayload, editOpts);
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
        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] };
      } catch (err: any) {
        throw new Error(`Sync failed: ${err.message}`);
      }
    }
  );
}