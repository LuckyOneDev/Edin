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
	identifier: string;

	/**
	 * Current document version.
	 * Each time document is updated, version is incremented.
	 */
	version: number = 0;

	/**
	 * Document content. Actual useful data.
	 */
	content: T;

	/**
	 * Edin backend.
	 */
	#edin: EdinBackend;

	constructor(edin: EdinBackend, identifier: string, content: T) {
		this.#edin = edin;
		this.identifier = identifier;
		this.content = content;
	}

	/**
	 * Updates document content.
	 * @param updater Content updater function.
	 */
	update(updater: (content: T) => void) {
		const initialState = this.content;
		const newState = produce(initialState, updater);
		const changes = createPatch(initialState, newState);
		this.version++;
		this.#edin.updateDocument(this.identifier, changes);
	}
}
