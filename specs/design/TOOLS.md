# MCP Tools Documentation

This repository uses the **@modelcontextprotocol/sdk** library to create MCP (Model Context Protocol) tools. This document explains how to expose tools and the parameters the library accepts.

## Library Overview

The repository uses `@modelcontextprotocol/sdk` version `^1.10.1` as the core MCP library for TypeScript/Node.js applications. This SDK provides the `McpServer` class and related utilities for creating MCP servers that expose tools to AI assistants.

## Basic Tool Registration

Tools are registered using the `server.tool()` method with three required parameters:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

server.tool(
  "tool_name",           // Unique identifier (string)
  parameterSchema,       // Zod schema object defining parameters
  handlerFunction        // Async function that implements the tool
);
```

## Tool Descriptions

The MCP SDK supports tool descriptions through the tool definition metadata. While the basic `server.tool()` method doesn't directly accept a description parameter, you can provide tool descriptions using the extended tool definition format:

```typescript
// Method 1: Using tool definition object (if supported by SDK version)
server.addTool({
  name: "get_weather",
  description: "Get current weather information for a location",
  inputSchema: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "City name or zip code"
      }
    },
    required: ["location"]
  }
}, handlerFunction);

// Method 2: Description in parameter schema (current pattern in ghost-mcp)
const weatherParams = {
  location: z.string().describe("City name or zip code for weather lookup")
};

server.tool("get_weather", weatherParams, async (args) => {
  // Implementation
});
```

**Note**: The ghost-mcp repository currently uses parameter-level descriptions via `.describe()` rather than tool-level descriptions. Check your SDK version documentation for the exact method to add tool descriptions.

## Parameter Schema Definition

The library uses **Zod** for parameter validation and type safety. Parameters are defined as object literals with Zod schema validators:

```typescript
const parameterSchema = {
  requiredParam: z.string(),
  optionalParam: z.string().optional(),
  numberParam: z.number().positive(),
  enumParam: z.enum(["option1", "option2"]).default("option1"),
  arrayParam: z.array(z.string()).optional(),
  objectParam: z.object({
    nestedField: z.string(),
    nestedOptional: z.number().optional()
  }).optional()
};
```

### Supported Zod Validators

- **Basic types**: `z.string()`, `z.number()`, `z.boolean()`
- **Constraints**: `.min()`, `.max()`, `.positive()`, `.email()`, `.url()`, `.uuid()`
- **Enums**: `z.enum(["value1", "value2"])`
- **Arrays**: `z.array(z.string())`
- **Objects**: `z.object({ field: z.string() })`
- **Optional fields**: `.optional()`
- **Default values**: `.default(value)`
- **Descriptions**: `.describe("Field description")`

## Handler Function

The handler function receives validated arguments and returns a tool result:

```typescript
async (args, _extra) => {
  // args contains validated parameters matching the schema
  // _extra contains additional context (usually unused)
  
  try {
    // Implement tool logic here
    const result = await someOperation(args);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    };
  }
}
```

## Tool Result Format

Tool results must return an object with a `content` array. Each content item has a `type` and associated data:

### Text Content
```typescript
{
  content: [
    {
      type: "text",
      text: "Response text or JSON string"
    }
  ]
}
```

### Error Results
```typescript
{
  content: [
    {
      type: "text", 
      text: "Error message"
    }
  ],
  isError: true  // Indicates this is an error response
}
```

### Other Content Types
- **Image**: `{ type: "image", data: "base64-data", mimeType: "image/png" }`
- **Resource Link**: `{ type: "resource_link", uri: "file://path", name: "filename" }`

## Complete Example

Here's a complete example from the ghost-mcp repository:

```typescript
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const readParams = {
  id: z.string().optional(),
  slug: z.string().optional(),
};

export function registerPostTools(server: McpServer) {
  server.tool(
    "posts_read",
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
}
```

## Server Setup

The MCP server must be configured with capabilities and connected to a transport:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "my-mcp-server",
  version: "1.0.0",
  capabilities: {
    tools: {},        // Enable tools capability
    resources: {},    // Optional: enable resources
    prompts: {},      // Optional: enable prompts
    logging: {}       // Optional: enable logging
  }
});

// Register tools here
registerMyTools(server);

// Connect to stdio transport
async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server running on stdio");
}

startServer().catch(console.error);
```

## Tool Registration Patterns

### Modular Registration
Organize tools into separate modules and register them:

```typescript
// tools/posts.ts
export function registerPostTools(server: McpServer) {
  server.tool("posts_browse", browseParams, browsePosts);
  server.tool("posts_read", readParams, readPost);
  server.tool("posts_add", addParams, addPost);
}

// server.ts
import { registerPostTools } from "./tools/posts";
registerPostTools(server);
```

### Parameter Reuse
Define common parameter schemas for reuse:

```typescript
const browseParams = {
  filter: z.string().optional(),
  limit: z.number().optional(),
  page: z.number().optional(),
  order: z.string().optional(),
};

// Use in multiple tools
server.tool("posts_browse", browseParams, handlePostsBrowse);
server.tool("members_browse", browseParams, handleMembersBrowse);
```

## Best Practices

1. **Use descriptive tool names** following snake_case convention
2. **Provide parameter descriptions** using `.describe()` for better AI understanding
3. **Implement proper error handling** with `isError: true` flag
4. **Validate business logic** beyond schema validation
5. **Return structured JSON** for complex data
6. **Use optional parameters** with sensible defaults
7. **Group related tools** in separate modules
8. **Test tool parameters** and error conditions

## Dependencies

Required packages for MCP tool development:

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.10.1",
    "zod": "^3.24.3"
  },
  "devDependencies": {
    "@types/node": "^22.14.1",
    "typescript": "^5.8.3"
  }
}
```

## Transport Options

The SDK supports multiple transport mechanisms:

- **StdioServerTransport**: Standard input/output (most common)
- **HTTP/SSE**: Web-based transports for browser integration
- **Custom transports**: Implement your own transport layer

This documentation covers the core patterns used in the ghost-mcp repository for creating MCP tools with the TypeScript SDK.
