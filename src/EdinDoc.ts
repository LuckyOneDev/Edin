import { Draft, produce } from "immer";
import { Operation, applyPatch, createPatch } from "rfc6902";
import { EdinBackend } from "./EdinBackend";
import { EdinUpdate } from "./EdinUpdate";

export interface IEdinDoc {
	id: string;
	version: number;
	content: unknown;
}

/**
 * Atomic syncronised structure.
 */
export class EdinDoc<T = unknown> implements IEdinDoc {
	/**
	 * Document identifier.
	 */
	id: string;

	/**
	 * Current document version.
	 * Each time document is updated, version is incremented.
	 */
	version: number;

	/**
	 * Document content. Actual useful data.
	 */
	content: T;

	/**
	 * Edin backend.
	 */
	#edin: EdinBackend;

	#eventListeners: ((content: T) => void)[] = [];

	constructor(edin: EdinBackend, identifier: string, content: T, version: number = 0) {
		this.#edin = edin;
		this.id = identifier;
		this.content = content;
		this.version = version;
	}

	#updateQueue: Operation[] = [];
	#updateTimeout: ReturnType<typeof setTimeout> | null = null;
	
	#batchUpdate(changes: Operation[]) {
		const { batchTime, maxBatchSize } = this.#edin.getConfig();
		this.#updateQueue.push(...changes);

		if (maxBatchSize) {
			if (JSON.stringify(this.#updateQueue).length >= maxBatchSize) {
				clearTimeout(this.#updateTimeout);
				this.#updateTimeout = null;
				this.#normalUpdate(this.#updateQueue);
				this.#updateQueue = [];
				return;
			}
		}

		if (!this.#updateTimeout) {
			this.#updateTimeout = setTimeout(() => {
				this.#updateTimeout = null;
				this.#normalUpdate(this.#updateQueue);
				this.#updateQueue = [];
			}, batchTime);
		}
	}

	#normalUpdate(changes: Operation[]) {
		this.version++;
		this.#edin.updateDocument({
			id: this.id,
			patch: changes,
			version: this.version
		}).catch((e) => {
			this.#edin.getDocument(this.id, this.content as EdinDoc);
		});
	}

	/**
	 * Updates document content.
	 * @param updater Content updater function.
	 */
	update(updater: (content: T) => void | T) {
		const initialState = this.content;
		const newState = JSON.parse(JSON.stringify(produce(initialState, updater))) as T;
		const changes = createPatch(initialState, newState);
		this.content = newState;
		this.notifySubscribers();

		const { batchTime } = this.#edin.getConfig();
		if (batchTime) {
			this.#batchUpdate(changes);
		} else {
			this.#normalUpdate(changes);
		}
	}

	/**
	 * Destroys the document, clearing any updates and removing the document from server.
	 */
	remove() {
		if (this.#updateTimeout) {
			clearTimeout(this.#updateTimeout);
			this.#updateTimeout = null;
		}
		
		this.#eventListeners = [];
		this.#edin.removeDocument(this.id);
	}

	/**
	 * Subscribes to document changes.
	 * @param handler Callback function which will be called on document change.
	 * @returns Unsubscribe function.
	 */
	subscribe(handler: (content: T) => void): () => void {
		this.#eventListeners.push(handler);
		return () => {
			// Remove the listener from the list of event listeners.
			this.#eventListeners = this.#eventListeners.filter((listener) => listener !== handler);
		}
	}

	applyUpdate(update: EdinUpdate) {
		let ok = false;
		const updatedContent = produce(this.content, (draft) => {
			const results = applyPatch(draft, update.patch);
			ok = results.every((result => result === null));
		});

		if (ok) {
			this.version = update.version;
			this.content = updatedContent;
			this.notifySubscribers();
		}
	}

	notifySubscribers() {
		this.#eventListeners.forEach((handler) => {
			handler(this.content);
		});
	}
}