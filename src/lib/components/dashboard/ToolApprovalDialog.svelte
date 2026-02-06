<script lang="ts">
	interface ToolApprovalRequest {
		toolCallId: string;
		toolName: string;
		args: Record<string, unknown>;
		category?: string;
		description?: string;
	}

	let {
		request,
		onApprove,
		onDeny
	}: {
		request: ToolApprovalRequest;
		onApprove: () => void;
		onDeny: () => void;
	} = $props();

	function formatArgs(args: Record<string, unknown>): string {
		return JSON.stringify(args, null, 2);
	}

	function getCategoryColor(category?: string): string {
		switch (category) {
			case 'WIFI_DISRUPTION':
				return '#ff4444';
			case 'NETWORK_ATTACK':
				return '#ff6b00';
			case 'RECONNAISSANCE':
				return '#ffaa00';
			default:
				return '#4ec9b0';
		}
	}

	function getCategoryLabel(category?: string): string {
		switch (category) {
			case 'WIFI_DISRUPTION':
				return 'WIFI ATTACK';
			case 'NETWORK_ATTACK':
				return 'NETWORK ATTACK';
			case 'RECONNAISSANCE':
				return 'RECON';
			default:
				return 'ACTION';
		}
	}
</script>

<div class="approval-overlay">
	<div class="approval-dialog">
		<!-- Header -->
		<div class="dialog-header">
			<div class="header-content">
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					class="warning-icon"
				>
					<path
						d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
					/>
					<line x1="12" y1="9" x2="12" y2="13" />
					<line x1="12" y1="17" x2="12.01" y2="17" />
				</svg>
				<h2 class="dialog-title">Agent Requesting Permission</h2>
			</div>
			{#if request.category}
				<span
					class="category-badge"
					style="background-color: {getCategoryColor(
						request.category
					)}20; color: {getCategoryColor(request.category)}"
				>
					{getCategoryLabel(request.category)}
				</span>
			{/if}
		</div>

		<!-- Tool Info -->
		<div class="dialog-body">
			<div class="tool-info">
				<div class="info-row">
					<span class="label">Tool:</span>
					<code class="value">{request.toolName}</code>
				</div>
				{#if request.description}
					<div class="info-row">
						<span class="label">Description:</span>
						<span class="value">{request.description}</span>
					</div>
				{/if}
			</div>

			<!-- Arguments -->
			<div class="arguments-section">
				<div class="section-header">Arguments:</div>
				<pre class="arguments-code">{formatArgs(request.args)}</pre>
			</div>

			<!-- Warning Message -->
			<div class="warning-message">
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="10" />
					<line x1="12" y1="8" x2="12" y2="12" />
					<line x1="12" y1="16" x2="12.01" y2="16" />
				</svg>
				<span>This action requires operator approval before execution.</span>
			</div>
		</div>

		<!-- Actions -->
		<div class="dialog-actions">
			<button class="btn btn-deny" onclick={onDeny}>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
				Deny
			</button>
			<button class="btn btn-approve" onclick={onApprove}>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<polyline points="20 6 9 17 4 12" />
				</svg>
				Approve & Execute
			</button>
		</div>
	</div>
</div>

<style>
	.approval-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.75);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		backdrop-filter: blur(4px);
		animation: fadeIn 0.2s ease;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.approval-dialog {
		background: #1e1e1e;
		border: 1px solid #3c3c3c;
		border-radius: 8px;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
		max-width: 600px;
		width: 90%;
		max-height: 80vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		animation: slideUp 0.3s ease;
	}

	@keyframes slideUp {
		from {
			transform: translateY(20px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	/* Header */
	.dialog-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px 24px;
		background: #252526;
		border-bottom: 1px solid #3c3c3c;
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.warning-icon {
		color: #ffaa00;
		flex-shrink: 0;
	}

	.dialog-title {
		font-size: 18px;
		font-weight: 600;
		color: #cccccc;
		margin: 0;
		font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
	}

	.category-badge {
		padding: 4px 12px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	/* Body */
	.dialog-body {
		padding: 24px;
		overflow-y: auto;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.tool-info {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.info-row {
		display: flex;
		gap: 12px;
	}

	.label {
		color: #888;
		font-size: 13px;
		min-width: 100px;
		font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
	}

	.value {
		color: #cccccc;
		font-size: 13px;
		font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
	}

	code.value {
		background: #2d2d2d;
		padding: 2px 8px;
		border-radius: 3px;
		color: #4ec9b0;
	}

	/* Arguments */
	.arguments-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.section-header {
		font-size: 13px;
		color: #888;
		font-weight: 600;
		font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
	}

	.arguments-code {
		background: #2d2d2d;
		border: 1px solid #3c3c3c;
		border-radius: 4px;
		padding: 12px;
		color: #dcdcaa;
		font-size: 12px;
		font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
		overflow-x: auto;
		margin: 0;
	}

	/* Warning */
	.warning-message {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		background: rgba(255, 170, 0, 0.1);
		border: 1px solid rgba(255, 170, 0, 0.3);
		border-radius: 4px;
		color: #ffaa00;
		font-size: 13px;
		font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
	}

	.warning-message svg {
		flex-shrink: 0;
	}

	/* Actions */
	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		padding: 16px 24px;
		background: #252526;
		border-top: 1px solid #3c3c3c;
	}

	.btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 20px;
		border: none;
		border-radius: 4px;
		font-size: 13px;
		font-weight: 600;
		font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-deny {
		background: #3c3c3c;
		color: #cccccc;
	}

	.btn-deny:hover {
		background: #4e4e4e;
	}

	.btn-approve {
		background: #0e639c;
		color: white;
	}

	.btn-approve:hover {
		background: #1177bb;
		box-shadow: 0 0 12px rgba(14, 99, 156, 0.5);
	}

	.btn:active {
		transform: translateY(1px);
	}

	/* Scrollbar */
	.dialog-body::-webkit-scrollbar {
		width: 8px;
	}

	.dialog-body::-webkit-scrollbar-track {
		background: #1e1e1e;
	}

	.dialog-body::-webkit-scrollbar-thumb {
		background: #424242;
		border-radius: 4px;
	}

	.dialog-body::-webkit-scrollbar-thumb:hover {
		background: #4e4e4e;
	}
</style>
