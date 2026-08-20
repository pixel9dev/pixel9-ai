/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Pixel9. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IMultiAgentOrchestrator, IAgent, IAgentExecutionResult } from '../../../services/agents/multiAgentOrchestrator.js';
import { URI } from '../../../../base/common/uri.js';

/**
 * Agent Manager View - UI for orchestrating multiple agents
 * Displays active agents, their status, tasks, and artifacts
 */
export class AgentManagerView extends Disposable {
	private container: HTMLElement;
	private agents: Map<string, IAgent> = new Map();
	private selectedAgentId: string | undefined;

	private readonly _onAgentSelected = this._register(new Emitter<string>());
	readonly onAgentSelected: Event<string> = this._onAgentSelected.event;

	constructor(
		container: HTMLElement,
		@IMultiAgentOrchestrator private orchestrator: IMultiAgentOrchestrator
	) {
		super();
		this.container = container;
		this.render();
		this.registerListeners();
	}

	private render(): void {
		this.container.innerHTML = `
			<div class="agent-manager">
				<div class="agent-manager-header">
					<h2>${localize('agentManager.title', 'Agent Manager')}</h2>
					<button class="create-agent-btn" id="createAgentBtn">
						${localize('agentManager.createAgent', '+ Create Agent')}
					</button>
				</div>

				<div class="agent-list" id="agentList">
					<div class="empty-state">
						${localize('agentManager.noAgents', 'No agents running. Create one to get started.')}
					</div>
				</div>

				<div class="agent-details" id="agentDetails" style="display: none;">
					<div class="agent-details-header">
						<h3 id="agentName"></h3>
						<div class="agent-actions">
							<button class="btn-secondary" id="pauseResumeBtn">Pause</button>
							<button class="btn-danger" id="terminateBtn">Terminate</button>
						</div>
					</div>

					<div class="agent-info">
						<div class="info-row">
							<span class="label">Status:</span>
							<span class="value" id="agentStatus"></span>
						</div>
						<div class="info-row">
							<span class="label">Model:</span>
							<span class="value" id="agentModel"></span>
						</div>
						<div class="info-row">
							<span class="label">Created:</span>
							<span class="value" id="agentCreated"></span>
						</div>
					</div>

					<div class="task-history">
						<h4>${localize('agentManager.taskHistory', 'Task History')}</h4>
						<div class="task-list" id="taskList"></div>
					</div>

					<div class="artifacts-panel">
						<h4>${localize('agentManager.artifacts', 'Artifacts')}</h4>
						<div class="artifacts-list" id="artifactsList"></div>
					</div>
				</div>
			</div>

			<style>
				.agent-manager {
					display: flex;
					flex-direction: column;
					height: 100%;
					background: #1e1e1e;
					color: #e0e0e0;
					font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
				}

				.agent-manager-header {
					padding: 16px;
					border-bottom: 1px solid #3e3e42;
					display: flex;
					justify-content: space-between;
					align-items: center;
				}

				.agent-manager-header h2 {
					margin: 0;
					font-size: 16px;
					font-weight: 600;
				}

				.create-agent-btn {
					padding: 8px 12px;
					background: #007acc;
					color: white;
					border: none;
					border-radius: 3px;
					cursor: pointer;
					font-size: 12px;
				}

				.create-agent-btn:hover {
					background: #005a9e;
				}

				.agent-list {
					flex: 1;
					overflow-y: auto;
					border-right: 1px solid #3e3e42;
					min-width: 250px;
				}

				.agent-item {
					padding: 12px 16px;
					border-bottom: 1px solid #3e3e42;
					cursor: pointer;
					transition: background 0.2s;
				}

				.agent-item:hover {
					background: #2d2d30;
				}

				.agent-item.selected {
					background: #007acc;
					border-left: 3px solid #4ec9b0;
				}

				.agent-item-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 6px;
				}

				.agent-item-name {
					font-weight: 600;
					font-size: 13px;
				}

				.agent-status-badge {
					display: inline-block;
					padding: 2px 8px;
					border-radius: 12px;
					font-size: 11px;
					font-weight: 500;
				}

				.agent-status-badge.idle {
					background: #4ec9b020;
					color: #4ec9b0;
				}

				.agent-status-badge.running {
					background: #dcdcaa20;
					color: #dcdcaa;
					animation: pulse 1.5s infinite;
				}

				.agent-status-badge.paused {
					background: #858585;
					color: #1e1e1e;
				}

				.agent-status-badge.error {
					background: #f4888820;
					color: #f48888;
				}

				@keyframes pulse {
					0%, 100% { opacity: 1; }
					50% { opacity: 0.6; }
				}

				.agent-item-meta {
					font-size: 11px;
					color: #858585;
				}

				.empty-state {
					padding: 32px 16px;
					text-align: center;
					color: #858585;
					font-size: 13px;
				}

				.agent-details {
					flex: 1;
					padding: 16px;
					overflow-y: auto;
				}

				.agent-details-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 16px;
					border-bottom: 1px solid #3e3e42;
					padding-bottom: 12px;
				}

				.agent-details-header h3 {
					margin: 0;
					font-size: 16px;
				}

				.agent-actions {
					display: flex;
					gap: 8px;
				}

				.btn-secondary, .btn-danger {
					padding: 6px 12px;
					border: none;
					border-radius: 3px;
					cursor: pointer;
					font-size: 12px;
				}

				.btn-secondary {
					background: #3e3e42;
					color: #e0e0e0;
				}

				.btn-secondary:hover {
					background: #4e4e54;
				}

				.btn-danger {
					background: #f48888;
					color: #1e1e1e;
				}

				.btn-danger:hover {
					background: #d46666;
				}

				.agent-info {
					margin-bottom: 16px;
					padding: 12px;
					background: #252526;
					border-radius: 3px;
				}

				.info-row {
					display: flex;
					justify-content: space-between;
					font-size: 12px;
					margin-bottom: 8px;
				}

				.info-row .label {
					color: #858585;
					font-weight: 500;
				}

				.info-row .value {
					color: #e0e0e0;
				}

				.task-history, .artifacts-panel {
					margin-bottom: 16px;
				}

				.task-history h4, .artifacts-panel h4 {
					margin: 0 0 8px 0;
					font-size: 12px;
					font-weight: 600;
					color: #4ec9b0;
					text-transform: uppercase;
				}

				.task-item, .artifact-item {
					padding: 8px;
					background: #252526;
					border-radius: 3px;
					margin-bottom: 6px;
					font-size: 11px;
					border-left: 2px solid #3e3e42;
				}

				.task-item.completed {
					border-left-color: #4ec9b0;
				}

				.task-item.failed {
					border-left-color: #f48888;
				}

				.task-item-text {
					color: #e0e0e0;
					margin-bottom: 4px;
				}

				.task-item-meta {
					color: #858585;
					font-size: 10px;
				}
			</style>
		`;

		this.attachEventListeners();
	}

	private registerListeners(): void {
		this._register(this.orchestrator.onAgentCreated((agent: IAgent) => {
			this.agents.set(agent.id, agent);
			this.updateAgentList();
		}));

		this._register(this.orchestrator.onAgentStatusChanged(({ agent }: { agent: IAgent; oldStatus: IAgent['status'] }) => {
			this.agents.set(agent.id, agent);
			this.updateAgentList();
			if (this.selectedAgentId === agent.id) {
				this.updateAgentDetails(agent);
			}
		}));

		this._register(this.orchestrator.onTaskCompleted((result: IAgentExecutionResult) => {
			if (this.selectedAgentId === result.agentId) {
				const agent = this.orchestrator.getAgent(result.agentId);
				if (agent) {
					this.updateAgentDetails(agent);
				}
			}
		}));
	}

	private attachEventListeners(): void {
		const createBtn = this.container.querySelector('#createAgentBtn');
		if (createBtn) {
			createBtn.addEventListener('click', () => this.createAgent());
		}
	}

	private async createAgent(): Promise<void> {
		// In production, show a dialog to configure the agent
		const agent = await this.orchestrator.createAgent(
			`Agent ${this.agents.size + 1}`,
			'gpt-4',
			'You are a helpful coding assistant.',
			URI.file('/workspace')
		);

		this.agents.set(agent.id, agent);
		this.updateAgentList();
	}

	private updateAgentList(): void {
		const agentList = this.container.querySelector('#agentList');
		if (!agentList) return;

		if (this.agents.size === 0) {
			agentList.innerHTML = `
				<div class="empty-state">
					${localize('agentManager.noAgents', 'No agents running. Create one to get started.')}
				</div>
			`;
			return;
		}

		agentList.innerHTML = Array.from(this.agents.values()).map(agent => `
			<div class="agent-item ${this.selectedAgentId === agent.id ? 'selected' : ''}" data-agent-id="${agent.id}">
				<div class="agent-item-header">
					<span class="agent-item-name">${agent.name}</span>
					<span class="agent-status-badge ${agent.status}">${agent.status}</span>
				</div>
				<div class="agent-item-meta">
					Model: ${agent.model}
				</div>
			</div>
		`).join('');

		// Attach click listeners
		agentList.querySelectorAll('.agent-item').forEach(item => {
			item.addEventListener('click', () => {
				const agentId = (item as HTMLElement).getAttribute('data-agent-id');
				if (agentId) {
					this.selectAgent(agentId);
				}
			});
		});
	}

	private selectAgent(agentId: string): void {
		this.selectedAgentId = agentId;
		const agent = this.agents.get(agentId);
		if (agent) {
			this.updateAgentList();
			this.updateAgentDetails(agent);
			this._onAgentSelected.fire(agentId);
		}
	}

	private updateAgentDetails(agent: IAgent): void {
		const details = this.container.querySelector('#agentDetails') as HTMLElement;
		if (!details) return;

		details.style.display = 'block';

		const nameEl = this.container.querySelector('#agentName');
		if (nameEl) nameEl.textContent = agent.name;

		const statusEl = this.container.querySelector('#agentStatus');
		if (statusEl) statusEl.textContent = agent.status;

		const modelEl = this.container.querySelector('#agentModel');
		if (modelEl) modelEl.textContent = agent.model;

		const createdEl = this.container.querySelector('#agentCreated');
		if (createdEl) createdEl.textContent = new Date(agent.createdAt).toLocaleString();

		// Update task history
		const taskList = this.container.querySelector('#taskList');
		if (taskList) {
			const tasks = this.orchestrator.getTaskHistory(agent.id);
			taskList.innerHTML = tasks.map(task => `
				<div class="task-item ${task.status}">
					<div class="task-item-text">${task.prompt.substring(0, 50)}...</div>
					<div class="task-item-meta">
						Status: ${task.status} | Artifacts: ${task.artifacts.length}
					</div>
				</div>
			`).join('');
		}

		// Update button listeners
		const pauseBtn = this.container.querySelector('#pauseResumeBtn');
		if (pauseBtn) {
			pauseBtn.textContent = agent.status === 'paused' ? 'Resume' : 'Pause';
			pauseBtn.addEventListener('click', () => {
				if (agent.status === 'paused') {
					this.orchestrator.resumeAgent(agent.id);
				} else if (agent.status === 'running') {
					this.orchestrator.pauseAgent(agent.id);
				}
			});
		}

		const terminateBtn = this.container.querySelector('#terminateBtn');
		if (terminateBtn) {
			terminateBtn.addEventListener('click', () => {
				this.orchestrator.terminateAgent(agent.id);
			});
		}
	}
}
