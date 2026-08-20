/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Pixel9. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from '../../../platform/instantiation/common/extensions.js';
import { IMultiAgentOrchestrator, MultiAgentOrchestrator } from './multiAgentOrchestrator.js';

/**
 * Register the Multi-Agent Orchestrator as a singleton service
 * This makes it available throughout the sessions layer via dependency injection
 */
registerSingleton(IMultiAgentOrchestrator, MultiAgentOrchestrator, InstantiationType.Delayed);
