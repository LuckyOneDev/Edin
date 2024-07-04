import { DocConfig } from "./DocConfig";
import { EdinBackend } from "./EdinBackend";
import { EdinDoc } from "./EdinDoc";
import { EdinUpdate } from "./EdinUpdate";

/**
 * Main Edin object.
 * Every document is managed here.
 */
export class EdinClient {
	/**
	* Local index of documents.
	  */
	docs: Map<string, EdinDoc> = new Map();

	/**
	 * Current backend implementation
	 */
	backend: EdinBackend;

	/**	
	 * Is backend ready.
	 */
	isReady: boolean = false;

	/**
	 * Doc request queue.
	 */
	queue: (() => void)[] = [];

	constructor(backend: EdinBackend) {
		this.backend = backend;
		backend.bindUpdateListener(this.onDocumentUpdated.bind(this));
		backend.bindRemoveListener(this.onDocumentRemoved.bind(this));
	}

	/**
	 * Starts handling of requests.
	 */
	start() {
		this.isReady = true;
		this.queue.forEach((request) => request());
		this.queue = [];
	}

	/**
	 * Stops handling of requests.
	 */
	stop(): void {
		this.isReady = false;
	}

	private syncDoc<T>(identifier: string, sanitizedContent: T) {
		const doc = this.docs.get(identifier);
		const request = () => {
			this.backend.getDocument(identifier, sanitizedContent as object).then((serverDoc) => {
				if (serverDoc) {
					doc.overwrite(serverDoc);
				}
			});
		}

		if (this.isReady) {
			request();
		} else {
			this.queue.push(request);
		}
	}

	/**
	 * Creates new pure EdinDoc and initializes it thus creating it
	 * or loading it from server.
	 * @param identifier Document id. 
	 * @param content Default document content. Will be ignored if document already exists.
	 * @returns Edin Document.
	 */
	doc<T extends object>(identifier: string, content: T, config?: DocConfig): EdinDoc<T> {
		// Look for existing document
		if (this.docs.has(identifier)) {
			return this.docs.get(identifier) as EdinDoc<T>;
		}

		// Get rid of unserializable state
		const sanitizedContent = JSON.parse(JSON.stringify(content));
		const doc = new EdinDoc<T>(this.backend, identifier, sanitizedContent, 0, config);
		this.docs.set(identifier, doc as EdinDoc);

		// Sync doc when possible.
		this.syncDoc(identifier, sanitizedContent);

		return doc;
	}

	/**
	 * Creates new transient EdinDoc and initializes it thus creating it
	 * or loading it from server.
	 * @param identifier Document id. 
	 * @param get Should return default/current state
	 * @param set Should set current state 
	 */
	transientDoc<T extends object>(identifier: string, get: () => T, set: (content: T) => void, initialState?: T, config?: DocConfig) {
		// Look for existing document
		if (this.docs.has(identifier)) {
			return this.docs.get(identifier) as EdinDoc<T>;
		}

		const doc = new EdinDoc<T>(this.backend, identifier, { get, set }, 0, config);
		this.docs.set(identifier, doc as EdinDoc);

		// Get rid of unserializable state
		let sanitizedContent;
		if (initialState) {
			sanitizedContent = JSON.parse(JSON.stringify(initialState));
		} else {
			sanitizedContent = JSON.parse(JSON.stringify(get()));
		}

		// Sync doc when possible.
		this.syncDoc(identifier, sanitizedContent);

		return doc;
	}


	async #updateDesynced(localDoc: EdinDoc) {
		this.backend.getDocument(localDoc.id, {}).then((serverDoc) => {
			if (!serverDoc) {
				return;
			}

			localDoc.overwrite(serverDoc);
		});
	}

	async onDocumentUpdated(update: EdinUpdate): Promise<void> {
		if (!this.docs.has(update.id) || update.patch.length === 0) {
			return;
		}

		const doc = this.docs.get(update.id)!;

		if (doc.version === update.version) {
			return;
		}

		// If version is not equal to server version, send request to server
		if (doc.version + 1 === update.version) {
			doc.applyUpdate(update);
		} else {
			this.#updateDesynced(doc);
		}
	}

	async onDocumentRemoved(identifier: string): Promise<void> {
		this.docs.delete(identifier);
	}
}
