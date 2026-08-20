/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Pixel9. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IViewsService } from '../../../../workbench/services/views/common/viewsService.js';
import { IMultiAgentOrchestrator } from '../../../services/agents/multiAgentOrchestrator.js';

const CATEGORY = localize2('agentManager.category', 'Agent Manager');

/**
 * Action to show the Agent Manager view
 */
class ShowAgentManagerAction extends Action2 {
	constructor() {
		super({
			id: 'sessions.agentManager.show',
			title: localize2('agentManager.show', 'Show Agent Manager'),
			category: CATEGORY,
			f1: true
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		await viewsService.openView('agentManager', true);
	}
}

/**
 * Action to create a new agent
 */
class CreateAgentAction extends Action2 {
	constructor() {
		super({
			id: 'sessions.agentManager.createAgent',
			title: localize2('agentManager.createAgent', 'Create New Agent'),
			category: CATEGORY
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const orchestrator = accessor.get(IMultiAgentOrchestrator);
		const viewsService = accessor.get(IViewsService);

		// Create a new agent with default settings
		await orchestrator.createAgent(
			`Agent ${orchestrator.getAllAgents().length + 1}`,
			'gpt-4',
			'You are a helpful coding assistant.',
			undefined as any // Will be set by UI
		);

		// Show the Agent Manager view
		await viewsService.openView('agentManager', true);
	}
}

/**
 * Register all Agent Manager actions and views
 */
registerAction2(ShowAgentManagerAction);
registerAction2(CreateAgentAction);
