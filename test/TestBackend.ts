import { applyPatch } from "rfc6902";
import { EdinBackend, EdinConfig } from "../src/EdinBackend";
import { EdinUpdate } from "../src/EdinUpdate";
import { produce } from "immer";
import { EdinDocData } from "../src/EdinDocData";

export class TestBackend implements EdinBackend {
	id: string;
	storage: Map<string, EdinDocData> = new Map();
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

	getDocument(identifier: string, content: object): Promise<EdinDocData> {
		if (this.storage.has(identifier)) {
			return Promise.resolve(this.storage.get(identifier)!);
		}
		const doc = {
			id: identifier,
			content: content,
			version: 0
		};

		this.storage.set(identifier, doc);
		return Promise.resolve(doc);
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