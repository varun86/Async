# Async Shell

<p align="center">
  <img src="docs/assets/async-logo.svg" width="120" height="120" alt="Async Logo" />
</p>

<p align="center">
  <strong>Open-source, self-hosted AI programming shell.</strong><br>
  An agent-centric coding environment that brings multi-model chat, code preview, and Git changes into a unified interface.
</p>

<p align="center">
  <strong>开源、可自托管的 AI 编程壳</strong><br>
  以对话式 Agent 为中心，把多模型对话、代码预览、Git 变更收拢在同一套界面。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License" />
  <img src="https://img.shields.io/badge/Electron-34-green" alt="Electron" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18-blue" alt="React" />
  <img src="https://img.shields.io/badge/Node-%3E%3D18-green" alt="Node" />
</p>

---

[English](#english) | [简体中文](#简体中文)

---

<a name="english"></a>

## 🌟 Overview

Async Shell is an independent AI-native IDE shell built from the ground up with Electron and React. Unlike VS Code extensions, Async provides a streamlined, agent-first workflow where the AI is not just a side panel, but the core of the development experience.

### Main Interface Preview

<p align="center">
  <img src="docs/assets/async-main-screenshot.png" width="920" alt="Async Main Interface: Three-pane layout - Thread History, Agent Chat & Tool Trajectory, Workspace & Monaco Editor" />
</p>

## ✨ Key Features

### 🤖 Agent Conversation
- **Multi-thread Sessions** — Run multiple independent conversations in parallel.
- **Streaming Output** — Real-time rendering of Agent responses with stop support.
- **Tool Trajectory Visualization** — Tool calls like file read/write and command execution are displayed as interactive cards.
- **Plan / Review Workflow** — Agents generate plans for user approval before execution.

### 🧠 Multi-Model Support
- **OpenAI** compatible API (custom `baseURL` support for any compatible service).
- **Anthropic Claude** native integration.
- **Google Gemini** native integration.
- Easy model switching directly from the UI.

### 📁 Workspace & Editor
- **Local Workspace** — Select any local folder to start coding.
- **File Explorer** — Browse, open, and edit files within the workspace.
- **Built-in Monaco Editor** — High-performance code editing with full control.
- **Diff View** — Visual diffs for Agent-proposed changes with inline accept/reject.

### 🔀 Git & Terminal
- **Git Integration** — View repository status, stage changes, and commit from the sidebar.
- **Integrated Terminal** — Built-in **xterm.js** for command execution.

### 🎨 Rich Input & I18n
- **@-mention** — Reference workspace files in your prompts.
- **Composer Modes** — Toggle between different Agent/Chat modes via the `+` menu.
- **Multi-language Support** — Built-in Chinese and English support.

## 🏗️ Architecture

```
Async Shell
├── main-src/              ← Electron Main Process
│   ├── llm/               ← LLM Routing & Adapters (OpenAI, Anthropic, Gemini)
│   ├── agent/             ← Agent Loop & Tool Execution
│   ├── ipc/               ← IPC Channel Registration
│   ├── gitService.ts
│   ├── workspace.ts
│   └── settingsStore.ts
├── src/                   ← Renderer Process (React)
│   ├── App.tsx            ← Main Three-pane Layout
│   ├── AgentReviewPanel.tsx
│   ├── WorkspaceExplorer.tsx
│   ├── ComposerRichInput.tsx
│   ├── TerminalPane.tsx
│   ├── i18n/              ← Internationalization
│   └── ...
└── electron/
    └── preload.cjs        ← IPC Whitelist Preload
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18
- **npm** ≥ 9
- **Git** (Required for workspace Git features)

### Desktop Version (Recommended)
```bash
git clone https://github.com/your-org/async-shell.git
cd async-shell
npm install
npm run desktop
```
This builds both processes and launches a standalone Electron window loading from `dist/index.html`.

### Development Mode (Hot Reload)
```bash
npm run dev
```
- Electron window loads from the Vite dev server at `http://127.0.0.1:5173`.
- **Note:** Do NOT open this URL in a regular browser (it lacks the necessary Electron environment).
- To debug with DevTools: `npm run dev:debug`.

## ⚙️ Configuration & Data

| Data | Path |
|------|------|
| Settings (API Key, Base URL, Models) | `userData/async/settings.json` |
| Threads & Messages | `userData/async/threads.json` |
| UI State (Sidebar width, etc.) | `settings.json` |

## 🗺️ Roadmap
- [ ] Full PTY Terminal (`node-pty`)
- [ ] LSP (Language Server Protocol) Integration
- [ ] Multi-window Support
- [ ] Auto-update Channel
- [ ] Plugin / Extension System

## 💬 Comparison with Cursor
Async's form factor is **similar to [Cursor](https://cursor.com)**, but the implementation is entirely independent:
- ✅ **Independent Implementation** — Not based on VS Code Workbench; no dependency on Cursor's closed-source client.
- ✅ **Fully Customizable** — The entire stack from UI to protocol is yours to fork and modify.
- ❌ **No VS Code Ecosystem** — No Extension Host, does not support VS Code / Open VSX plugins.
- ❌ **No Cloud Model Routing** — Use your own API keys directly.

## 📜 License
[Apache License 2.0](./LICENSE)

---

<a name="简体中文"></a>

## 🌟 概述

Async Shell 是一个从零开始基于 Electron 和 React 构建的独立 AI 原生 IDE 壳。与 VS Code 插件不同，Async 提供了一个精简的、以 Agent 为中心的工作流，AI 不仅仅是一个侧边栏，而是开发体验的核心。

### 主界面预览

<p align="center">
  <img src="docs/assets/async-main-screenshot.png" width="920" alt="Async 主界面：三栏布局 — 线程历史、Agent 对话与工具轨迹、工作区与 Monaco 编辑器" />
</p>

## ✨ 核心特性

### 🤖 Agent 对话
- **多线程会话** — 并行多个独立对话，随时切换。
- **流式输出** — 实时渲染 Agent 回复，支持中止生成。
- **工具轨迹可视化** — 文件读取、写入、命令执行等工具调用以卡片形式展示。
- **Plan / Review 流程** — Agent 生成计划文档，用户审核确认后再执行。

### 🧠 多模型支持
- **OpenAI** 兼容 API（支持自定义 `baseURL`，适配任意 OpenAI 兼容服务）。
- **Anthropic Claude** 原生适配。
- **Google Gemini** 原生适配。
- 模型可自由配置，在 UI 中一键切换。

### 📁 工作区与编辑器
- **本地工作区** — 选择本地文件夹即可开始编程。
- **文件树浏览器** — 浏览、打开、编辑工作区文件。
- **内置 Monaco 编辑器** — 基于 Monaco Editor 的高性能代码编辑。
- **Diff 视图** — 可视化查看 Agent 变更，支持内联确认 / 拒绝单文件修改。

### 🔀 Git 与终端
- **Git 集成** — 侧栏展示仓库变更概览，支持暂存与提交。
- **内置终端** — 基于 **xterm.js** 的终端面板，支持命令执行。

### 🎨 富文本输入与国际化
- **@-mention** — 引用工作区文件。
- **Composer 模式** — 通过 `+` 菜单切换 Agent / Chat 等模式。
- **双语支持** — 内置中文与英文界面。

## 🏗️ 架构概览

```
Async Shell
├── main-src/              ← Electron 主进程
│   ├── llm/               ← LLM 路由与多模型适配 (OpenAI, Anthropic, Gemini)
│   ├── agent/             ← Agent 循环与工具执行
│   ├── ipc/               ← IPC 通道注册
│   ├── gitService.ts
│   ├── workspace.ts
│   └── settingsStore.ts
├── src/                   ← 渲染进程 (React)
│   ├── App.tsx            ← 三栏主界面
│   ├── AgentReviewPanel.tsx
│   ├── WorkspaceExplorer.tsx
│   ├── ComposerRichInput.tsx
│   ├── TerminalPane.tsx
│   ├── i18n/              ← 国际化
│   └── ...
└── electron/
    └── preload.cjs        ← IPC 白名单预加载
```

## 🚀 快速开始

### 环境要求
- **Node.js** ≥ 18
- **npm** ≥ 9
- **Git**（工作区 Git 功能需要）

### 桌面版（推荐）
```bash
git clone https://github.com/your-org/async-shell.git
cd async-shell
npm install
npm run desktop
```
构建主进程与渲染进程后，启动独立 Electron 窗口，从本地 `dist/index.html` 加载。

### 开发模式（热更新）
```bash
npm run dev
```
- Electron 窗口通过 `http://127.0.0.1:5173` 加载 Vite 开发服务器。
- **注意：** 请勿用系统浏览器直接打开该地址（无 preload，功能受限）。
- 需要调试 DevTools 时：`npm run dev:debug`。

## ⚙️ 配置与数据

| 数据 | 路径 |
|------|------|
| 设置（API Key、Base URL、模型等） | `userData/async/settings.json` |
| 线程与消息 | `userData/async/threads.json` |
| 界面状态（侧栏宽度等） | `settings.json` |

## 🗺️ 路线图
- [ ] 完整 PTY 终端（`node-pty`）
- [ ] LSP 语言服务集成
- [ ] 多窗口支持
- [ ] 自动更新通道
- [ ] 插件 / 扩展系统

## 💬 与 Cursor 的关系
Async 的产品形态**对标 [Cursor](https://cursor.com)**，但实现完全独立：
- ✅ **独立实现** — 不基于 VS Code Workbench，不依赖 Cursor 闭源客户端。
- ✅ **完全可控** — 协议栈与 UI 完全可控，方便二次开发。
- ❌ **不做 VS Code 扩展生态** — 无 Extension Host，不装 VS Code / Open VSX 插件。
- ❌ **不做云端模型路由** — 直接使用你自己的 API Key。

## 📜 许可证
[Apache License 2.0](./LICENSE)

---

<p align="center">
  <strong>Async</strong> — Open-source, agent-centric AI programming shell.<br>
  <strong>Async</strong> — 开源、以 Agent 为中心的 AI 编程壳。
</p>
