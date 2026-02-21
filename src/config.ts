// Read configuration values directly from process.env
export const GHOST_API_URL: string = process.env.GHOST_API_URL as string;
export const GHOST_ADMIN_API_KEY: string = process.env.GHOST_ADMIN_API_KEY as string;
export const GHOST_API_VERSION: string = process.env.GHOST_API_VERSION as string || 'v5.0'; // Default to v5.0

// Optional: session-based auth for endpoints that reject integration tokens (e.g., snippets)
export const GHOST_USERNAME: string | undefined = process.env.GHOST_USERNAME;
export const GHOST_PASSWORD: string | undefined = process.env.GHOST_PASSWORD;

// Basic validation to ensure required environment variables are set
if (!GHOST_API_URL) {
    console.error("Error: GHOST_API_URL environment variable is not set.");
    process.exit(1);
}

if (!GHOST_ADMIN_API_KEY) {
    console.error("Error: GHOST_ADMIN_API_KEY environment variable is not set.");
    process.exit(1);
}