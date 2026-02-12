// ============================================================
// WebMCP Demo — Note Manager
// Exposes note management tools via navigator.modelContext
// so AI agents can discover and invoke them.
// ============================================================

// --- State ---
let notes = [];
let nextId = 1;

// --- DOM refs ---
const statusEl = document.getElementById("webmcp-status");
const notesList = document.getElementById("notes-list");
const noteCount = document.getElementById("note-count");
const addNoteForm = document.getElementById("add-note-form");
const searchInput = document.getElementById("search-input");
const toolLog = document.getElementById("tool-log");

// --- Core note operations (shared by UI and WebMCP tools) ---

function addNote(title, content, tag) {
  const note = {
    id: nextId++,
    title,
    content,
    tag: tag || null,
    createdAt: new Date().toISOString(),
  };
  notes.push(note);
  renderNotes();
  return note;
}

function deleteNote(id) {
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) return null;
  const removed = notes.splice(idx, 1)[0];
  renderNotes();
  return removed;
}

function searchNotes(query) {
  const q = query.toLowerCase();
  return notes.filter(
    (n) =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      (n.tag && n.tag.toLowerCase().includes(q))
  );
}

function getStats() {
  const tagCounts = {};
  for (const n of notes) {
    const tag = n.tag || "untagged";
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }
  return { total: notes.length, byTag: tagCounts };
}

// --- UI rendering ---

function renderNotes(filteredNotes) {
  const list = filteredNotes || notes;
  noteCount.textContent = `(${notes.length})`;

  if (list.length === 0) {
    notesList.innerHTML =
      '<p class="empty-state">No notes yet. Add one above or let an AI agent do it via WebMCP!</p>';
    return;
  }

  notesList.innerHTML = list
    .map(
      (n) => `
    <div class="note-card" data-id="${n.id}">
      <div class="note-body">
        <div class="note-title">
          ${escapeHtml(n.title)}
          ${n.tag ? `<span class="note-tag">${escapeHtml(n.tag)}</span>` : ""}
        </div>
        <div class="note-content">${escapeHtml(n.content)}</div>
        <div class="note-meta">ID: ${n.id} &middot; ${new Date(n.createdAt).toLocaleString()}</div>
      </div>
      <button class="delete-btn" onclick="handleDelete(${n.id})">Delete</button>
    </div>
  `
    )
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- Tool call logging ---

function logToolCall(toolName, input, result, error) {
  // Clear empty state on first log
  if (toolLog.querySelector(".empty-state")) {
    toolLog.innerHTML = "";
  }

  const time = new Date().toLocaleTimeString();
  const entry = document.createElement("div");
  entry.className = "log-entry";

  if (error) {
    entry.innerHTML = `<span class="log-time">${time}</span> <span class="log-tool">${toolName}</span>(${JSON.stringify(input)}) → <span class="log-error">ERROR: ${escapeHtml(error)}</span>`;
  } else {
    const resultStr =
      typeof result === "string" ? result : JSON.stringify(result);
    entry.innerHTML = `<span class="log-time">${time}</span> <span class="log-tool">${toolName}</span>(${JSON.stringify(input)}) → <span class="log-result">${escapeHtml(resultStr)}</span>`;
  }

  toolLog.prepend(entry);
}

// --- UI event handlers ---

addNoteForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("note-title").value.trim();
  const content = document.getElementById("note-content").value.trim();
  const tag = document.getElementById("note-tag").value;
  if (title && content) {
    addNote(title, content, tag);
    addNoteForm.reset();
  }
});

searchInput.addEventListener("input", (e) => {
  const query = e.target.value.trim();
  if (query) {
    renderNotes(searchNotes(query));
  } else {
    renderNotes();
  }
});

window.handleDelete = function (id) {
  deleteNote(id);
};

// --- WebMCP tool definitions ---

const webmcpTools = [
  {
    name: "add_note",
    description:
      "Add a new note to the note manager. Returns the created note with its assigned ID.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "The title of the note",
        },
        content: {
          type: "string",
          description: "The body/content of the note",
        },
        tag: {
          type: "string",
          enum: ["idea", "todo", "reference", "important"],
          description: "Optional tag to categorize the note",
        },
      },
      required: ["title", "content"],
    },
    async execute({ title, content, tag }) {
      const note = addNote(title, content, tag);
      logToolCall("add_note", { title, content, tag }, note);
      return {
        content: [
          {
            type: "text",
            text: `Note "${note.title}" created with ID ${note.id}.`,
          },
        ],
      };
    },
  },
  {
    name: "list_notes",
    description:
      "List all notes currently stored in the note manager. Returns an array of note objects.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    async execute() {
      logToolCall("list_notes", {}, { count: notes.length });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(notes, null, 2),
          },
        ],
      };
    },
  },
  {
    name: "search_notes",
    description:
      "Search notes by a query string. Matches against title, content, and tags.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to filter notes by",
        },
      },
      required: ["query"],
    },
    async execute({ query }) {
      const results = searchNotes(query);
      logToolCall("search_notes", { query }, { matchCount: results.length });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    },
  },
  {
    name: "delete_note",
    description: "Delete a note by its ID. Returns the deleted note if found.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "The ID of the note to delete",
        },
      },
      required: ["id"],
    },
    annotations: {
      readOnlyHint: false,
    },
    async execute({ id }, agent) {
      // Demonstrate requestUserInteraction for destructive actions
      if (agent && agent.requestUserInteraction) {
        const confirmed = await agent.requestUserInteraction(async () => {
          return confirm(`Allow AI agent to delete note #${id}?`);
        });
        if (!confirmed) {
          logToolCall("delete_note", { id }, null, "User denied deletion");
          throw new Error("User cancelled the deletion.");
        }
      }

      const removed = deleteNote(id);
      if (!removed) {
        logToolCall("delete_note", { id }, null, "Note not found");
        throw new Error(`Note with ID ${id} not found.`);
      }

      logToolCall("delete_note", { id }, removed);
      return {
        content: [
          {
            type: "text",
            text: `Note "${removed.title}" (ID ${removed.id}) deleted.`,
          },
        ],
      };
    },
  },
  {
    name: "get_stats",
    description:
      "Get statistics about the notes collection: total count and breakdown by tag.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    annotations: {
      readOnlyHint: true,
    },
    async execute() {
      const stats = getStats();
      logToolCall("get_stats", {}, stats);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };
    },
  },
];

// --- WebMCP registration ---

function registerWebMCP() {
  // Check for native WebMCP support
  if ("modelContext" in navigator) {
    navigator.modelContext.provideContext({ tools: webmcpTools });
    statusEl.textContent = "WebMCP supported natively";
    statusEl.className = "status status--supported";
    console.log(
      "[WebMCP] Tools registered via navigator.modelContext:",
      webmcpTools.map((t) => t.name)
    );
    return;
  }

  // Check for polyfill (e.g., MCP-B extension)
  if (window.modelContext) {
    window.modelContext.provideContext({ tools: webmcpTools });
    statusEl.textContent = "WebMCP available via polyfill";
    statusEl.className = "status status--polyfill";
    console.log(
      "[WebMCP] Tools registered via polyfill:",
      webmcpTools.map((t) => t.name)
    );
    return;
  }

  // No support — log tools to console for inspection
  statusEl.textContent =
    "WebMCP not available — enable chrome://flags/#web-mcp in Chrome 146+ Canary";
  statusEl.className = "status status--unsupported";
  console.log("[WebMCP] Not available. Tools that would be registered:");
  console.table(
    webmcpTools.map((t) => ({
      name: t.name,
      description: t.description,
      params: Object.keys(t.inputSchema.properties || {}).join(", "),
    }))
  );

  // Expose tools on window for manual testing
  window.__webmcp_tools = {};
  for (const tool of webmcpTools) {
    window.__webmcp_tools[tool.name] = tool.execute;
  }
  console.log(
    "[WebMCP] Tools exposed on window.__webmcp_tools for manual testing."
  );
  console.log(
    '  Try: window.__webmcp_tools.add_note({ title: "Test", content: "Hello!" })'
  );
}

// --- Initialize ---

renderNotes();
registerWebMCP();
