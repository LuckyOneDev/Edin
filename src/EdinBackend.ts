import { Operation, applyPatch } from "rfc6902";
import { EdinUpdate } from "./EdinUpdate";
import { EdinDoc } from "./EdinDoc";
import { EdinClient } from "./EdinClient";

export interface EdinConfig {
	/**
	 * If batchTime is set outgoing update requests would be batched by time in ms.
	 * Update request won't be sent more often than batchTime milliseconds.
	 * It's good for performance, but bad for latency.
	 */
	batchTime?: number,
	maxBatchSize?: number
}

/**
 * Backend for Edin.
 */
export interface EdinBackend {
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

	/**
	 * Returns Edin config.
	 */
	getConfig(): EdinConfig;
}
