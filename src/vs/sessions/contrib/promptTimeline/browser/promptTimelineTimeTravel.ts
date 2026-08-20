/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Pixel9. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { IChatWidgetService } from '../../../../workbench/contrib/chat/browser/chat.js';
import { ChatContextKeys } from '../../../../workbench/contrib/chat/common/actions/chatContextKeys.js';
import { ISessionsService } from '../../../services/sessions/browser/sessionsService.js';
import { PROMPT_TIMELINE_RAIL_SETTING, PROMPT_TIMELINE_STICKY_HEADER_SETTING } from '../common/promptTimeline.js';
import { PromptTimelineWidgetContrib } from './promptTimelineWidgetContrib.js';
import { IWorkspaceSnapshotService, IFileDiff } from '../common/workspaceSnapshot.js';

const CATEGORY = localize2('promptTimeline.category', 'Chat');

/** True when at least one prompt timeline surface (rail or sticky header) is enabled. */
const TIMELINE_ENABLED = ContextKeyExpr.or(
	ContextKeyExpr.equals(`config.${PROMPT_TIMELINE_RAIL_SETTING}`, true),
	ContextKeyExpr.equals(`config.${PROMPT_TIMELINE_STICKY_HEADER_SETTING}`, true),
);

/** Commands require AI features to be on and at least one prompt timeline surface to be enabled. */
const TIMELINE_PRECONDITION = ContextKeyExpr.and(ChatContextKeys.enabled, TIMELINE_ENABLED);

/** Resolves the prompt timeline contribution for the active session's chat widget. */
function getPromptTimeline(accessor: ServicesAccessor): PromptTimelineWidgetContrib | undefined {
	const widgetService = accessor.get(IChatWidgetService);
	const sessionsService = accessor.get(ISessionsService);
	const resource = sessionsService.activeSession.get()?.activeChat.get().resource;
	const widget = (resource && widgetService.getWidgetBySessionResource(resource)) ?? widgetService.lastFocusedWidget;
	return widget?.getContrib<PromptTimelineWidgetContrib>(PromptTimelineWidgetContrib.ID);
}

interface IPromptPickItem extends IQuickPickItem {
	readonly requestId: string;
	readonly snapshotId?: string;
}

/**
 * Time-travel to a specific prompt in the timeline
 */
class TimeTravelToPromptAction extends Action2 {
	constructor() {
		super({
			id: 'sessions.promptTimeline.timeTravel',
			title: localize2('promptTimeline.timeTravel', 'Time Travel to Prompt'),
			category: CATEGORY,
			f1: true,
			precondition: TIMELINE_PRECONDITION,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const contrib = getPromptTimeline(accessor);
		const prompts = contrib?.getAllPrompts() ?? [];
		if (!contrib || prompts.length === 0) {
			return;
		}

		const quickInputService = accessor.get(IQuickInputService);
		const snapshotService = accessor.get(IWorkspaceSnapshotService);

		const items: IPromptPickItem[] = prompts.map((prompt, index) => ({
			label: prompt.text || localize('promptTimeline.emptyPrompt', '(empty prompt)'),
			description: `Turn ${index + 1}`,
			requestId: prompt.requestId,
			snapshotId: `snapshot-${prompt.requestId}`,
		}));

		const picked = await quickInputService.pick(items, {
			placeHolder: localize('promptTimeline.timeTravelPlaceholder', 'Select a point in time to travel to'),
			matchOnDescription: true,
		});

		if (picked && picked.snapshotId) {
			// Restore workspace to that snapshot
			await snapshotService.restoreSnapshot(picked.snapshotId);
		}
	}
}

/**
 * Show workspace diff between two prompts
 */
class ShowWorkspaceDiffAction extends Action2 {
	constructor() {
		super({
			id: 'sessions.promptTimeline.showDiff',
			title: localize2('promptTimeline.showDiff', 'Show Workspace Changes'),
			category: CATEGORY,
			f1: true,
			precondition: TIMELINE_PRECONDITION,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const contrib = getPromptTimeline(accessor);
		const prompts = contrib?.getAllPrompts() ?? [];
		if (!contrib || prompts.length < 2) {
			return;
		}

		const quickInputService = accessor.get(IQuickInputService);
		const snapshotService = accessor.get(IWorkspaceSnapshotService);

		// Pick "from" snapshot
		const fromItems: IPromptPickItem[] = prompts.map((prompt, index) => ({
			label: prompt.text || localize('promptTimeline.emptyPrompt', '(empty prompt)'),
			description: `Turn ${index + 1}`,
			requestId: prompt.requestId,
			snapshotId: `snapshot-${prompt.requestId}`,
		}));

		const fromPicked = await quickInputService.pick(fromItems, {
			placeHolder: localize('promptTimeline.pickFromPrompt', 'Select starting point'),
		});

		if (!fromPicked?.snapshotId) {
			return;
		}

		// Pick "to" snapshot
		const toPicked = await quickInputService.pick(fromItems, {
			placeHolder: localize('promptTimeline.pickToPrompt', 'Select ending point'),
		});

		if (!toPicked?.snapshotId) {
			return;
		}

		// Get diff
		const diffs = snapshotService.getDiff(fromPicked.snapshotId, toPicked.snapshotId);

		// Show diff in output channel
		const diffText = diffs.map((diff: IFileDiff) => {
			const action = diff.added ? 'Added' : diff.deleted ? 'Deleted' : 'Modified';
			return `${action}: ${diff.path}`;
		}).join('\n');

		console.log('Workspace changes:', diffText);
	}
}

/**
 * Register all time-travel related actions
 */
export function registerPromptTimelineTravelActions(): void {
	registerAction2(TimeTravelToPromptAction);
	registerAction2(ShowWorkspaceDiffAction);
}
