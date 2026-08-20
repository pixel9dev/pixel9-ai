/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Pixel9. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IAquariumService } from './aquariumOverlay.js';
import { IMultiAgentOrchestrator, IAgent, IAgentExecutionResult, IArtifact } from '../../../services/agents/multiAgentOrchestrator.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../../workbench/common/contributions.js';

/**
 * Integration layer between Aquarium gamification and Multi-Agent Orchestrator
 * Feeds fish based on agent execution results and code quality
 */
export class AquariumAgentIntegration extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.aquariumAgentIntegration';

	constructor(
		@IAquariumService private aquariumService: IAquariumService,
		@IMultiAgentOrchestrator private orchestrator: IMultiAgentOrchestrator
	) {
		super();
		this.setupIntegration();
	}

	private setupIntegration(): void {
		// Listen to task completion events
		this._register(this.orchestrator.onTaskCompleted((result: IAgentExecutionResult) => {
			this.handleTaskCompletion(result);
		}));

		// Listen to agent status changes
		this._register(this.orchestrator.onAgentStatusChanged(({ agent, oldStatus }: { agent: IAgent; oldStatus: IAgent['status'] }) => {
			if (agent.status === 'completed' && oldStatus === 'running') {
				// Agent finished successfully
				this.aquariumService.feedFish(2);
			} else if (agent.status === 'error') {
				// Agent encountered an error
				this.aquariumService.updateWaterQuality('murky');
			}
		}));

		// Listen to artifact creation
		this._register(this.orchestrator.onArtifactCreated((artifact: IArtifact) => {
			if (artifact.type === 'file') {
				// File artifact created - feed fish
				this.aquariumService.feedFish(1);
			} else if (artifact.type === 'diff') {
				// Code change artifact - feed fish
				this.aquariumService.feedFish(2);
			}
		}));
	}

	private handleTaskCompletion(result: IAgentExecutionResult): void {
		if (result.success) {
			// Successful task execution
			const pelletCount = result.artifacts.length > 0 ? 5 : 3;
			this.aquariumService.feedFish(pelletCount);

			// Increment streak
			this.aquariumService.incrementStreak?.();

			// Update water quality
			this.aquariumService.updateWaterQuality('crystal');
		} else {
			// Failed task
			this.aquariumService.updateWaterQuality('toxic');
			this.aquariumService.resetStreak?.();
		}
	}
}

registerWorkbenchContribution2(AquariumAgentIntegration.ID, AquariumAgentIntegration, WorkbenchPhase.AfterRestored);
