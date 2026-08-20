/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Pixel9. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../base/common/lifecycle.js';
import { URI } from '../../../base/common/uri.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';

/**
 * Represents a single agent execution context
 */
export interface IAgent {
	id: string;
	name: string;
	status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
	model: string;
	systemPrompt: string;
	workspaceRoot: URI;
	gitWorktree?: string;
	createdAt: Date;
	completedAt?: Date;
}

/**
 * Represents an agent task/turn
 */
export interface IAgentTask {
	id: string;
	agentId: string;
	prompt: string;
	response?: string;
	artifacts: IArtifact[];
	status: 'pending' | 'running' | 'completed' | 'failed';
	startedAt?: Date;
	completedAt?: Date;
	error?: string;
}

/**
 * Represents an artifact (output from agent execution)
 */
export interface IArtifact {
	id: string;
	type: 'file' | 'screenshot' | 'log' | 'diff' | 'plan';
	title: string;
	content: string;
	mimeType?: string;
	createdAt: Date;
	metadata?: Record<string, any>;
}

/**
 * Represents a snapshot of workspace state at a point in time
 */
export interface IWorkspaceSnapshot {
	id: string;
	timestamp: Date;
	agentTurnId: string;
	files: Map<string, string>; // path -> content
	terminalOutput: string;
	gitStatus?: string;
}

/**
 * Agent execution result
 */
export interface IAgentExecutionResult {
	agentId: string;
	taskId: string;
	success: boolean;
	artifacts: IArtifact[];
	snapshot: IWorkspaceSnapshot;
	duration: number;
}

/**
 * Multi-Agent Orchestrator Service
 * Manages parallel agent execution, artifact tracking, and workspace snapshots
 */
export const IMultiAgentOrchestrator = createDecorator<IMultiAgentOrchestrator>('multiAgentOrchestrator');

export interface IMultiAgentOrchestrator extends IDisposable {
	readonly _serviceBrand: undefined;

	// Agent lifecycle
	createAgent(name: string, model: string, systemPrompt: string, workspaceRoot: URI): Promise<IAgent>;
	getAgent(agentId: string): IAgent | undefined;
	getAllAgents(): IAgent[];
	pauseAgent(agentId: string): Promise<void>;
	resumeAgent(agentId: string): Promise<void>;
	terminateAgent(agentId: string): Promise<void>;

	// Task execution
	executeTask(agentId: string, prompt: string): Promise<IAgentExecutionResult>;
	getTaskHistory(agentId: string): IAgentTask[];
	cancelTask(taskId: string): Promise<void>;

	// Artifact management
	getArtifacts(taskId: string): IArtifact[];
	createArtifact(taskId: string, type: IArtifact['type'], title: string, content: string, mimeType?: string): Promise<IArtifact>;

	// Workspace snapshots
	createSnapshot(agentTurnId: string, workspaceRoot: URI): Promise<IWorkspaceSnapshot>;
	getSnapshot(snapshotId: string): IWorkspaceSnapshot | undefined;
	getAllSnapshots(agentId: string): IWorkspaceSnapshot[];
	restoreSnapshot(snapshotId: string): Promise<void>;

	// Events
	onAgentCreated: Event<IAgent>;
	onAgentStatusChanged: Event<{ agent: IAgent; oldStatus: IAgent['status'] }>;
	onTaskCompleted: Event<IAgentExecutionResult>;
	onArtifactCreated: Event<IArtifact>;
}

/**
 * Implementation of Multi-Agent Orchestrator
 */
export class MultiAgentOrchestrator extends Disposable implements IMultiAgentOrchestrator {
	declare readonly _serviceBrand: undefined;

	private agents: Map<string, IAgent> = new Map();
	private tasks: Map<string, IAgentTask> = new Map();
	private artifacts: Map<string, IArtifact[]> = new Map();
	private snapshots: Map<string, IWorkspaceSnapshot> = new Map();
	private agentCounter = 0;

	private readonly _onAgentCreated = this._register(new Emitter<IAgent>());
	readonly onAgentCreated: Event<IAgent> = this._onAgentCreated.event;

	private readonly _onAgentStatusChanged = this._register(new Emitter<{ agent: IAgent; oldStatus: IAgent['status'] }>());
	readonly onAgentStatusChanged: Event<{ agent: IAgent; oldStatus: IAgent['status'] }> = this._onAgentStatusChanged.event;

	private readonly _onTaskCompleted = this._register(new Emitter<IAgentExecutionResult>());
	readonly onTaskCompleted: Event<IAgentExecutionResult> = this._onTaskCompleted.event;

	private readonly _onArtifactCreated = this._register(new Emitter<IArtifact>());
	readonly onArtifactCreated: Event<IArtifact> = this._onArtifactCreated.event;

	async createAgent(name: string, model: string, systemPrompt: string, workspaceRoot: URI): Promise<IAgent> {
		const agentId = `agent-${++this.agentCounter}`;
		const agent: IAgent = {
			id: agentId,
			name,
			status: 'idle',
			model,
			systemPrompt,
			workspaceRoot,
			createdAt: new Date()
		};

		this.agents.set(agentId, agent);
		this._onAgentCreated.fire(agent);

		return agent;
	}

	getAgent(agentId: string): IAgent | undefined {
		return this.agents.get(agentId);
	}

	getAllAgents(): IAgent[] {
		return Array.from(this.agents.values());
	}

	async pauseAgent(agentId: string): Promise<void> {
		const agent = this.agents.get(agentId);
		if (agent && agent.status === 'running') {
			const oldStatus = agent.status;
			agent.status = 'paused';
			this._onAgentStatusChanged.fire({ agent, oldStatus });
		}
	}

	async resumeAgent(agentId: string): Promise<void> {
		const agent = this.agents.get(agentId);
		if (agent && agent.status === 'paused') {
			const oldStatus = agent.status;
			agent.status = 'running';
			this._onAgentStatusChanged.fire({ agent, oldStatus });
		}
	}

	async terminateAgent(agentId: string): Promise<void> {
		const agent = this.agents.get(agentId);
		if (agent) {
			const oldStatus = agent.status;
			agent.status = 'completed';
			agent.completedAt = new Date();
			this._onAgentStatusChanged.fire({ agent, oldStatus });
		}
	}

	async executeTask(agentId: string, prompt: string): Promise<IAgentExecutionResult> {
		const agent = this.agents.get(agentId);
		if (!agent) {
			throw new Error(`Agent ${agentId} not found`);
		}

		const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		const task: IAgentTask = {
			id: taskId,
			agentId,
			prompt,
			artifacts: [],
			status: 'running',
			startedAt: new Date()
		};

		this.tasks.set(taskId, task);

		const oldStatus = agent.status;
		agent.status = 'running';
		this._onAgentStatusChanged.fire({ agent, oldStatus });

		try {
			// Simulate agent execution
			// In production, this would call the actual LLM provider
			const startTime = Date.now();

			// Create a mock response and artifacts
			const response = await this.simulateAgentExecution(prompt, agent);
			task.response = response;

			// Create workspace snapshot
			const snapshot = await this.createSnapshot(taskId, agent.workspaceRoot);

			// Create artifacts
			const artifacts: IArtifact[] = [];
			artifacts.push({
				id: `artifact-${taskId}-plan`,
				type: 'plan',
				title: 'Agent Plan',
				content: `Plan for: ${prompt}`,
				createdAt: new Date()
			});

			task.artifacts = artifacts;
			task.status = 'completed';
			task.completedAt = new Date();

			this.artifacts.set(taskId, artifacts);

			const result: IAgentExecutionResult = {
				agentId,
				taskId,
				success: true,
				artifacts,
				snapshot,
				duration: Date.now() - startTime
			};

			agent.status = 'idle';
			this._onAgentStatusChanged.fire({ agent, oldStatus: 'running' });
			this._onTaskCompleted.fire(result);

			return result;
		} catch (error) {
			task.status = 'failed';
			task.error = error instanceof Error ? error.message : String(error);
			task.completedAt = new Date();

			agent.status = 'error';
			this._onAgentStatusChanged.fire({ agent, oldStatus });

			throw error;
		}
	}

	getTaskHistory(agentId: string): IAgentTask[] {
		return Array.from(this.tasks.values()).filter(t => t.agentId === agentId);
	}

	async cancelTask(taskId: string): Promise<void> {
		const task = this.tasks.get(taskId);
		if (task && task.status === 'running') {
			task.status = 'failed';
			task.error = 'Task cancelled by user';
			task.completedAt = new Date();
		}
	}

	getArtifacts(taskId: string): IArtifact[] {
		return this.artifacts.get(taskId) ?? [];
	}

	async createArtifact(taskId: string, type: IArtifact['type'], title: string, content: string, mimeType?: string): Promise<IArtifact> {
		const artifact: IArtifact = {
			id: `artifact-${taskId}-${Date.now()}`,
			type,
			title,
			content,
			mimeType,
			createdAt: new Date()
		};

		if (!this.artifacts.has(taskId)) {
			this.artifacts.set(taskId, []);
		}

		this.artifacts.get(taskId)!.push(artifact);
		this._onArtifactCreated.fire(artifact);

		return artifact;
	}

	async createSnapshot(agentTurnId: string, workspaceRoot: URI): Promise<IWorkspaceSnapshot> {
		const snapshotId = `snapshot-${Date.now()}`;
		const snapshot: IWorkspaceSnapshot = {
			id: snapshotId,
			timestamp: new Date(),
			agentTurnId,
			files: new Map(),
			terminalOutput: '',
			gitStatus: ''
		};

		// In production, this would read actual workspace files
		this.snapshots.set(snapshotId, snapshot);

		return snapshot;
	}

	getSnapshot(snapshotId: string): IWorkspaceSnapshot | undefined {
		return this.snapshots.get(snapshotId);
	}

	getAllSnapshots(agentId: string): IWorkspaceSnapshot[] {
		const agentTasks = this.getTaskHistory(agentId);
		const taskIds = new Set(agentTasks.map(t => t.id));
		return Array.from(this.snapshots.values()).filter(s => taskIds.has(s.agentTurnId));
	}

	async restoreSnapshot(snapshotId: string): Promise<void> {
		const snapshot = this.snapshots.get(snapshotId);
		if (!snapshot) {
			throw new Error(`Snapshot ${snapshotId} not found`);
		}

		// In production, this would restore workspace files from snapshot
		// For now, just log the restoration
		console.log(`Restoring snapshot ${snapshotId} from ${snapshot.timestamp}`);
	}

	private async simulateAgentExecution(prompt: string, agent: IAgent): Promise<string> {
		// Simulate agent thinking time
		await new Promise(resolve => setTimeout(resolve, 1000));

		return `Agent ${agent.name} processed: "${prompt}"`;
	}
}
