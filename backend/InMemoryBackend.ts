import { Operation, applyPatch } from "rfc6902";
import { EdinBackend } from "../lib/EdinBackend";
import { EdinDoc } from "../lib/EdinDoc";

/**
 * Backend for debugging purposes.
 * Stores data in memory db.
 */

export class InMemoryBackend extends EdinBackend {
	clientId: string = "test";

	getClientId(): string {
		return this.clientId;
	}

	getDocument(identifier: string): Promise<EdinDoc | null> {
		return Promise.resolve(this.docs.get(identifier) || null);
	}

	createDocument(identifier: string, content: object): Promise<EdinDoc> {
		if (this.docs.has(identifier)) {
			return Promise.resolve(this.docs.get(identifier)!);
		}

		const doc = new EdinDoc(this, identifier, content);
		this.docs.set(identifier, doc);
		return Promise.resolve(doc);
	}

	removeDocument(identifier: string): Promise<boolean> {
		if (!this.docs.has(identifier)) {
			return Promise.resolve(false);
		}
		this.docs.delete(identifier);

		this.onDocumentRemoved(identifier);
		return Promise.resolve(true);
	}

	updateDocument(identifier: string, ops: Operation[]): Promise<boolean> {
		if (!this.docs.has(identifier)) {
			return Promise.resolve(false);
		}

		const doc = this.docs.get(identifier)!;
		applyPatch(doc.content, ops);

		this.onDocumentUpdated({
			docId: identifier,
			issuerId: this.clientId,
			version: doc.version,
			ops: ops,
		});

		return Promise.resolve(true);
	}
}
