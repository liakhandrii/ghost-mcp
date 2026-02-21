import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GHOST_API_URL } from "../config";
import { execFile } from "child_process";

async function safariRequest(url: string, method = "GET", body?: string): Promise<any> {
  let js: string;
  if (body) {
    js = `(function(){var x=new XMLHttpRequest();x.open("${method}","${url}",false);x.setRequestHeader("Content-Type","application/json");x.withCredentials=true;x.send(${JSON.stringify(body)});return x.status+"\\n"+x.responseText;})()`;
  } else {
    js = `(function(){var x=new XMLHttpRequest();x.open("${method}","${url}",false);x.withCredentials=true;x.send();return x.status+"\\n"+x.responseText;})()`;
  }

  const escapedJs = js.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const ghostOrigin = GHOST_API_URL.replace(/\/$/, "");

  // Ensure Safari has a tab on the Ghost origin, then run the XHR
  const script = `
tell application "Safari"
  if (count of windows) = 0 then make new document
  set theTab to current tab of front window
  set tabURL to URL of theTab
  if tabURL does not start with "${ghostOrigin}" then
    set URL of theTab to "${ghostOrigin}/ghost/"
    delay 2
  end if
  return do JavaScript "${escapedJs}" in theTab
end tell
  `;

  const raw = await new Promise<string>((resolve, reject) => {
    execFile("osascript", ["-e", script], { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout.trim());
    });
  });

  const newlineIdx = raw.indexOf("\n");
  const status = parseInt(raw.substring(0, newlineIdx), 10);
  const text = raw.substring(newlineIdx + 1);

  if (status === 0) throw new Error(`Safari fetch failed: ${text}`);
  if (status === 403 || status === 401) {
    throw new Error("Not signed in to Ghost. Please sign in at " + GHOST_API_URL + "/ghost/ in Safari first.");
  }
  if (status >= 400) throw new Error(`Ghost API error ${status}: ${text}`);

  return text ? JSON.parse(text) : null;
}

const browseParams = {
  limit: z.number().optional(),
  page: z.number().optional(),
};
const readParams = { id: z.string() };
const addParams = {
  name: z.string(),
  lexical: z.union([z.string(), z.record(z.unknown())]),
};
const editParams = {
  id: z.string(),
  name: z.string().optional(),
  lexical: z.union([z.string(), z.record(z.unknown())]).optional(),
};
const deleteParams = { id: z.string() };

function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
function err(error: unknown) {
  return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }] };
}

export function registerSnippetTools(server: McpServer) {
  if (process.platform !== "darwin") return;

  server.tool("snippets_browse", "Browse Ghost CMS snippets. Requires being signed in to Ghost in Safari.", browseParams, async (args) => {
    try {
      const params = new URLSearchParams({ formats: "mobiledoc,lexical" });
      if (args.limit) params.set("limit", args.limit.toString());
      if (args.page) params.set("page", args.page.toString());
      const data = await safariRequest(`${GHOST_API_URL}/ghost/api/admin/snippets/?${params}`);
      return ok(JSON.stringify(data.snippets || [], null, 2));
    } catch (e) { return err(e); }
  });

  server.tool("snippets_read", "Read a Ghost CMS snippet by ID.", readParams, async (args) => {
    try {
      const data = await safariRequest(`${GHOST_API_URL}/ghost/api/admin/snippets/${args.id}/?formats=mobiledoc,lexical`);
      return ok(JSON.stringify(data.snippets?.[0] || data, null, 2));
    } catch (e) { return err(e); }
  });

  server.tool("snippets_add", "Create a Ghost CMS snippet.", addParams, async (args) => {
    try {
      const lexical = typeof args.lexical === "object" ? JSON.stringify(args.lexical) : args.lexical;
      const body = JSON.stringify({ snippets: [{ name: args.name, mobiledoc: "{}", lexical }] });
      const data = await safariRequest(`${GHOST_API_URL}/ghost/api/admin/snippets/`, "POST", body);
      return ok(JSON.stringify(data.snippets?.[0] || data, null, 2));
    } catch (e) { return err(e); }
  });

  server.tool("snippets_edit", "Update a Ghost CMS snippet by ID.", editParams, async (args) => {
    try {
      const existing = await safariRequest(`${GHOST_API_URL}/ghost/api/admin/snippets/${args.id}/?formats=mobiledoc,lexical`);
      const s = existing.snippets?.[0];
      if (!s) throw new Error("Snippet not found");
      const payload = {
        name: args.name ?? s.name,
        mobiledoc: s.mobiledoc,
        lexical: args.lexical !== undefined
          ? (typeof args.lexical === "object" ? JSON.stringify(args.lexical) : args.lexical)
          : s.lexical,
      };
      const data = await safariRequest(`${GHOST_API_URL}/ghost/api/admin/snippets/${args.id}/`, "PUT", JSON.stringify({ snippets: [payload] }));
      return ok(JSON.stringify(data.snippets?.[0] || data, null, 2));
    } catch (e) { return err(e); }
  });

  server.tool("snippets_delete", "Delete a Ghost CMS snippet by ID.", deleteParams, async (args) => {
    try {
      await safariRequest(`${GHOST_API_URL}/ghost/api/admin/snippets/${args.id}/`, "DELETE");
      return ok(`Snippet with ID ${args.id} has been deleted successfully.`);
    } catch (e) { return err(e); }
  });
}
