import { Operation, applyPatch } from "rfc6902";
import { EdinUpdate } from "./EdinUpdate";
import { EdinDoc } from "./EdinDoc";
import { EdinClient } from "./EdinClient";

/**
 * Backend for Edin.
 */

export interface EdinBackend {
	/**
	 * Returns client id unique for each client.
	 * Id is used for deduplication of updates.
	 * It also can be used to manage access to backend.
	 */
	getClientId(): string | null;

	/**
	 * Creates new document. If document already exists, retrieves it.
	 * @param identifier Document identifier.
	 * @param content Default document content.
	 */
	getDocument(identifier: string, content: object): Promise<EdinDoc>;

	/**
	 * Removes document from backend. Notifies Edin about removal.
	 * @param identifier Document identifier.
	 */
	removeDocument(identifier: string): Promise<void>;

	/**
	 * Sends out EdinUpdate.
	 * @param identifier Document identifier.
	 * @param update
	 */
	updateDocument(update: EdinUpdate): Promise<void>;

	/**
	 * Binds Edin update listener.
	 */
	bindUpdateListener(listener: typeof EdinClient.prototype.onDocumentUpdated): void;
	
	/**
	 * Binds Edin remove listener.
	 */
	bindRemoveListener(listener: typeof EdinClient.prototype.onDocumentRemoved): void;
}
