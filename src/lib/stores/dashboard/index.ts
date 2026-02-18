// Dashboard stores — panel layout, terminal sessions, tool navigation, and agent context
export type { InteractionEvent, WorkflowType } from './agent-context-store';
export {
	agentContext,
	clearSelection,
	clearWorkflow,
	currentWorkflow,
	lastInteractionEvent,
	nextWorkflowStep,
	selectDevice,
	selectedDeviceDetails,
	selectedDeviceMAC,
	setWorkflow,
	workflowGoal,
	workflowStep
} from './agent-context-store';
export {
	activeBands,
	activeBottomTab,
	activePanel,
	activeView,
	bottomPanelHeight,
	closeBottomPanel,
	isBottomPanelOpen,
	layerVisibility,
	setBottomPanelHeight,
	toggleBand,
	toggleBottomTab,
	toggleLayerVisibility,
	togglePanel
} from './dashboard-store';
export {
	activeSession,
	closeSession,
	closeTerminalPanel,
	createSession,
	isTerminalOpen,
	nextTab,
	openTerminalPanel,
	preferredShell,
	previousTab,
	renameSession,
	setActiveSession,
	setPanelHeight,
	setPreferredShell,
	splitTerminal,
	terminalHeight,
	terminalPanelState,
	terminalSessions,
	toggleMaximize,
	toggleTerminalPanel,
	unsplit,
	updateSessionConnection,
	updateSplitWidths
} from './terminal-store';
export {
	breadcrumbs,
	currentCategory,
	expandedCategories,
	getToolStatus,
	navigateBack,
	navigateToCategory,
	navigateToRoot,
	setToolStatus,
	toggleCategory,
	toolNavigationPath,
	toolStates
} from './tools-store';
