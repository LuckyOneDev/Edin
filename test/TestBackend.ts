import { applyPatch } from "rfc6902";
import { EdinBackend } from "../lib/EdinBackend";
import { EdinDoc, IEdinDoc } from "../lib/EdinDoc";
import { EdinUpdate } from "../lib/EdinUpdate";
import { produce } from "immer";

export class TestBackend implements EdinBackend {
	id: string;
	docs: Map<string, IEdinDoc> = new Map();
	updateListeners: ((update: EdinUpdate) => void)[] = [];
	removeListeners: ((identifier: string) => void)[] = [];

	constructor() {
		this.id = Math.random().toString(36).slice(2);
	}

	getClientId(): string | null {
		return this.id;
	}

	getDocument(identifier: string, content: object): Promise<EdinDoc> {
		if (this.docs.has(identifier)) {
			return Promise.resolve(this.docs.get(identifier) as EdinDoc);
		}
		const doc = new EdinDoc(this, identifier, content);
		this.docs.set(identifier, doc);
		return Promise.resolve(doc as EdinDoc);
	}

	removeDocument(identifier: string): Promise<void> {
		this.docs.delete(identifier);
		this.removeListeners.forEach((listener) => listener(identifier));
		return Promise.resolve();
	}

	updateDocument(update: EdinUpdate): Promise<void> {
		const doc = this.docs.get(update.docId);
		console.log(update);
		if (doc) {
			let result: ReturnType<typeof applyPatch> = [];
			const newState = produce(doc.content, (draft) => {
				result = applyPatch(draft, update.ops);
			});

			if (!result.every(v => v === null)) {
				return Promise.reject("Invalid patch");
			}

			doc.content = newState;
			doc.version++;
			update.version = doc.version;
			this.updateListeners.forEach((listener) => listener(update));
		}

		return Promise.resolve();
	}

	bindUpdateListener(listener: (update: EdinUpdate) => Promise<void>): void {
		this.updateListeners.push(listener);
	}

	bindRemoveListener(listener: (identifier: string) => Promise<void>): void {
		this.removeListeners.push(listener);
	}
}