/** 与主进程 `settings.json` 中 `indexing` 字段对应（渲染端归一化后两项均有布尔值） */

export type IndexingSettingsWire = {
	symbolIndexEnabled?: boolean;
	/** 已废弃：曾用于关闭 TS LSP；现由主进程按需为 Agent 启动，读入时忽略 */
	tsLspEnabled?: boolean;
};

export type IndexingSettingsState = {
	symbolIndexEnabled: boolean;
};

export function normalizeIndexingSettings(raw?: IndexingSettingsWire | null): IndexingSettingsState {
	return {
		symbolIndexEnabled: raw?.symbolIndexEnabled !== false,
	};
}
