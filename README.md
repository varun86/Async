# Async Shell

<p align="center">
  <img src="docs/assets/async-logo.svg" width="120" height="120" alt="Async Logo" />
</p>

<p align="center">
  <strong>The Agent-Centric AI IDE Shell.</strong><br>
  Built for developers who want a streamlined, autonomous agent workflow without the bloat.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License" />
  <img src="https://img.shields.io/badge/Electron-34-green" alt="Electron" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18-blue" alt="React" />
  <img src="https://img.shields.io/badge/Monaco-0.52-blue" alt="Monaco Editor" />
</p>

---

[English](README.md) | [简体中文](README.zh-CN.md)

---

## 🌟 What is Async Shell?

Async Shell is an open-source, AI-native desktop application designed to be the primary interface between you and your AI agents. Unlike standard IDE extensions, Async is built from the ground up to prioritize the **Agent Loop**, providing a unified environment for multi-model chat, autonomous tool execution, and code review.

### Why use Async?

- **Agent-First Workflow**: Not just a side-chat. The agent has first-class access to your workspace, tools, and terminal.
- **Complete Control**: Self-hosted and fully customizable. Use your own API keys with OpenAI, Anthropic, or Gemini.
- **Lightweight & Fast**: Built with Electron and React, focusing on a clean three-pane layout for maximum productivity.
- **Transparent Execution**: See exactly what the agent is doing with tool trajectory visualization, streaming tool input, and **Plan / Agent** workflows.
- **Git-Aware UI**: Where Git is available, the agent file-change strip uses real `git status` / `git diff` stats; it falls back to chat-parsed counts in non-repo or no-Git environments.

### 📸 Preview

<p align="center">
  <img src="docs/assets/async-main-screenshot.png" width="920" alt="Async Main Interface" />
</p>

### 📋 Plan mode

In **Plan** mode, the model produces a structured plan (title, description, checklist, optional clarifying questions). You review the draft, adjust todos, then use **Start execution** (开始执行) to let the agent carry out the plan. Draft plans are saved under the app user-data directory (e.g. `.async/plans/`).

<p align="center">
  <img src="docs/assets/async-plan-mode.png" width="920" alt="Async Plan mode — draft plan, task checklist, and Start execution" />
</p>

## ✨ Core Features

### 🤖 Autonomous Agent
- **Tool trajectory**: Live cards for reads, writes, search, shell commands, and streaming file-edit previews when the model streams tool JSON.
- **Agent vs Plan**: **Agent** runs the native tool loop (`read_file`, `write_to_file`, `str_replace`, etc.). **Plan** focuses on structured planning and gated execution after you confirm.
- **Multi-thread sessions**: Separate, persistent threads stored on disk (see **Persistence** below).
- **Streaming**: Token streaming, optional thinking blocks, and tool-input deltas for a Cursor-like sense of progress.

### 🧠 Multi-Model Intelligence
- **Anthropic**, **OpenAI-compatible**, and **Gemini** request paths in the main-process LLM layer.
- Any OpenAI-compatible base URL (local LLMs, aggregators) works with the compatible adapter.
- Switch models from the composer without losing thread context.

### 🛠️ Developer Experience
- **Monaco Editor** for in-app editing and diffs.
- **Git**: Status, diff previews, stage, commit, push (when `git` is installed and the workspace is a repository).
- **Integrated terminal** via xterm.js.
- **@-mentions** to reference workspace files in the composer.
- **i18n**: English and Simplified Chinese UI strings.

## 🏗️ Project Structure

```text
async-shell/
├── main-src/                 # Bundled → electron/main.bundle.cjs (Node / Electron main)
│   ├── index.ts              # App entry: windows, userData, IPC registration
│   ├── agent/                # agentLoop.ts, toolExecutor.ts, agentTools.ts
│   ├── llm/                  # OpenAI / Anthropic / Gemini adapters & streaming
│   ├── ipc/register.ts       # ipcMain handlers (chat, threads, git, fs, agent, …)
│   ├── threadStore.ts        # Persistent threads + messages (JSON)
│   ├── settingsStore.ts      # settings.json
│   ├── gitService.ts         # Porcelain status, diff previews, commit/push
│   └── workspace.ts          # Open-folder root & safe path resolution
├── src/                      # Vite + React renderer
│   ├── App.tsx               # Shell layout, chat, composer modes, Git / explorer
│   ├── i18n/                 # Locale messages
│   └── …                     # Agent UI, Plan review, Monaco, terminal, …
├── electron/
│   ├── main.bundle.cjs       # esbuild output (do not edit by hand)
│   └── preload.cjs           # contextBridge → window.asyncShell
├── esbuild.main.mjs          # Builds main process
├── vite.config.ts            # Renderer build
└── package.json
```

## 💾 Persistence (local)

With default paths, app data lives under Electron **`userData`**:

- **`userData/async/threads.json`** — thread list and message history.
- **`userData/async/settings.json`** — models, keys (stored locally), layout, agent options.
- **`userData/.async/plans/`** — saved Plan documents (Markdown) when Plan mode writes a file.

The renderer may use **localStorage** for small UI flags (e.g. agent file-change strip dismiss state); the source of truth for conversations is **`threads.json`**.

## 🚀 Getting Started

### Prerequisites
- **Node.js** ≥ 18  
- **npm** ≥ 9  
- **Git** (optional but recommended for built-in Git features)

### Installation & Run

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/async-shell.git
   cd async-shell
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Launch the app**:
   ```bash
   npm run desktop
   ```
   Builds the main bundle and renderer (`dist/`), then starts Electron loading `dist/index.html`.

### Development Mode

Hot reload for the renderer and watch rebuild for the main process:

```bash
npm run dev
```

Optional DevTools:

```bash
npm run dev:debug
```

## 🗺️ Roadmap
- [ ] **Full PTY terminal** (e.g. `node-pty`) for richer shell sessions.
- [ ] **LSP integration** for jump-to-definition and diagnostics in-editor.
- [ ] **Plugin system** for custom tools and agent extensions.
- [ ] **Enhanced context** — RAG or indexing for very large workspaces.

## 📜 License
This project is licensed under the [Apache License 2.0](./LICENSE).
