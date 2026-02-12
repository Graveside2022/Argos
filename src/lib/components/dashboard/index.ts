// Dashboard component barrel
// Direct components
export { default as AgentChatPanel } from "./AgentChatPanel.svelte";
export { default as DashboardMap } from "./DashboardMap.svelte";
export { default as IconRail } from "./IconRail.svelte";
export { default as PanelContainer } from "./PanelContainer.svelte";
export { default as ResizableBottomPanel } from "./ResizableBottomPanel.svelte";
export { default as TerminalPanel } from "./TerminalPanel.svelte";
export { default as TerminalTabContent } from "./TerminalTabContent.svelte";
export { default as TopStatusBar } from "./TopStatusBar.svelte";

// TypeScript modules
export {
	type FrontendToolCall,
	FrontendToolExecutor,
	frontendToolExecutor,
	type FrontendToolResult,
} from "./frontend-tool-executor";

// Subdirectory re-exports
export {
	DevicesPanel,
	LayersPanel,
	OverviewPanel,
	SettingsPanel,
	ToolsNavigationView,
	ToolsPanel,
	ToolsPanelHeader,
} from "./panels";
export { ToolCard, ToolCategoryCard } from "./shared";
export { KismetView, OpenWebRXView, ToolViewWrapper } from "./views";
