/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Pixel9. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { KeybindingWeight, KeybindingsRegistry } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { ITelolexicTabService } from './telolexicTabService.js';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from '../../../../workbench/common/contributions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { LifecyclePhase } from '../../../../workbench/services/lifecycle/common/lifecycle.js';
import { Disposable } from '../../../../base/common/lifecycle.js';

export class TelolexicTabController extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.telolexicTabController';

	constructor(
		@ITelolexicTabService private readonly _tabService: ITelolexicTabService
	) {
		super();
		this._register(this._tabService.onDidChangeGhostEdits(() => {
			// Tab controller ghost edit listener
		}));
	}
}

// Register workbench contribution
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	TelolexicTabController,
	LifecyclePhase.Restored
);

// Register Commands
CommandsRegistry.registerCommand('sessions.telolexicTab.accept', async (accessor) => {
	const tabService = accessor.get(ITelolexicTabService);
	await tabService.acceptGhostEdit('active');
});

CommandsRegistry.registerCommand('sessions.telolexicTab.dismiss', (accessor) => {
	const tabService = accessor.get(ITelolexicTabService);
	tabService.dismissGhostEdits();
});

// Register Keybindings (Tab to accept causal ghost edit)
KeybindingsRegistry.registerKeybindingRule({
	id: 'sessions.telolexicTab.accept',
	weight: KeybindingWeight.WorkbenchContrib + 50,
	primary: KeyCode.Tab,
});

KeybindingsRegistry.registerKeybindingRule({
	id: 'sessions.telolexicTab.dismiss',
	weight: KeybindingWeight.WorkbenchContrib + 50,
	primary: KeyCode.Escape,
});
