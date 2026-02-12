# WebMCP — Complete Knowledge Base & Project Guide

## What is WebMCP?

**WebMCP** (Web Model Context Protocol) is a browser API that lets websites expose structured, callable tools to AI agents. Published as a **W3C Draft Community Group Report on February 10, 2026**, it brings Anthropic's Model Context Protocol (MCP) into the browser.

The core problem it solves: instead of AI agents scraping the DOM, taking screenshots, and clicking buttons like a robot to interact with websites, WebMCP lets developers **explicitly declare** what actions are available, what parameters they accept, and how to execute them — all through a standardized JavaScript API.

### The Key Insight

> Businesses near-universally already offer their services via the web. WebMCP enables incremental integration without architectural changes, allowing authors to serve humans and agents from one source.

## MCP vs WebMCP

These are **complementary**, not competing:

| | MCP | WebMCP |
|---|-----|--------|
| **Where** | Backend / server-side | Browser / client-side |
| **Communication** | Server-to-agent (stdio, SSE, HTTP) | In-page JavaScript |
| **Authentication** | API keys, tokens | User's existing browser session |
| **Context** | Headless, no user present | User is present, shared visual context |
| **Use when** | Agent talks to your backend directly | Interaction happens in the browser |
| **Lifecycle** | Persistent server | Tools available only while page is loaded |

## API Surface

### Entry Point

```js
navigator.modelContext  // Returns the ModelContext interface
```

### ModelContext Interface

| Method | Purpose |
|--------|---------|
| `provideContext(options)` | Register tools (clears any pre-existing ones) |
| `clearContext()` | Remove all registered tools |
| `registerTool(tool)` | Add a single tool without clearing existing set |
| `unregisterTool(name)` | Remove a specific tool by name |

### ModelContextTool Dictionary

Each tool is an object with these properties:

```js
{
  name: "tool_name",           // Required — unique identifier
  description: "...",          // Required — natural language explanation for the agent
  inputSchema: { ... },        // JSON Schema describing accepted parameters
  execute: async (input, agent) => { ... },  // Required — the function the agent calls
  annotations: {               // Optional metadata
    readOnlyHint: true/false   // Tells agents whether this tool modifies state
  }
}
```

### ModelContextClient (the `agent` parameter)

The second argument passed to `execute()` represents the calling agent:

| Method | Purpose |
|--------|---------|
| `requestUserInteraction(callback)` | Pause agent execution to ask the user for input/consent |

### ModelContextOptions

```js
{
  tools: [ ...arrayOfModelContextTool ]
}
```

### Return Format

Tools should return structured content:

```js
{
  content: [
    { type: "text", text: "Result message here" }
  ]
}
```

## Implementation Patterns

### 1. Basic Tool Registration (Declarative Batch)

```js
if ("modelContext" in navigator) {
  navigator.modelContext.provideContext({
    tools: [
      {
        name: "add_to_cart",
        description: "Add a product to the shopping cart by its product ID and quantity",
        inputSchema: {
          type: "object",
          properties: {
            productId: { type: "string", description: "Product identifier" },
            quantity: { type: "number", description: "Items to add" }
          },
          required: ["productId", "quantity"]
        },
        async execute({ productId, quantity }) {
          const response = await fetch("/api/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId, quantity })
          });
          const result = await response.json();
          return { content: [{ type: "text", text: `Added ${quantity}x ${productId}. Cart total: ${result.total}` }] };
        }
      }
    ]
  });
}
```

### 2. Individual Tool Management

```js
// Add a tool without clearing existing ones
navigator.modelContext.registerTool({
  name: "search_products",
  description: "Search the product catalog",
  inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  async execute({ query }) { /* ... */ }
});

// Remove a specific tool
navigator.modelContext.unregisterTool("search_products");

// Clear everything
navigator.modelContext.clearContext();
```

### 3. Human-in-the-Loop with `requestUserInteraction`

For destructive or sensitive actions, pause and ask the user:

```js
async execute({ product_id }, agent) {
  const confirmed = await agent.requestUserInteraction(async () => {
    return new Promise((resolve) => {
      const confirmed = confirm(`Buy product ${product_id}?`);
      resolve(confirmed);
    });
  });

  if (!confirmed) {
    throw new Error("Purchase cancelled by user.");
  }

  executePurchase(product_id);
  return { content: [{ type: "text", text: `Product ${product_id} purchased.` }] };
}
```

### 4. Feature Detection with Polyfill Fallback

```js
if ("modelContext" in navigator) {
  // Native WebMCP (Chrome 146+ Canary with flag enabled)
  navigator.modelContext.provideContext({ tools });
} else if (window.modelContext) {
  // MCP-B browser extension polyfill
  window.modelContext.provideContext({ tools });
} else {
  // No support — expose tools for manual testing
  window.__webmcp_tools = {};
  for (const tool of tools) {
    window.__webmcp_tools[tool.name] = tool.execute;
  }
}
```

### 5. Dynamic Tool Updates

`provideContext()` can be called repeatedly to update the available tool set as application state changes (e.g., user logs in, navigates to a new section, etc.):

```js
// Initial state
navigator.modelContext.provideContext({ tools: [browseTools] });

// After user logs in, add account tools
navigator.modelContext.provideContext({ tools: [...browseTools, ...accountTools] });
```

## Important Technical Details

- **Execution model**: Tool calls run sequentially, one at a time, on the main thread
- **Async support**: `execute()` can return Promises for long-running operations
- **Security**: Requires **Secure Context** (HTTPS) — the `[SecureContext]` attribute is on all interfaces
- **Session sharing**: Tools inherit the user's existing browser session, cookies, and permissions — no separate auth needed
- **Lifecycle**: Tools are only available while the page is loaded; they don't persist
- **State updates**: Pages must manually update their UI after tool execution (the API doesn't auto-reflect changes)

## What WebMCP is NOT

These are explicit **non-goals** from the spec:

- **Not for headless browsing** — it assumes a user is present
- **Not for fully autonomous agents** — human-in-the-loop is a design principle
- **Not a replacement for backend MCP** — use MCP for server-side, WebMCP for browser-side
- **Not a replacement for human interfaces** — it augments, doesn't replace

## Use Case Scenarios (from the spec)

### Creative/Design
User delegates repetitive design tasks to an agent in a design tool. The agent calls tools like `apply_filter`, `resize_canvas`, `add_layer` while the user retains final creative control.

### Shopping
Agent filters and curates product selections based on complex natural language criteria like "find me running shoes under $100 with good arch support" using tools like `search_products`, `filter_by`, `add_to_cart`.

### Code Review
Agent analyzes test failures and suggests code modifications in a code review interface using tools like `get_diff`, `get_test_results`, `suggest_fix`.

## Browser Support (as of Feb 2026)

| Browser | Status |
|---------|--------|
| Chrome 146+ Canary | Early preview behind `chrome://flags/#web-mcp` flag |
| Other browsers | Not yet — use MCP-B polyfill |

## Related Projects

- **[MCP-B](https://github.com/nichochar/mcp-b)** — Open-source browser extension that polyfills `navigator.modelContext`, extending MCP with browser-specific transports for tab and extension communication. Works across browsers today.

---

## This Demo Project

### Architecture

Single-page vanilla HTML/CSS/JS application — no build tools, no frameworks.

```
webmcp-demo/
├── index.html    # Page structure
├── style.css     # Dark-themed UI
├── app.js        # App logic + WebMCP tool registration
├── AGENTS.md     # This file (full WebMCP knowledge base)
└── CLAUDE.md     # Points here via @AGENTS.md
```

### Tools Exposed

| Tool | Description | Params | Read-only | Notable |
|------|-------------|--------|-----------|---------|
| `add_note` | Create a new note | `title`, `content`, `tag?` | No | — |
| `list_notes` | Return all stored notes | — | Yes | — |
| `search_notes` | Filter notes by query string | `query` | Yes | — |
| `delete_note` | Remove a note by ID | `id` | No | Uses `requestUserInteraction` for consent |
| `get_stats` | Note count and tag breakdown | — | Yes | Uses `annotations.readOnlyHint: true` |

### How to Test

**Any browser (console fallback):**
```js
await window.__webmcp_tools.add_note({ title: "Test", content: "Hello!" })
await window.__webmcp_tools.list_notes({})
await window.__webmcp_tools.search_notes({ query: "test" })
await window.__webmcp_tools.get_stats({})
await window.__webmcp_tools.delete_note({ id: 1 })
```

**Chrome 146+ Canary (native):**
1. Go to `chrome://flags/#web-mcp` and enable
2. Restart browser
3. Open the demo — status badge turns green

**MCP-B polyfill:**
1. Install the [MCP-B browser extension](https://github.com/nichochar/mcp-b)
2. Open the demo — status badge turns yellow

### Development Guidelines

- Keep the project dependency-free (vanilla JS only)
- All state is in-memory (no persistence needed for a demo)
- The tool call log in the UI provides observability — every agent invocation appears there
- When adding new tools, follow the existing pattern: define the core function, then wrap it as a WebMCP tool with proper `inputSchema` and `execute`

## References

- [W3C WebMCP Spec](https://webmachinelearning.github.io/webmcp/)
- [WebMCP GitHub](https://github.com/webmachinelearning/webmcp)
- [WebMCP Proposal](https://github.com/webmachinelearning/webmcp/blob/main/docs/proposal.md)
- [WebMCP Official Site](https://webmcp.dev/)
- [MCP-B Polyfill](https://github.com/nichochar/mcp-b)
- [Chrome's WebMCP makes AI agents stop pretending — Medium](https://medium.com/reading-sh/chromes-webmcp-makes-ai-agents-stop-pretending-e8c7da1ba650)
- [WebMCP: Making the web AI-agent ready — iO](https://techhub.iodigital.com/articles/web-mcp-making-the-web-ai-agent-ready)
- [Google previews WebMCP — Search Engine Land](https://searchengineland.com/google-releases-preview-of-webmcp-how-ai-agents-interact-with-websites-469024)
