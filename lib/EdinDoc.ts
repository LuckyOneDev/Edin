import { produce } from "immer";
import { Operation, createPatch } from "rfc6902";
import { EdinBackend } from "./EdinBackend";

export interface IEdinDoc<T = unknown> {
	id: string;
	version: number;
	content: T;
}

/**
 * Atomic syncronised structure.
 */
export class EdinDoc<T = unknown> implements IEdinDoc<T> {
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

	constructor(edin: EdinBackend, identifier: string, content: T) {
		this.#edin = edin;
		this.id = identifier;
		this.content = content;
		this.version = 0;
	}

	#updateQueue: Operation[] = [];
	#updateTimeout: ReturnType<typeof setTimeout> | null = null;
	
	/**
	 * Updates document content.
	 * @param updater Content updater function.
	 */
	update(updater: (content: T) => void) {
		const id = this.#edin.getClientId();
		if (!id) throw new Error("Client id could not be retrieved");

		const initialState = this.content;
		const newState = produce(initialState, updater);
		const changes = createPatch(initialState, newState);
		this.setState(newState);

		// Send out updates every 50ms
		this.#updateQueue.push(...changes);
		if (!this.#updateTimeout) {
			this.#updateTimeout = setTimeout(() => {
				this.version++;
				this.#updateTimeout = null;
				this.#edin.updateDocument({
					issuerId: id,
					docId: this.id,
					ops: this.#updateQueue,
					time: new Date().toISOString(),
					version: this.version
				}).catch((e) => {
					console.error(`Failed to update document ${this.id}`);
				});

				this.#updateQueue = [];
			}, 50);
		}
	}

	/**
	 * Destroys the document, clearing any updates and removing the document from server.
	 */
	destroy() {
		if (this.#updateTimeout) {
			clearTimeout(this.#updateTimeout);
			this.#updateTimeout = null;
		}
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

	/**
	 * Notifies all subscribed event listeners about document changes.
	 * Does not send network request. Should only be used internally.
	 * @param content New document content.
	 */
	setState(content: T) {
		this.content = content;
		this.#eventListeners.forEach((handler) => {
			handler(content);
		});
	}
}