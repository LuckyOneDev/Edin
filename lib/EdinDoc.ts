import { produce } from "immer";
import { createPatch } from "rfc6902";
import { EdinBackend } from "./EdinBackend";

/**
 * Atomic syncronised structure.
 */
export class EdinDoc<T = unknown> {
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
		
		this.#edin.updateDocument({
			issuerId: id,
			docId: this.id,
			ops: changes,
			time: new Date().toISOString(),
			version: this.version
		});
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
	 * @param content New document content.
	 */
	setState(content: T) {
		this.content = content;
		this.version++;
		this.#eventListeners.forEach((handler) => {
			handler(content);
		});
	}
}