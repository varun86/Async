# Void Shell 性能优化计划

## 问题描述

打开工作���或切换工作区���话时，整个窗口冻结 5-10 秒。生产包同样存在此问题。
日志显示 IPC 初始化在 ~100ms 内完成，卡顿发生在初始化之后的渲染和 effect 级联阶段。

---

## 根因分析

### 根因 1：巨型单体组件的 re-render 风暴

`src/App.tsx` 是一个 6289 行的单组件，包含 256 个 React hooks：


| Hook 类型           | 数量      |
| ----------------- | ------- |
| `useCallback`     | 97      |
| `useMemo`         | 38      |
| `useEffect`       | 40      |
| `useLayoutEffect` | 9       |
| `useState`        | 33      |
| `useRef`          | 39      |
| **合计**            | **256** |


**问题**：任何一个 `setState` 都会触发 App 组件的完整 re-render，即 256 个 hooks 的依赖比较 + 整个 JSX 子树的 reconciliation。

切换工作区时的级联过程（至少 5-8 轮 render）：

```
用户点击切换工作区
  ├─ applyWorkspacePath()
  │   ├─ clearWorkspaceConversationState() → ~10 个 setState（batched, 1 次 render）
  │   ├─ setWorkspace(next) → batched
  │   └─ await refreshThreads() → setThreads + setCurrentId → 1 次 render
  │
  ├─ render 后 effects 触发 ───────────────────────────────────��──────
  │   ├─ useGitIntegration workspace effect → refreshGit()
  │   │   └─ git:status + git:listBranches IPC → 8+ setState → 1 次 render
  │   ├─ useWorkspaceManager file list effect → workspace:listFiles IPC
  │   │   └─ setWorkspaceFileList → 1 次 render
  │   ├─ threads effect (line 1012) → refreshAgentSidebarThreads()
  │   │   └─ threads:listAgentSidebar IPC → setSidebarThreadsByPathKey → 1 次 render
  │   └─ currentId effect (line 1711) → loadMessages()
  │       └─ threads:messages IPC → setMessages + setMessagesThreadId → 1 次 render
  │
  ├─ 二级 effects ───────────────────────────────────────────────────
  │   ├─ gitChangedPaths 变化 → git:diffPreviews IPC → setDiffPreviews → 1 次 render
  │   ├─ messages 变化 → useLayoutEffect (line 4062) → 多个 setState → 1 次 render
  │   └─ agentFileChanges useMemo 重算 → segmentAssistantContentUnified 解析
  │
  └─ 每一轮 render = 256 hooks 依赖检查 + 全子树 reconciliation
```

### 根因 2：`threads:listAgentSidebar` 同步解析

`main-src/ipc/register.ts:1204` 的 `threads:listAgentSidebar` handler：

- 对最多 8 个工作区路径，��个都执行 `fs.existsSync` + `fs.statSync`（同步 I/O）
- 对每个工作区的每个线程调用 `summarizeThreadForSidebar()`
- `summarizeThreadForSidebar()`（`main-src/threadListSummary.ts:29`）对每个线程：
  - `flattenAssistantTextPartsForSearch()` 展平结构化消息
  - `listAgentDiffChunks()` 正则解析 diff 块
  - `countDiffLinesInChunk()` 逐行统计
- 所有操作在 main process 主线程同步执行，阻塞所有后续 IPC 响应

### 根因 3：Git 操作链在 Windows 上的进程创建开销

切换工作区后的 Git 操作链：

```
workspace ���化
  → refreshGit() 并行发送:
      ├─ git:status   → execFile('git', ['status', ...])  → 1 个子进程
      └─ git:listBranches → execFile('git', ['branch', ...]) → 1 个子进程
  → gitChangedPaths 变化 触发:
      ���─ git:diffPreviews → 每个改动文件 1 个子进程
         (gitService.ts:376: await git(['diff', 'HEAD', '--', relPath]))
```

Windows 上 `execFile` 创建子进程开销约 50-100ms。若有 20 个改动文件，仅 `diffPreviews` 就需 1-2 秒。

### 次要因素


| 问题                    | 位置                                                                     | 影响                        |
| --------------------- | ---------------------------------------------------------------------- | ------------------------- |
| threadStore 同步写入      | `main-src/threadStore.ts:167` `fs.writeFileSync`                       | 每次 save() 阻塞 main process |
| xterm 静态导入            | `App.tsx → DrawerPtyTerminal → PtyTerminalView → @xterm/xterm` (290KB) | 主 bundle 膨胀，即使终端未打开也加载    |
| 主 bundle 体积           | `index.js` 956KB + `markdown` 165KB                                    | 首屏同步解析/执行开销               |
| CSS 体积                | `index.css` 427KB（含 15208 行应用 CSS）                                     | 首屏 CSSOM 构建开销             |
| `threads:list` 也做全量摘要 | `register.ts:1185` 每个线程都 `summarizeThreadForSidebar`                   | 线程越多越慢                    |


---

## 优化方案

### Phase 0：诊断确认（预估 0.5 天��

> 在动手改之���，先用数据确认瓶颈分布。

**0.1 添加 renderer 端性能标记**

在 `App.tsx` 的关键 effect 中加入 `performance.mark` / `performance.measure`：

```typescript
// 在 init effect、loadMessages effect、refreshGit effect 等关键路径加:
performance.mark('workspace-switch-start');
// ...
performance.mark('workspace-switch-messages-loaded');
performance.measure('workspace-switch:messages', 'workspace-switch-start', 'workspace-switch-messages-loaded');
```

需要标记的���键节点：

- `applyWorkspacePath` 开始 / 结束
- `refreshThreads` 返回
- `loadMessages` 返回
- `refreshGit` 返回
- `diffPreviews` 返回
- `refreshAgentSidebarThreads` 返回
- 首次 render commit（用 `useEffect` + `performance.now()`）

**0.2 添加 main process 端性能标记**

在 IPC handler 中加入耗时日志：

```typescript
// register.ts �� threads:listAgentSidebar handler
const t0 = performance.now();
// ... handler body ...
console.log(`[ipc] threads:listAgentSidebar: ${(performance.now() - t0).toFixed(1)}ms`);
```

需要标记的 IPC：

- `threads:list`
- `threads:listAgentSidebar`
- `threads:messages`
- `git:status`
- `git:listBranches`
- `git:diffPreviews`

**0.3 React Profiler 录制**

在 production build ���启用 React Profiler（`react-dom/profiling`），录制一次工作区切换，确认：

- 哪��组件 render 次数最多
- 哪些 render 耗时最长
- 总共几轮 commit

---

### Phase 1：拆分 App.tsx 状态��（预估 3-4 天）

> 最高优先级。目标：一个局部状态变更不再触发 256 hooks 的全量重算。

**1.1 识别独立状态域**

App.tsx 中的状态可以分为以下独立域：


| 域名             | 包含的状态                                                                                                                                                         | 更新频率       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **Thread**     | threads, currentId, messages, messagesThreadId, threadSearch, editingThread*, confirmDelete*, sidebarThreadsByPathKey, threadNavigation, resendFromUserIndex  | 切换对话时      |
| **Git**        | gitBranch, gitLines, gitPathStatus, gitChangedPaths, gitStatusOk, gitBranchList, diffPreviews, diffLoading, gitActionError, treeEpoch, gitBranchPickerOpen    | 文件变更/切工作区时 |
| **Streaming**  | awaitingReply, streaming, streamingThinking, streamingToolPreview, liveAgentBlocks, thinkingTick, lastTurnUsage                                               | 对话流式输出时    |
| **Composer**   | composerSegments, inlineResendSegments, composerMode, plusMenuOpen, modelPickerOpen                                                                           | 用户输入时      |
| **Settings**   | defaultModel, modelProviders, modelEntries, enabledModelIds, thinkingByModelId, agentCustomization, editorSettings, mcpServers, mcpStatuses, indexingSettings | 改设置时       |
| **Appearance** | colorMode, appearanceSettings, effectiveScheme, transitionOrigin                                                                                              | 切主题时       |
| **Layout**     | layoutMode, railWidths, leftSidebarOpen, agentRightSidebarView, editorLeftSidebarView, editorExplorerCollapsed                                                | 拖拽/点击时     |
| **Workspace**  | workspace, workspaceFileList, homeRecents, folderRecents, workspaceAliases                                                                                    | 切工作区时      |
| **Editor**     | filePath, editorValue, tabs, editorTerminalHeight, monacoEditor                                                                                               | 编辑文件时      |


**1.2 实施策略：Context + 子组件拆分**

不做大规模 Context Provider 重构（风险大），而是：

**步骤 A**：将 App 内部拆为几个大子���件，每个子组件用 `memo()` 包裹，仅��收自己需要的 props：

```
App (轻量壳，只管 workspace/layout/appearance 几个全局状态)
  ├─ AppInitEffect (init effect 逻辑)
  ├─ AgentLayoutShell (memo)
  │   ├─ AgentLeftSidebarContainer (memo, 管理 sidebar thread 状态)
  │   ├─ AgentCenterContainer (memo, 管理 streaming/composer/messages 状态)
  │   └─ AgentRightSidebarContainer (memo, 管理 git/plan 状态)
  ├─ EditorLayoutShell (memo, lazy)
  ├─ OverlaysContainer (memo, 管理 modal/dropdown/menu 状态)
  └─ GlobalKeyboardHandler
```

**步骤 B**：将频繁变更的状态（streaming、composer）下沉到对应子组件的局部 `useState`，不再提升到 App。通过 ref 或 callback 在必要时与其他域通信。

**步骤 C**：对跨域通信需求（如 streaming 完成后更新 messages），使用 `useRef` + callback 而非 state lifting，避免触发上层 re-render。

**1.3 预期效果**

- ��换对话时：只有 Thread 域和 Chat 域的子组件 re-render，其他域（Git���Settings、Layout）不参与
- 流式输出时：只有 Streaming 域的子组件 re-render，不影�� sidebar
- 每轮 render 的 hook 数从 256 降至各子组件的 20-40 个

---

### Phase 2：合并 Git 操作（预估 1-2 天）

> 目标：消��� N 个子进程的开销，改为单次 git 调用。

**2.1 合并 `git:diffPreviews` 为单次 diff**

���前（`gitService.ts:376`）：

```typescript
// 每个文件一个子进程
list.map(p => git(['diff', 'HEAD', '--', relPath], root))
```

改为：

```typescript
// 单次调用获取所有文件的 diff
const allDiff = await git(['diff', 'HEAD', '--no-ext-diff', '--unified=3'], root);
// 然后在 JS 中按文件路径分割
const perFileDiffs = splitUnifiedDiff(allDiff);
```

编写 `splitUnifiedDiff(rawDiff: string)` 工具函数，按 `diff --git a/... b/...` 行分割。

**2.2 合并 `refreshGit` 的两次调用**

当前 `useGitIntegration.ts:33` 并行调用 `git:status` + `git:listBranches`（2 个子进程）。

可以在 main process 新增一个 `git:fullStatus` IPC，一次返回 status + branches + diffPreviews：

```typescript
ipcMain.handle('git:fullStatus', async (event) => {
  const root = senderWorkspaceRoot(event);
  const [status, branches, allDiff] = await Promise.all([
    gitService.getStatus(root),
    gitService.listBranches(root),
    gitService.getAllDiffs(root),  // 新增：单次 git diff HEAD
  ]);
  return { status, branches, diffPreviews: splitUnifiedDiff(allDiff) };
});
```

renderer 端 `refreshGit` 改为单次 IPC 调用，消除 `gitChangedPaths → diffPreviews` 的二级 effect。

**2.3 预期效果**

- 子进程数从 `2 + N`（N = 改动文件数）降为 `3`（status + branches + diff）
- 消除 `diffPreviews` 的二级 effect，减少 1 轮 render
- Windows 上���估节省 1-3 秒

---

### Phase 3：延迟与节流 sidebar 线程加载（预估 1 天）

> 目标：`threads:listAgentSidebar` 不在关键路径上执行。

**3.1 从 effect 依赖中移除 `threads`**

当前（`App.tsx:1012-1021`）：

```typescript
useEffect(() => {
  void refreshAgentSidebarThreads(agentSidebarThreadPaths);
}, [shell, layoutMode, agentSidebarThreadPaths, threads, refreshAgentSidebarThreads]);
//                                               ^^^^^^^^ 每次 threads 变化都触发
```

`threads` 在切线程/新建线程时频繁变化。改为：

```typescript
useEffect(() => {
  // ��在工作区路径列表变化时触发，不跟踪 threads
  const id = requestIdleCallback(() => {
    void refreshAgentSidebarThreads(agentSidebarThreadPaths);
  }, { timeout: 3000 });
  return () => cancelIdleCallback(id);
}, [shell, layoutMode, agentSidebarThreadPaths, refreshAgentSidebarThreads]);
```

当前线程的变化（如新消息）通过 `threads` state 已经���左侧栏的当前工作区部分体现，不需要重新拉取 sidebar threads。

**3.2 缓存 `summarizeThreadForSidebar` 结果**

在 `threadListSummary.ts` 中加入基于 `thread.updatedAt` 的缓存：

```typescript
const summaryCache = new Map<string, { updatedAt: number; summary: ThreadRowSummary }>();

export function summarizeThreadForSidebar(thread: { id: string; updatedAt: number; messages: ChatMessage[] }): ThreadRowSummary {
  const cached = summaryCache.get(thread.id);
  if (cached && cached.updatedAt === thread.updatedAt) {
    return cached.summary;
  }
  const summary = computeSummary(thread);
  summaryCache.set(thread.id, { updatedAt: thread.updatedAt, summary });
  return summary;
}
```

**3.3 预期效果**

- 切工作区/对话时不再触发 sidebar 线程加载
- 即使触发，缓存命中时跳过昂贵的 diff 解析
- 减少 1 轮 render + 1 次 IPC 往返

---

### Phase 4：threadStore 异步化与写入合并（预估 1 天）

> 目标：`save()` 不阻塞 main process 主线程。

**4.1 `save()` 改为 debounced 异步写入**

当前（`threadStore.ts:166-168`）：

```typescript
function save(): void {
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf8');
}
```

改为：

```typescript
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let savePromise: Promise<void> | null = null;

function save(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const json = JSON.stringify(data, null, 2);
    savePromise = fs.promises.writeFile(storePath, json, 'utf8')
      .catch(err => console.error('[threadStore] save error:', err))
      .finally(() => { savePromise = null; });
  }, 100); // 100ms debounce
}

// 进程退出���确保写入
export async function flushPendingSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    const json = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(storePath, json, 'utf8');
  }
  if (savePromise) await savePromise;
}
```

在 `main-src/index.ts` 的 `app.on('before-quit')` 中调用 `flushPendingSave()`。

**4.2 减少 `save()` 调用频率**

当前每次 `appendMessage`、`updateLastAssistant`、`accumulateTokenUsage` 都调用 `save()`。
流式输出时 `updateLastAssistant` 可能每秒调用数十次。debounce 后这些会合并为一次写入。

**4.3 预期效果**

- 流式输出时 main process 不再被频繁同步 I/O 阻塞
- 切线程时的多次 `save()`（selectThread + ensureDefaultThread 等）合并为一次

---

### Phase 5：懒加载 xterm 和减小主 bundle（预估 0.5-1 天）

> 目标：首屏加载的 JS 体积从 ~1.1MB 降至 ~700KB。

**5.1 懒加载 DrawerPtyTerminal**

当前：`App.tsx:17` 静态导入 → `DrawerPtyTerminal` → `PtyTerminalView` → `@xterm/xterm`（290KB chunk）

改为：

```typescript
const DrawerPtyTerminal = lazy(() =>
  import('./DrawerPtyTerminal').then(m => ({ default: m.DrawerPtyTerminal }))
);
```

在渲染处加 `<Suspense fallback={<div className="ref-drawer-terminal-loading" />}>` 包裹。

**5.2 懒加载 `diff` 库**

`App.tsx:16` 静态导入 `createTwoFilesPatch`（from `diff`）。检查使用频率���若仅在特定操作时使用，改为动态 `import('diff')`。

**5.3 检查 `react-markdown` 引入路径**

`ChatMarkdown.tsx` 静态导入 `react-markdown` + `remark-gfm`（165KB chunk）。虽然已在独立 chunk，但作为首屏依赖会同步加载。如果首屏无消息（新工作区），可延迟加载。

**5.4 预期效果**

- 首屏 JS ���少 ~290KB（xterm）+ ~30KB（diff）
- 解析和执行时间减少 ~100-200ms

---

### Phase 6：消除不必要的 effect 级联（预估 1-2 天）

> 目标：减少切工作区���的 render 轮次。

**6.1 合并 `refreshGit` + `loadMessages` + `refreshAgentSidebarThreads` 的 effect 触发**

当前这三个操作分散在不同 effect 中，各自由不同的���赖触发，形成多级级联。

改为在 `applyWorkspacePath` 中���一调度：

```typescript
const applyWorkspacePath = useCallback(async (next: string) => {
  clearWorkspaceConversationState();
  setWorkspace(next);

  // 统一并行加载，一次 render 完成
  const [threadResult] = await Promise.all([
    refreshThreads(),
    // refreshGit 由 workspace effect 触发，不重复调用
  ]);

  // loadMessages 在 refreshThreads 返回 currentId 后立即调用
  if (threadResult) {
    await loadMessages(threadResult);
  }
}, [...]);
```

**6.2 避免 `gitChangedPaths` → `diffPreviews` 的二级 effect**

Phase 2 中����� Git 操作后，`diffPreviews` 随 `git:fullStatus` 一起返回，��再需要单独的 effect。删除 `useGitIntegration.ts:86-104` 的 `diffPreviews` effect。

**6.3 避免 `messages` → `agentFileChanges` 的 useLayoutEffect 级联**

`App.tsx:4062` 的 `useLayoutEffect` 在 `messages` 或 `messagesThreadId` 变化时执行多个 `setState`，触发额外 render。

��以将这些状态计算移入 `loadMessages` 的回调中，与 `setMessages` 同批执行：

```typescript
const loadMessages = useCallback(async (id: string) => {
  const r = await shell.invoke('threads:messages', id);
  if (r.ok && r.messages && currentIdRef.current === id) {
    // 批量更新，一次 render
    ReactDOM.flushSync(() => {  // 或使用 unstable_batchedUpdates
      setMessages(r.messages);
      setMessagesThreadId(id);
      // 直接计算 file changes dismiss 状态
      computeAndSetFileChangesState(id, r.messages);
    });
  }
}, [shell]);
```

**6.4 预期效果**

- 切工作区时的 render 轮次从 5-8 轮降至 2-3 轮
- 每减少一轮 = 节省 256 hooks 的依赖检查 + 子树 reconciliation

---

## 实施路线图

```
Week 1:
  ├─ Phase 0: 诊断确���（0.5 天）
  │   └─ 添加性能标记，录制 Profiler，确认瓶颈分布
  ├─ Phase 2: ���并 Git 操作（1-2 天）
  │   └─ 风险低，收益明确，不涉及 React 架构改动
  └─ Phase 3: 延迟 sidebar 线程加载（1 天）
      └─ 简单改动，立竿见影

Week 2:
  ├─ Phase 4: threadStore 异步化（1 天）
  ├─ Phase 5: 懒加载 xterm（0.5 天）
  └─ Phase 6: 消除 effect 级联（1-2 天）

Week 3-4:
  └─ Phase 1: 拆分 App.tsx（3-4 天）
      └─ 风险最大，收益最大，放在最后有前面的诊断数据做参考
```

**推荐优先级**：Phase 0 → 2 → 3 → 6 → 4 → 5 → 1

理由：

- Phase 2/3/6 是「低风险高收益」：改 IPC 和 effect 触发逻辑，不动组件结构
- Phase 4/5 是「低风险中收益」：独立模块改动
- Phase 1 是「高风险高收益」：需要大规模重构 App.tsx，但前面的优化可能已经将卡顿降到可接受范围

---

## 预期总收益


| 优化项             | 预估减少耗时    | 减少 render 轮次       |
| --------------- | --------- | ------------------ |
| 合并 Git 操作       | 1-3 秒     | 1 轮                |
| 延迟 sidebar 线程   | 0.5-1 秒   | 1 轮                |
| 消除 effect 级联    | 0.5-1 秒   | 2-3 轮              |
| threadStore 异步化 | 0.2-0.5 秒 | —                  |
| 懒加载 xterm       | 0.1-0.2 秒 | —                  |
| 拆分 App.tsx      | 1-2 秒     | 每轮 render 代价降低 80% |
| **合计**          | **3-7 秒** | **4-5 轮**          |


目���：将工作区切换的体感延迟从 5-10 秒降至 < 1 秒。

---

## 度量与验收

每个 Phase 完成后，用以下方式验证：

1. **Performance timeline**：录制工作区切换操作，对比优化前后的 Long Task 数量和总时长
2. **Console 计时日志**：对比关键路径的 `performance.measure` 数据
3. **体感测试**：在 production build 中反复切换工作区/对话 10 次，记录主观卡顿感
4. **Regression**：确保线程数据完���性、Git 状态准确性、sidebar 线程列表正确性

