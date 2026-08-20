/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Pixel9. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from '../../../platform/instantiation/common/extensions.js';
import { ISelfHealingService, SelfHealingService } from './selfHealingService.js';

/**
 * Registers the provider-neutral self-healing coordinator for the Sessions workbench.
 */
registerSingleton(ISelfHealingService, SelfHealingService, InstantiationType.Delayed);
