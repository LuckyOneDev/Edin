import { applyPatch } from "rfc6902";
import { EdinBackend, EdinConfig } from "../src/EdinBackend";
import { EdinDoc, IEdinDoc } from "../src/EdinDoc";
import { EdinUpdate } from "../src/EdinUpdate";
import { produce } from "immer";

export class TestBackend implements EdinBackend {
	id: string;
	storage: Map<string, IEdinDoc> = new Map();
	updateListeners: ((update: EdinUpdate) => void)[] = [];
	removeListeners: ((identifier: string) => void)[] = [];

	config: EdinConfig = {
		batchTime: 0
	}

	constructor() {
		this.id = Math.random().toString(36).slice(2);
	}

	getConfig(): EdinConfig {
		return this.config;
	}

	getClientId(): string | null {
		return this.id;
	}

	getDocument(identifier: string, content: object): Promise<EdinDoc> {
		if (this.storage.has(identifier)) {
			return Promise.resolve(this.storage.get(identifier) as EdinDoc);
		}
		const doc = new EdinDoc(this, identifier, content);
		this.storage.set(identifier, doc);
		return Promise.resolve(doc as EdinDoc);
	}

	removeDocument(identifier: string): Promise<void> {
		this.storage.delete(identifier);
		this.removeListeners.forEach((listener) => listener(identifier));
		return Promise.resolve();
	}

	updateDocument(update: EdinUpdate): Promise<void> {
		const doc = this.storage.get(update.id);

		if (doc) {
			let result: ReturnType<typeof applyPatch> = [];
			const newState = produce(doc.content, (draft) => {
				result = applyPatch(draft, update.patch);
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