# Posts Tools

## Overview

Tools for managing Ghost CMS posts through the MCP server.

## Tool Requirements (EARS)

### posts_browse

When the user requests to list posts, the system shall return lightweight post data including id, slug, title, url, status, visibility, featured, published_at, updated_at, excerpt, feature_image, primary_author, and primary_tag.

Where filtering is specified, the system shall apply the filter criteria to the browse operation.

Where pagination parameters are provided, the system shall return posts according to the specified limit and page.

### posts_read

When the user requests a specific post by ID or slug, the system shall return complete post data including content, metadata, tags, authors, and publishing status.

### posts_add

When the user requests to create a new post, the system shall accept title, content, and metadata parameters.

Where HTML content is provided, the system shall use source: "html" to ensure Ghost processes the HTML content.

Where Markdown content is provided via the markdown parameter, the system shall convert it to HTML using markdown-it with html: true option, then use source: "html" to upload to Ghost.

Where the html, lexical, or markdown parameter value starts with "file://", the system shall treat the remainder as an absolute file path, read the file content, and use it as the parameter value.

Where a "file://" path is provided, the system shall only accept absolute paths. If the path is not absolute, the system shall return an error. The system shall use Node.js `path.isAbsolute()` to determine whether the path is absolute.

Where a "file://" path is provided and the file does not exist or cannot be read, the system shall return an error.

The system shall support setting tags, authors, featured images, status, visibility, and SEO metadata.

### posts_edit

When the user requests to update an existing post by ID, the system shall accept updated content, metadata, or publishing settings.

Where HTML content is provided, the system shall use source: "html" to ensure Ghost processes the HTML content.

Where Markdown content is provided via the markdown parameter, the system shall convert it to HTML using markdown-it with html: true option, then use source: "html" to upload to Ghost.

Where the html, lexical, or markdown parameter value starts with "file://", the system shall treat the remainder as an absolute file path, read the file content, and use it as the parameter value.

Where a "file://" path is provided, the system shall only accept absolute paths. If the path is not absolute, the system shall return an error. The system shall use Node.js `path.isAbsolute()` to determine whether the path is absolute.

Where a "file://" path is provided and the file does not exist or cannot be read, the system shall return an error.

Where updated_at is provided, the system shall use it for conflict detection.

### posts_delete

When the user requests to delete a post by ID, the system shall permanently remove the post from Ghost.

If a post is deleted, then the system shall return a confirmation message with the deleted post ID.

## Sync Tools

### Format Parameter

Both sync tools shall accept an optional `format` parameter with allowed values `"lexical"` (default), `"html"`, and `"markdown"`.

### File Structure

For each post, the system shall create a directory at ghost/posts/<slug>/ containing two files:
- meta.json: All post fields except the content field (lexical, html, or markdown depending on format)
- When format is `"lexical"`: lexical.json — pretty-printed JSON parsed from the lexical field (Ghost API returns lexical as a JSON string)
- When format is `"html"`: html.html — the HTML content from the post's html field
- When format is `"markdown"`: markdown.md — the Markdown content converted from the post's html field using node-html-markdown with Ghost HTML card preservation

### posts_sync_from_ghost

When the user requests to sync posts from Ghost to local filesystem, the system shall retrieve posts from Ghost and save them to ghost/posts/<slug>/ directories.

Where the ghost/posts/ directory does not exist, the system shall create it.

Where specific post IDs are provided, the system shall sync only those posts.

Where no post IDs are provided, the system shall sync all modified posts.

When a post exists in Ghost but not locally, the system shall create a new ghost/posts/<slug>/ directory with meta.json and the appropriate content file (lexical.json, html.html, or markdown.md depending on format).

When format is `"lexical"`, the system shall parse the lexical field from a JSON string and save it as pretty-printed JSON in lexical.json, and save all fields except lexical to meta.json.

When format is `"html"`, the system shall pretty-print the html field and save it to html.html, and save all fields except html to meta.json.

When format is `"markdown"`, the system shall convert the html field to Markdown using node-html-markdown with Ghost HTML card preservation and save it to markdown.md, and save all fields except html to meta.json.

When syncing posts from Ghost, the system shall first download all posts to a temporary directory, then atomically replace the ghost/posts/ directory only after all downloads succeed.

If network failure occurs during sync, then the system shall abort the operation, preserve the existing ghost/posts/ directory, and return an error.

When comparing a Ghost post with local files, if meta.json contains invalid JSON, the system shall error for that specific post and skip it.

When comparing a Ghost post with local files, if meta.json is missing the id or updated_at field, the system shall error for that specific post and skip it.

When comparing a Ghost post with local files, if the local updated_at is older than Ghost updated_at, the system shall update the local files.

When comparing a Ghost post with local files, if the local updated_at equals Ghost updated_at and content differs, the system shall error for that specific post with an explanation of the conflict.

When comparing a Ghost post with local files, if the local updated_at is newer than Ghost updated_at and content differs, the system shall error for that specific post with an explanation of the conflict.

When comparing a Ghost post with local files, if the local updated_at equals Ghost updated_at and content is identical, the system shall skip that post.

If filesystem permission errors occur, then the system shall error and abort the sync operation.

The system shall return a sync report showing synced count, skipped count, and errors with post IDs and titles.

### posts_sync_to_ghost

When the user requests to sync posts from local filesystem to Ghost, the system shall read meta.json and lexical.json (or html.html when format is `"html"`, or markdown.md when format is `"markdown"`) files from ghost/posts/<slug>/ directories and update them in Ghost.

The system shall not create new posts in Ghost and shall direct users to use posts_add for creating new posts.

Where specific post IDs are provided, the system shall sync only those posts.

Where no post IDs are provided, the system shall sync all modified posts.

When processing local files, if meta.json contains invalid JSON, the system shall error for that specific post and skip it.

When format is `"lexical"` and lexical.json exists and contains invalid JSON, the system shall error for that specific post and skip it.

When format is `"markdown"` and markdown.md does not exist, the system shall error for that specific post and skip it.

When processing local files, if meta.json is missing the id field, the system shall skip it with an info message directing the user to use posts_add to create new posts.

When processing local files, if meta.json is missing the updated_at field, the system shall error for that specific post and skip it.

When format is `"lexical"`, the system shall combine meta.json fields with the lexical.json content (stringified) as the lexical field. Where lexical.json does not exist, the system shall not include a lexical field.

When format is `"html"`, the system shall combine meta.json fields with the html.html content as the html field and use source: "html". Where html.html does not exist, the system shall not include an html field.

When format is `"markdown"`, the system shall convert the markdown.md content to HTML using markdown-it with html: true option, combine meta.json fields with the converted HTML as the html field, and use source: "html". Where markdown.md does not exist, the system shall not include an html field.

When syncing to Ghost, if meta.json contains a lexical or html field, the system shall ignore it and never send it to the Ghost API.

When processing a local post with an id field, if the post is not found in Ghost (404), the system shall skip it with a warning that the post may have been deleted from Ghost.

When syncing a local post to Ghost, if the local updated_at does not match Ghost updated_at, the system shall error for that specific post and prompt the user to sync from Ghost first.

When comparing a local post with Ghost, if the local updated_at equals Ghost updated_at and content is identical, the system shall skip that post.

The system shall use optimistic locking by requiring local updated_at to match Ghost updated_at before writing.

The system shall return a sync report showing synced count, skipped count, and errors with post IDs and titles.
## Implementation Notes

### Required Dependencies

Add the following npm packages for Markdown support:
- `markdown-it` - Convert Markdown to HTML with `{ html: true }` option to preserve raw HTML blocks
- `node-html-markdown` - Convert HTML to Markdown with built-in table support and clean output

### Markdown Conversion Functions

#### HTML to Markdown (Ghost → Local)
```js
const { NodeHtmlMarkdown } = require('node-html-markdown');

function ghostHtmlToMarkdown(html) {
  const cards = [];
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
```

#### Markdown to HTML (Local → Ghost)
```js
const MarkdownIt = require('markdown-it');

function markdownToGhostHtml(markdown) {
  const md = new MarkdownIt({ html: true });
  return md.render(markdown);
}
```

### Ghost HTML Card Preservation

Ghost wraps custom HTML content in comment markers that must be preserved:
```html
<!--kg-card-begin: html-->
<section class="custom-content">...</section>
<!--kg-card-end: html-->
```

The conversion process extracts these blocks before Markdown conversion, then re-injects them to maintain Ghost's HTML card structure. This ensures lossless round-trip conversion between Ghost and Markdown formats.

### API Integration

When uploading Markdown content via posts_add or posts_edit:
1. Convert Markdown to HTML using `markdownToGhostHtml()`
2. Use `source: "html"` parameter in Ghost API call
3. Ghost will process the HTML and store internally as Lexical

When syncing from Ghost with format="markdown":
1. Retrieve HTML content from Ghost API with `?formats=html`
2. Convert HTML to Markdown using `ghostHtmlToMarkdown()`
3. Save as `markdown.md` file locally
