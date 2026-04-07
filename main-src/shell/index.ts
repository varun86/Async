/**
 * Shell 模块统一导出
 */

// 类型导出
export type {
  ShellType,
  ShellProvider,
  ShellCommandResult,
  ShellCommandOptions,
  ShellProviderFactory,
  ShellConfig,
} from './shellProvider';

// Provider 实现
export { BashShellProvider, createBashProvider, createBashProviderWithPath, findUnixShell } from './bashProvider';
export { PowerShellProvider, createPowerShellProvider, createPowerShellProviderWithPath, findPowerShell } from './powershellProvider';

// Shell 检测和管理
export {
  detectShellProvider,
  getShellProvider,
  resetShellCache,
  setShellProvider,
  getShellDiagnostics,
} from './detectShell';
