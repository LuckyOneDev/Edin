import { EdinBackend } from "./EdinBackend";
import { EdinDoc } from "./EdinDoc";

/**
 * Main Edin object.
 * Every document is managed here.
 */

export class EdinFactory {
	docs: Map<string, EdinDoc> = new Map();
	backend: EdinBackend;

	constructor(backend: EdinBackend) {
		this.backend = backend;
	}

	doc<T>(identifier: string, content: T): EdinDoc<T> {
		this.backend.getDocument(identifier).then((serverDoc) => {
			if (serverDoc) {
				const localDoc = this.docs.get(identifier);
				if (localDoc) {
					localDoc.content = serverDoc.content;
				}
			}
		});
		return new EdinDoc<T>(this.backend, identifier, content);
	}
}
