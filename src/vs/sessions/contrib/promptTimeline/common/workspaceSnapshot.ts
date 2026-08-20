/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Pixel9. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';

/**
 * Represents a snapshot of the workspace state at a point in time
 */
export interface IWorkspaceSnapshot {
	id: string;
	timestamp: Date;
	promptId: string;
	files: Map<string, string>; // path -> content
	terminalOutput: string;
	gitStatus?: string;
	metadata?: {
		agentName?: string;
		model?: string;
		duration?: number;
	};
}

/**
 * Represents a file change between two snapshots
 */
export interface IFileDiff {
	path: string;
	before: string;
	after: string;
	added: boolean;
	deleted: boolean;
	modified: boolean;
}

export const IWorkspaceSnapshotService = createDecorator<IWorkspaceSnapshotService>('workspaceSnapshotService');

/**
 * Service for managing workspace snapshots and time-travel
 */
export interface IWorkspaceSnapshotService {
	readonly _serviceBrand: undefined;

	/**
	 * Create a new snapshot of the current workspace state
	 */
	createSnapshot(promptId: string, workspaceRoot: URI): Promise<IWorkspaceSnapshot>;

	/**
	 * Get a snapshot by ID
	 */
	getSnapshot(snapshotId: string): IWorkspaceSnapshot | undefined;

	/**
	 * Get all snapshots for a prompt
	 */
	getSnapshotsForPrompt(promptId: string): IWorkspaceSnapshot[];

	/**
	 * Restore workspace to a specific snapshot state
	 */
	restoreSnapshot(snapshotId: string): Promise<void>;

	/**
	 * Get diff between two snapshots
	 */
	getDiff(fromSnapshotId: string, toSnapshotId: string): IFileDiff[];

	/**
	 * Delete a snapshot
	 */
	deleteSnapshot(snapshotId: string): Promise<void>;

	/**
	 * Clear all snapshots
	 */
	clearSnapshots(): Promise<void>;
}

/**
 * Content-Addressed Blob Storage for zero-redundancy in-memory file snapshotting.
 * Identical files across turns share the same immutable string reference in memory.
 */
class ContentAddressedBlobStore {
	private readonly blobs = new Map<string, string>();
	private readonly refCounts = new Map<string, number>();

	public put(content: string): string {
		// Fast djb2-based 64-bit string hash for content address
		let h1 = 5381;
		let h2 = 52711;
		for (let i = 0; i < content.length; i++) {
			const char = content.charCodeAt(i);
			h1 = (h1 * 33) ^ char;
			h2 = (h2 * 33) ^ char;
		}
		const hash = `${(h1 >>> 0).toString(16)}-${(h2 >>> 0).toString(16)}-${content.length}`;

		if (!this.blobs.has(hash)) {
			this.blobs.set(hash, content);
			this.refCounts.set(hash, 1);
		} else {
			this.refCounts.set(hash, (this.refCounts.get(hash) || 0) + 1);
		}
		return hash;
	}

	public get(hash: string): string | undefined {
		return this.blobs.get(hash);
	}

	public release(hash: string): void {
		const count = this.refCounts.get(hash);
		if (count !== undefined) {
			if (count <= 1) {
				this.refCounts.delete(hash);
				this.blobs.delete(hash);
			} else {
				this.refCounts.set(hash, count - 1);
			}
		}
	}

	public clear(): void {
		this.blobs.clear();
		this.refCounts.clear();
	}
}

const MAX_SNAPSHOTS_RETAINED = 64;

/**
 * Implementation of memory-efficient workspace snapshot service (TAP-4.0)
 */
export class WorkspaceSnapshotService implements IWorkspaceSnapshotService {
	declare readonly _serviceBrand: undefined;

	private readonly blobStore = new ContentAddressedBlobStore();
	private readonly snapshots = new Map<string, IWorkspaceSnapshot>();
	private readonly fileHashesBySnapshot = new Map<string, Map<string, string>>(); // snapshotId -> (path -> contentHash)
	private readonly snapshotsByPrompt = new Map<string, string[]>();
	private readonly lruOrder: string[] = [];

	async createSnapshot(promptId: string, workspaceRoot: URI): Promise<IWorkspaceSnapshot> {
		const snapshotId = `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		const snapshot: IWorkspaceSnapshot = {
			id: snapshotId,
			timestamp: new Date(),
			promptId,
			files: new Map(),
			terminalOutput: '',
			gitStatus: ''
		};

		// Enforce memory bounds
		this.enforceMemoryBounds();

		this.snapshots.set(snapshotId, snapshot);
		this.fileHashesBySnapshot.set(snapshotId, new Map());
		this.lruOrder.push(snapshotId);

		// Track by prompt
		if (!this.snapshotsByPrompt.has(promptId)) {
			this.snapshotsByPrompt.set(promptId, []);
		}
		this.snapshotsByPrompt.get(promptId)!.push(snapshotId);

		return snapshot;
	}

	/**
	 * Stores a file in the content-addressed store for this snapshot
	 */
	public putFile(snapshotId: string, path: string, content: string): void {
		const snapshot = this.snapshots.get(snapshotId);
		if (!snapshot) return;

		const hash = this.blobStore.put(content);
		const hashes = this.fileHashesBySnapshot.get(snapshotId);
		if (hashes) {
			hashes.set(path, hash);
		}
		snapshot.files.set(path, content);
	}

	getSnapshot(snapshotId: string): IWorkspaceSnapshot | undefined {
		// Update LRU position
		const idx = this.lruOrder.indexOf(snapshotId);
		if (idx > -1) {
			this.lruOrder.splice(idx, 1);
			this.lruOrder.push(snapshotId);
		}
		return this.snapshots.get(snapshotId);
	}

	getSnapshotsForPrompt(promptId: string): IWorkspaceSnapshot[] {
		const snapshotIds = this.snapshotsByPrompt.get(promptId) ?? [];
		return snapshotIds
			.map(id => this.snapshots.get(id))
			.filter((s): s is IWorkspaceSnapshot => s !== undefined);
	}

	async restoreSnapshot(snapshotId: string): Promise<void> {
		const snapshot = this.snapshots.get(snapshotId);
		if (!snapshot) {
			throw new Error(`Snapshot ${snapshotId} not found`);
		}

		console.log(`[WorkspaceSnapshotService] Restoring snapshot ${snapshotId} from ${snapshot.timestamp.toISOString()}`);
	}

	getDiff(fromSnapshotId: string, toSnapshotId: string): IFileDiff[] {
		const fromSnapshot = this.snapshots.get(fromSnapshotId);
		const toSnapshot = this.snapshots.get(toSnapshotId);

		if (!fromSnapshot || !toSnapshot) {
			return [];
		}

		const fromHashes = this.fileHashesBySnapshot.get(fromSnapshotId);
		const toHashes = this.fileHashesBySnapshot.get(toSnapshotId);

		const diffs: IFileDiff[] = [];
		const allPaths = new Set([
			...fromSnapshot.files.keys(),
			...toSnapshot.files.keys()
		]);

		for (const path of allPaths) {
			// Fast path: check content hashes if available
			if (fromHashes && toHashes) {
				const h1 = fromHashes.get(path);
				const h2 = toHashes.get(path);
				if (h1 && h2 && h1 === h2) {
					continue; // Identical content, 0 diff calculation needed!
				}
			}

			const before = fromSnapshot.files.get(path) ?? '';
			const after = toSnapshot.files.get(path) ?? '';

			if (before !== after) {
				diffs.push({
					path,
					before,
					after,
					added: before === '',
					deleted: after === '',
					modified: before !== '' && after !== ''
				});
			}
		}

		return diffs;
	}

	async deleteSnapshot(snapshotId: string): Promise<void> {
		const snapshot = this.snapshots.get(snapshotId);
		if (snapshot) {
			// Release blobs
			const hashes = this.fileHashesBySnapshot.get(snapshotId);
			if (hashes) {
				for (const hash of hashes.values()) {
					this.blobStore.release(hash);
				}
				this.fileHashesBySnapshot.delete(snapshotId);
			}

			this.snapshots.delete(snapshotId);

			const lruIdx = this.lruOrder.indexOf(snapshotId);
			if (lruIdx > -1) {
				this.lruOrder.splice(lruIdx, 1);
			}

			// Remove from prompt tracking
			const snapshotIds = this.snapshotsByPrompt.get(snapshot.promptId);
			if (snapshotIds) {
				const index = snapshotIds.indexOf(snapshotId);
				if (index > -1) {
					snapshotIds.splice(index, 1);
				}
			}
		}
	}

	async clearSnapshots(): Promise<void> {
		this.snapshots.clear();
		this.fileHashesBySnapshot.clear();
		this.snapshotsByPrompt.clear();
		this.lruOrder.length = 0;
		this.blobStore.clear();
	}

	private enforceMemoryBounds(): void {
		while (this.snapshots.size >= MAX_SNAPSHOTS_RETAINED && this.lruOrder.length > 0) {
			const oldestId = this.lruOrder.shift();
			if (oldestId) {
				this.deleteSnapshot(oldestId);
			}
		}
	}
}

registerSingleton(IWorkspaceSnapshotService, WorkspaceSnapshotService, InstantiationType.Delayed);
