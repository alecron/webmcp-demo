# WebMCP Note Manager

A minimal demo app exploring **WebMCP** (Web Model Context Protocol) — the new W3C Draft (Feb 10, 2026) that lets websites expose structured tools to AI agents via `navigator.modelContext`.

Instead of AI agents scraping your DOM and clicking buttons, you declare what actions exist and how to call them. The agent gets a clean function interface; the user stays in control.

## What's WebMCP?

WebMCP brings [Anthropic's MCP](https://modelcontextprotocol.io) into the browser. Where MCP connects agents to **backend services**, WebMCP connects agents to **in-page functionality** — reusing the user's session, auth, and visual context.

```js
// That's it. Your website now speaks to AI agents.
navigator.modelContext.provideContext({
  tools: [{
    name: "add_to_cart",
    description: "Add a product to the cart",
    inputSchema: { type: "object", properties: { productId: { type: "string" } }, required: ["productId"] },
    async execute({ productId }) {
      await cart.add(productId);
      return { content: [{ type: "text", text: `Added ${productId} to cart` }] };
    }
  }]
});
```

## Quickstart

**1. Clone and serve**

```bash
git clone https://github.com/alecron/webmcp-demo.git
cd webmcp-demo
python3 -m http.server 8080
```

**2. Open** `http://localhost:8080` in your browser.

**3. Try the tools** from the DevTools console:

```js
await window.__webmcp_tools.add_note({ title: "Hello", content: "My first note", tag: "idea" })
await window.__webmcp_tools.list_notes({})
await window.__webmcp_tools.search_notes({ query: "hello" })
await window.__webmcp_tools.get_stats({})
await window.__webmcp_tools.delete_note({ id: 1 })
```

These are the same functions that a browser AI agent would call through `navigator.modelContext` — the console fallback lets you test without Chrome Canary.

## Enabling Native WebMCP

For the real experience with an actual AI agent:

| Method | Steps |
|--------|-------|
| **Chrome 146+ Canary** | Go to `chrome://flags/#web-mcp` → Enable → Restart. Status badge turns green. |
| **MCP-B polyfill** | Install the [MCP-B extension](https://github.com/nichochar/mcp-b). Status badge turns yellow. Works in any browser. |

## Tools Exposed

This demo registers 5 tools that manage a simple in-memory note collection:

| Tool | What it does | Key params |
|------|-------------|------------|
| `add_note` | Create a note | `title`, `content`, `tag?` (idea/todo/reference/important) |
| `list_notes` | Get all notes | — |
| `search_notes` | Filter by query | `query` |
| `delete_note` | Remove by ID (asks user for consent) | `id` |
| `get_stats` | Count + tag breakdown | — |

## Key Patterns in the Code

Open `app.js` to see these WebMCP patterns in action:

- **Feature detection** — checks `navigator.modelContext`, then polyfill, then console fallback
- **`requestUserInteraction`** — `delete_note` pauses to ask the user for confirmation before proceeding
- **`annotations.readOnlyHint`** — marks `get_stats` as non-mutating so agents can call it freely
- **Structured responses** — tools return `{ content: [{ type: "text", text: "..." }] }` per the spec
- **Tool call log** — every invocation (from agent or console) is rendered in the UI for observability

## Project Structure

```
webmcp-demo/
├── index.html    # Page layout
├── style.css     # Dark-themed styling
├── app.js        # Application logic + WebMCP tool registration
├── AGENTS.md     # Full WebMCP knowledge base (API reference, patterns, spec details)
├── CLAUDE.md     # Points to AGENTS.md for AI context
└── README.md     # You are here
```

For a deep dive into the WebMCP API surface, implementation patterns, and spec details, see [AGENTS.md](AGENTS.md).

## References

- [W3C WebMCP Spec](https://webmachinelearning.github.io/webmcp/)
- [WebMCP GitHub](https://github.com/webmachinelearning/webmcp)
- [WebMCP Proposal](https://github.com/webmachinelearning/webmcp/blob/main/docs/proposal.md)
- [MCP-B Polyfill](https://github.com/nichochar/mcp-b)
- [Chrome's WebMCP makes AI agents stop pretending](https://medium.com/reading-sh/chromes-webmcp-makes-ai-agents-stop-pretending-e8c7da1ba650)
- [WebMCP: Making the web AI-agent ready](https://techhub.iodigital.com/articles/web-mcp-making-the-web-ai-agent-ready)
