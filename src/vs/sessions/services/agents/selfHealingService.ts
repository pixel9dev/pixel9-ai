/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Pixel9. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { IAgentExecutionResult, IMultiAgentOrchestrator } from './multiAgentOrchestrator.js';

const MAX_REPAIR_ATTEMPTS = 5;
const MAX_RETAINED_STATES = 25;

/**
 * The outcome of one validation pass in a self-healing workflow.
 */
export interface IHealingValidationResult {
	readonly isValid: boolean;
	readonly summary: string;
	readonly repairInstructions: readonly string[];
}

/**
 * Validates an agent result before it is accepted by a self-healing workflow.
 */
export interface IHealingValidator {
	validate(result: IAgentExecutionResult): Promise<IHealingValidationResult>;
}

/**
 * State exposed while an agent iterates through validation and repair attempts.
 */
export interface ISelfHealingState {
	readonly iteration: number;
	readonly maxIterations: number;
	readonly validation?: IHealingValidationResult;
	readonly status: 'healing' | 'verified' | 'failed';
}

/**
 * Coordinates repeatable generation, validation, and repair without coupling the
 * sessions workbench to a particular extension or model provider.
 */
export const ISelfHealingService = createDecorator<ISelfHealingService>('selfHealingService');

export interface ISelfHealingService {
	readonly _serviceBrand: undefined;

	/**
	 * Executes an agent task until the supplied validator accepts the result or
	 * the attempt limit is reached.
	 */
	heal(agentId: string, prompt: string, validator: IHealingValidator, maxIterations?: number): Promise<IAgentExecutionResult>;

	/**
	 * Returns the most recently recorded workflow state for an agent.
	 */
	getState(agentId: string): ISelfHealingState | undefined;

	readonly onLoopIteration: Event<{ readonly agentId: string; readonly state: ISelfHealingState }>;
	readonly onLoopCompleted: Event<{ readonly agentId: string; readonly result: IAgentExecutionResult; readonly state: ISelfHealingState }>;
}

export class SelfHealingService extends Disposable implements ISelfHealingService {
	declare readonly _serviceBrand: undefined;

	private readonly states = new Map<string, ISelfHealingState>();

	private readonly _onLoopIteration = this._register(new Emitter<{ readonly agentId: string; readonly state: ISelfHealingState }>());
	readonly onLoopIteration: Event<{ readonly agentId: string; readonly state: ISelfHealingState }> = this._onLoopIteration.event;

	private readonly _onLoopCompleted = this._register(new Emitter<{ readonly agentId: string; readonly result: IAgentExecutionResult; readonly state: ISelfHealingState }>());
	readonly onLoopCompleted: Event<{ readonly agentId: string; readonly result: IAgentExecutionResult; readonly state: ISelfHealingState }> = this._onLoopCompleted.event;

	constructor(
		@IMultiAgentOrchestrator private readonly orchestrator: IMultiAgentOrchestrator,
	) {
		super();
	}

	async heal(agentId: string, prompt: string, validator: IHealingValidator, maxIterations: number = 3): Promise<IAgentExecutionResult> {
		const attempts = Math.min(Math.max(1, maxIterations), MAX_REPAIR_ATTEMPTS);
		let currentPrompt = prompt;
		let lastResult: IAgentExecutionResult | undefined;
		let lastValidation: IHealingValidationResult | undefined;

		for (let iteration = 1; iteration <= attempts; iteration++) {
			this.storeState(agentId, {
				iteration,
				maxIterations: attempts,
				validation: lastValidation,
				status: 'healing',
			});

			lastResult = await this.orchestrator.executeTask(agentId, currentPrompt);
			lastValidation = await validator.validate(lastResult);

			if (lastValidation.isValid) {
				const state: ISelfHealingState = {
					iteration,
					maxIterations: attempts,
					validation: lastValidation,
					status: 'verified',
				};
				this.storeState(agentId, state);
				this._onLoopCompleted.fire({ agentId, result: lastResult, state });
				return lastResult;
			}

			await this.orchestrator.createArtifact(
				lastResult.taskId,
				'log',
				`Repair Attempt ${iteration}`,
				lastValidation.summary,
				'text/plain',
			);
			currentPrompt = this.createRepairPrompt(prompt, lastValidation);
		}

		if (!lastResult || !lastValidation) {
			throw new Error('The self-healing workflow did not execute an agent task.');
		}

		const state: ISelfHealingState = {
			iteration: attempts,
			maxIterations: attempts,
			validation: lastValidation,
			status: 'failed',
		};
		this.storeState(agentId, state);
		this._onLoopCompleted.fire({ agentId, result: lastResult, state });
		return lastResult;
	}

	getState(agentId: string): ISelfHealingState | undefined {
		return this.states.get(agentId);
	}

	private createRepairPrompt(originalPrompt: string, validation: IHealingValidationResult): string {
		const repairInstructions = validation.repairInstructions.map(instruction => `- ${instruction}`).join('\n');
		return `${originalPrompt}\n\nValidation feedback:\n${validation.summary}\n\nRequired repairs:\n${repairInstructions}`;
	}

	private storeState(agentId: string, state: ISelfHealingState): void {
		if (!this.states.has(agentId) && this.states.size >= MAX_RETAINED_STATES) {
			const oldestAgentId = this.states.keys().next().value;
			if (oldestAgentId !== undefined) {
				this.states.delete(oldestAgentId);
			}
		}
		this.states.set(agentId, state);
		this._onLoopIteration.fire({ agentId, state });
	}
}
