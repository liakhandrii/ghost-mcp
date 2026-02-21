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

Where the html or lexical parameter value starts with "file://", the system shall treat the remainder as an absolute file path, read the file content, and use it as the parameter value.

Where a "file://" path is provided, the system shall only accept absolute paths. If the path is not absolute, the system shall return an error. The system shall use Node.js `path.isAbsolute()` to determine whether the path is absolute.

Where a "file://" path is provided and the file does not exist or cannot be read, the system shall return an error.

The system shall support setting tags, authors, featured images, status, visibility, and SEO metadata.

### posts_edit

When the user requests to update an existing post by ID, the system shall accept updated content, metadata, or publishing settings.

Where HTML content is provided, the system shall use source: "html" to ensure Ghost processes the HTML content.

Where the html or lexical parameter value starts with "file://", the system shall treat the remainder as an absolute file path, read the file content, and use it as the parameter value.

Where a "file://" path is provided, the system shall only accept absolute paths. If the path is not absolute, the system shall return an error. The system shall use Node.js `path.isAbsolute()` to determine whether the path is absolute.

Where a "file://" path is provided and the file does not exist or cannot be read, the system shall return an error.

Where updated_at is provided, the system shall use it for conflict detection.

### posts_delete

When the user requests to delete a post by ID, the system shall permanently remove the post from Ghost.

If a post is deleted, then the system shall return a confirmation message with the deleted post ID.

## Sync Tools

### File Structure

For each post, the system shall create a directory at ghost/posts/<slug>/ containing two files:
- meta.json: All post fields except the lexical field
- lexical.json: Pretty-printed JSON parsed from the lexical field (Ghost API returns lexical as a JSON string)

### posts_sync_from_ghost

When the user requests to sync posts from Ghost to local filesystem, the system shall retrieve posts from Ghost and save them to ghost/posts/<slug>/ directories.

Where the ghost/posts/ directory does not exist, the system shall create it.

Where specific post IDs are provided, the system shall sync only those posts.

Where no post IDs are provided, the system shall sync all modified posts.

When a post exists in Ghost but not locally, the system shall create a new ghost/posts/<slug>/ directory with meta.json and lexical.json files.

When saving a post locally, the system shall parse the lexical field from a JSON string and save it as pretty-printed JSON in lexical.json.

When saving a post locally, the system shall save all fields except lexical to meta.json.

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

When the user requests to sync posts from local filesystem to Ghost, the system shall read meta.json and lexical.json files from ghost/posts/<slug>/ directories and update them in Ghost.

The system shall not create new posts in Ghost and shall direct users to use posts_add for creating new posts.

Where specific post IDs are provided, the system shall sync only those posts.

Where no post IDs are provided, the system shall sync all modified posts.

When processing local files, if meta.json contains invalid JSON, the system shall error for that specific post and skip it.

When processing local files, if lexical.json exists and contains invalid JSON, the system shall error for that specific post and skip it.

When processing local files, if meta.json is missing the id field, the system shall skip it with an info message directing the user to use posts_add to create new posts.

When processing local files, if meta.json is missing the updated_at field, the system shall error for that specific post and skip it.

When syncing to Ghost, the system shall combine meta.json fields with the lexical.json content (stringified) as the lexical field.

When syncing to Ghost, if meta.json contains a lexical field, the system shall ignore it and never send it to the Ghost API.

Where lexical.json does not exist, the system shall not include a lexical field when syncing to Ghost.

When processing a local post with an id field, if the post is not found in Ghost (404), the system shall skip it with a warning that the post may have been deleted from Ghost.

When syncing a local post to Ghost, if the local updated_at does not match Ghost updated_at, the system shall error for that specific post and prompt the user to sync from Ghost first.

When comparing a local post with Ghost, if the local updated_at equals Ghost updated_at and content is identical, the system shall skip that post.

The system shall use optimistic locking by requiring local updated_at to match Ghost updated_at before writing.

The system shall return a sync report showing synced count, skipped count, and errors with post IDs and titles.
