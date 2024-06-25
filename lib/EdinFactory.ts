import { applyPatch } from "rfc6902";
import { EdinBackend } from "./EdinBackend";
import { EdinDoc } from "./EdinDoc";
import { EdinUpdate } from "./EdinUpdate";
import { produce } from "immer";

/**
 * Main Edin object.
 * Every document is managed here.
 */

export class EdinFactory {
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
	 * Clears all documents and stops sync.
	 */
	clear(): void {
		this.docs.clear();
		this.isReady = false;
	}

	// Doc request queue
	queue: (() => void)[] = [];

	doc<T>(identifier: string, content: T): EdinDoc<T> {
		// Get rid of unserializable state
		const sanitizedContent = JSON.parse(JSON.stringify(content));

		const request = () => {
			this.backend.getDocument(identifier, sanitizedContent as object).then((serverDoc) => {
				if (serverDoc) {
					const localDoc = this.docs.get(identifier);
					if (localDoc) {
						localDoc.version = serverDoc.version;
						localDoc.setState(serverDoc.content);
					}
				}
			});
		}

		const doc = new EdinDoc<T>(this.backend, identifier, sanitizedContent);
		this.docs.set(identifier, doc as EdinDoc);

		if (this.isReady) {
			request();
		} else {
			this.queue.push(request);
		}

		return doc;
	}

	async onDocumentUpdated(update: EdinUpdate): Promise<void> {
		if (!this.docs.has(update.docId) || update.ops.length === 0 || update.issuerId === this.backend.getClientId()) {
			return;
		}

		const doc = this.docs.get(update.docId)!;
		
		if (doc.version + 1 === update.version) {
			// Version is OK. No desync here
			const updatedContent = produce(doc.content, (draft) => {
				applyPatch(draft, update.ops);
			});
			doc.setState(updatedContent);
		} else {
			// Desync. Pull version from server.
			this.backend.getDocument(update.docId, {}).then((serverDoc) => {
				const updatedContent = produce(doc.content, (draft) => {
					Object.apply(draft, serverDoc.content);
				});
				doc.setState(updatedContent);
			});
		}
	}

	async onDocumentRemoved(identifier: string): Promise<void> {
		this.docs.delete(identifier);
	}
}
