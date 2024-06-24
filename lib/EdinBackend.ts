import { Operation, applyPatch } from "rfc6902";
import { EdinUpdate } from "./EdinUpdate";
import { EdinDoc } from "./EdinDoc";

/**
 * Abstract backend for Edin.
 * Each Edin backend inherits from this class.
 */

export abstract class EdinBackend {
	/**
	 * Local index of documents.
	 */
	docs: Map<string, EdinDoc> = new Map();

	/**
	 * Returns client id unique for each client.
	 * Id is used for deduplication of updates.
	 * It also can be used to manage access to backend.
	 */
	abstract getClientId(): string;

	/**
	 * Retrieves document from backend.
	 * @param identifier Document identifier.
	 */
	abstract getDocument(identifier: string): Promise<EdinDoc | null>;

	/**
	 * Creates new document. If document already exists, retrieves it.
	 * @param identifier Document identifier.
	 * @param content Default document content.
	 */
	abstract createDocument(identifier: string, content: object): Promise<EdinDoc>;

	/**
	 * Removes document from backend. Notifies Edin about removal.
	 * @param identifier Document identifier.
	 */
	abstract removeDocument(identifier: string): Promise<boolean>;

	/**
	 *
	 * @param identifier Document identifier.
	 * @param update
	 */
	abstract updateDocument(identifier: string, update: Operation[]): Promise<boolean>;

	onDocumentUpdated(update: EdinUpdate): void {
		if (!this.docs.has(update.docId) || update.ops.length === 0 || update.issuerId === this.getClientId()) {
			return;
		}

		this.docs.get(update.docId)!.update((content) => {
			applyPatch(content, update.ops);
		});
	}

	onDocumentRemoved(identifier: string): void {
		this.docs.delete(identifier);
	}

	clear(): void {
		this.docs.clear();
	}
}
