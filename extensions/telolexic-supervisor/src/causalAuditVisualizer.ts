// Causal Audit Flow Visualizer
// Renders interactive causal dependency graphs with D3.js
// Supports pruning dead code, resolving dependencies, and real-time feedback

import * as vscode from 'vscode';
import { CausalFlowVisualization, TAP3Verdict } from './telolexia-ast';

export class CausalAuditVisualizer {
	private panel: vscode.WebviewPanel | undefined;
	private context: vscode.ExtensionContext;

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	/**
	 * Shows the causal audit visualizer webview
	 */
	public show(verdict: TAP3Verdict, visualization: CausalFlowVisualization, code: string): void {
		if (!this.panel) {
			this.panel = vscode.window.createWebviewPanel(
				'causalAuditVisualizer',
				'Causal Audit Flow',
				vscode.ViewColumn.Beside,
				{
					enableScripts: true,
					retainContextWhenHidden: true,
					localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')]
				}
			);

			this.panel.onDidDispose(() => {
				this.panel = undefined;
			});

			this.panel.webview.onDidReceiveMessage(message => {
				this.handleWebviewMessage(message, code);
			});
		}

		this.panel.webview.html = this.getWebviewContent(verdict, visualization);
		this.panel.reveal();
	}

	private getWebviewContent(verdict: TAP3Verdict, visualization: CausalFlowVisualization): string {
		const d3Url = 'https://d3js.org/d3.v7.min.js';
		const verdictColor = this.getVerdictColor(verdict.verdict);
		const verdictEmoji = this.getVerdictEmoji(verdict.verdict);

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Causal Audit Flow</title>
	<script src="${d3Url}"></script>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}

		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
			background: #1e1e1e;
			color: #e0e0e0;
			overflow: hidden;
		}

		.container {
			display: flex;
			flex-direction: column;
			height: 100vh;
		}

		.header {
			padding: 16px;
			background: #252526;
			border-bottom: 1px solid #3e3e42;
			display: flex;
			align-items: center;
			justify-content: space-between;
		}

		.verdict-badge {
			display: flex;
			align-items: center;
			gap: 8px;
			font-weight: 600;
			padding: 8px 12px;
			border-radius: 4px;
			background: ${verdictColor}20;
			color: ${verdictColor};
			border: 1px solid ${verdictColor}40;
		}

		.verdict-badge.verified {
			background: #4ec9b022;
			color: #4ec9b0;
			border-color: #4ec9b040;
		}

		.verdict-badge.anomaly {
			background: #dcdcaa22;
			color: #dcdcaa;
			border-color: #dcdcaa40;
		}

		.verdict-badge.violation {
			background: #f4888822;
			color: #f48888;
			border-color: #f4888840;
		}

		.confidence-score {
			font-size: 12px;
			color: #858585;
			margin-left: 12px;
		}

		.canvas-container {
			flex: 1;
			position: relative;
			overflow: hidden;
		}

		svg {
			width: 100%;
			height: 100%;
		}

		.node {
			cursor: pointer;
			stroke-width: 2px;
		}

		.node.verified {
			fill: #4ec9b0;
			stroke: #4ec9b0;
		}

		.node.exigenesis {
			fill: #dcdcaa;
			stroke: #dcdcaa;
		}

		.node.unresolved {
			fill: #f48888;
			stroke: #f48888;
		}

		.node text {
			font-size: 12px;
			pointer-events: none;
			fill: #1e1e1e;
			font-weight: 500;
		}

		.link {
			stroke-width: 2px;
			fill: none;
		}

		.link.verified {
			stroke: #4ec9b0;
			stroke-opacity: 0.6;
		}

		.link.exigenesis {
			stroke: #dcdcaa;
			stroke-opacity: 0.6;
			stroke-dasharray: 5,5;
		}

		.link.unresolved {
			stroke: #f48888;
			stroke-opacity: 0.8;
			animation: pulse 1.5s infinite;
		}

		@keyframes pulse {
			0%, 100% { stroke-opacity: 0.8; }
			50% { stroke-opacity: 0.3; }
		}

		.tooltip {
			position: absolute;
			padding: 8px 12px;
			background: #2d2d30;
			color: #e0e0e0;
			border: 1px solid #3e3e42;
			border-radius: 4px;
			font-size: 12px;
			pointer-events: none;
			z-index: 1000;
			max-width: 300px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		}

		.details-panel {
			padding: 16px;
			background: #252526;
			border-top: 1px solid #3e3e42;
			max-height: 200px;
			overflow-y: auto;
		}

		.details-section {
			margin-bottom: 12px;
		}

		.details-section-title {
			font-weight: 600;
			color: #4ec9b0;
			margin-bottom: 6px;
			font-size: 12px;
			text-transform: uppercase;
		}

		.details-item {
			font-size: 12px;
			color: #858585;
			margin-bottom: 4px;
			padding-left: 12px;
			border-left: 2px solid #3e3e42;
		}

		.action-button {
			padding: 6px 12px;
			background: #007acc;
			color: white;
			border: none;
			border-radius: 3px;
			font-size: 12px;
			cursor: pointer;
			margin-right: 8px;
		}

		.action-button:hover {
			background: #005a9e;
		}

		.action-button.danger {
			background: #f48888;
		}

		.action-button.danger:hover {
			background: #d46666;
		}

		.legend {
			display: flex;
			gap: 16px;
			margin-top: 12px;
			font-size: 11px;
		}

		.legend-item {
			display: flex;
			align-items: center;
			gap: 6px;
		}

		.legend-dot {
			width: 10px;
			height: 10px;
			border-radius: 50%;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<div style="display: flex; align-items: center;">
				<span style="font-size: 24px; margin-right: 8px;">${verdictEmoji}</span>
				<div>
					<div style="font-weight: 600; font-size: 14px;">Causal Audit Flow</div>
					<div style="font-size: 12px; color: #858585;">TAP-3.0 Protocol Analysis</div>
				</div>
			</div>
			<div style="display: flex; align-items: center;">
				<div class="verdict-badge ${verdict.verdict.toLowerCase()}">
					${verdict.verdict}
				</div>
				<div class="confidence-score">Confidence: ${verdict.score}%</div>
			</div>
		</div>

		<div class="canvas-container">
			<svg id="graph"></svg>
			<div id="tooltip" class="tooltip" style="display: none;"></div>
		</div>

		<div class="details-panel">
			<div style="margin-bottom: 12px;">
				<strong>${verdict.details}</strong>
			</div>

			${verdict.unresolvedDependencies.length > 0 ? `
			<div class="details-section">
				<div class="details-section-title">⚠️ Unresolved Dependencies</div>
				${verdict.unresolvedDependencies.map(dep => `
					<div class="details-item">${dep}</div>
				`).join('')}
			</div>
			` : ''}

			${verdict.deadCode.length > 0 ? `
			<div class="details-section">
				<div class="details-section-title">🧹 Dead Code</div>
				${verdict.deadCode.map(dead => `
					<div class="details-item">
						${dead.name} (line ${dead.definedAt.line + 1})
						<button class="action-button danger" onclick="pruneCode('${dead.name}')">Prune</button>
					</div>
				`).join('')}
			</div>
			` : ''}

			${verdict.suggestions.length > 0 ? `
			<div class="details-section">
				<div class="details-section-title">💡 Suggestions</div>
				${verdict.suggestions.map(sugg => `
					<div class="details-item">${sugg.description}</div>
				`).join('')}
			</div>
			` : ''}

			<div class="legend">
				<div class="legend-item">
					<div class="legend-dot" style="background: #4ec9b0;"></div>
					<span>Verified</span>
				</div>
				<div class="legend-item">
					<div class="legend-dot" style="background: #dcdcaa;"></div>
					<span>Dead Code</span>
				</div>
				<div class="legend-item">
					<div class="legend-dot" style="background: #f48888;"></div>
					<span>Unresolved</span>
				</div>
			</div>
		</div>
	</div>

	<script>
		const visualization = ${JSON.stringify(visualization)};
		const tooltip = document.getElementById('tooltip');

		// Initialize D3 graph with performance optimizations (TAP-4.0)
		const svg = d3.select('#graph');
		const width = svg.node().clientWidth || 800;
		const height = svg.node().clientHeight || 600;

		// Safe node cap for high-performance rendering
		const MAX_RENDER_NODES = 150;
		const safeNodes = visualization.nodes.slice(0, MAX_RENDER_NODES);
		const nodeIds = new Set(safeNodes.map(n => n.id));
		const safeEdges = visualization.edges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));

		const simulation = d3.forceSimulation(safeNodes)
			.alphaDecay(0.05)
			.velocityDecay(0.4)
			.force('link', d3.forceLink(safeEdges)
				.id(d => d.id)
				.distance(80))
			.force('charge', d3.forceManyBody().strength(-200))
			.force('center', d3.forceCenter(width / 2, height / 2));

		// Draw links
		const link = svg.selectAll('.link')
			.data(safeEdges)
			.enter()
			.append('line')
			.attr('class', d => 'link ' + d.status)
			.attr('stroke-width', 2);

		// Draw nodes
		const node = svg.selectAll('.node')
			.data(safeNodes)
			.enter()
			.append('circle')
			.attr('class', d => 'node ' + d.status)
			.attr('r', 20)
			.call(d3.drag()
				.on('start', dragstarted)
				.on('drag', dragged)
				.on('end', dragended));

		// Add labels
		const labels = svg.selectAll('.node-label')
			.data(visualization.nodes)
			.enter()
			.append('text')
			.attr('class', 'node-label')
			.attr('text-anchor', 'middle')
			.attr('dy', '0.3em')
			.text(d => d.label.substring(0, 10));

		// Tooltips
		node.on('mouseover', function(event, d) {
			tooltip.style.display = 'block';
			tooltip.innerHTML = \`
				<strong>\${d.label}</strong><br>
				Type: \${d.type}<br>
				Line: \${d.line + 1}<br>
				Status: \${d.status}
			\`;
		})
		.on('mousemove', function(event) {
			tooltip.style.left = (event.pageX + 10) + 'px';
			tooltip.style.top = (event.pageY + 10) + 'px';
		})
		.on('mouseout', function() {
			tooltip.style.display = 'none';
		});

		// Update positions
		simulation.on('tick', () => {
			link
				.attr('x1', d => d.source.x)
				.attr('y1', d => d.source.y)
				.attr('x2', d => d.target.x)
				.attr('y2', d => d.target.y);

			node
				.attr('cx', d => d.x)
				.attr('cy', d => d.y);

			labels
				.attr('x', d => d.x)
				.attr('y', d => d.y);
		});

		function dragstarted(event, d) {
			if (!event.active) simulation.alphaTarget(0.3).restart();
			d.fx = d.x;
			d.fy = d.y;
		}

		function dragged(event, d) {
			d.fx = event.x;
			d.fy = event.y;
		}

		function dragended(event, d) {
			if (!event.active) simulation.alphaTarget(0);
			d.fx = null;
			d.fy = null;
		}

		function pruneCode(variable) {
			vscode.postMessage({
				command: 'prune',
				variable: variable
			});
		}

		// Handle window resize
		window.addEventListener('resize', () => {
			const newWidth = svg.node().clientWidth;
			const newHeight = svg.node().clientHeight;
			simulation.force('center', d3.forceCenter(newWidth / 2, newHeight / 2));
		});
	</script>
</body>
</html>`;
	}

	private handleWebviewMessage(message: any, code: string): void {
		switch (message.command) {
			case 'prune':
				this.pruneDeadCode(message.variable, code);
				break;
		}
	}

	private pruneDeadCode(variable: string, code: string): void {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;

		// Find and remove the variable declaration
		const lines = code.split('\n');
		const regex = new RegExp(`\\b(const|let|var)\\s+${variable}\\b.*`, 'g');

		let newCode = code;
		for (let i = 0; i < lines.length; i++) {
			if (regex.test(lines[i])) {
				lines.splice(i, 1);
				break;
			}
		}

		newCode = lines.join('\n');
		editor.edit(editBuilder => {
			const fullRange = new vscode.Range(
				new vscode.Position(0, 0),
				new vscode.Position(editor.document.lineCount, 0)
			);
			editBuilder.replace(fullRange, newCode);
		});

		vscode.window.showInformationMessage(`Pruned dead code: ${variable}`);
	}

	private getVerdictColor(verdict: string): string {
		switch (verdict) {
			case 'Verified':
				return '#4ec9b0';
			case 'AnomalyFlagged':
				return '#dcdcaa';
			case 'PhysicsViolation':
				return '#f48888';
			case 'TypeMismatch':
				return '#ce9178';
			default:
				return '#858585';
		}
	}

	private getVerdictEmoji(verdict: string): string {
		switch (verdict) {
			case 'Verified':
				return '✅';
			case 'AnomalyFlagged':
				return '⚠️';
			case 'PhysicsViolation':
				return '❌';
			case 'TypeMismatch':
				return '🔴';
			default:
				return '❓';
		}
	}
}
