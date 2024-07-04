import { produce } from "immer";
import { Operation, applyPatch, createPatch } from "rfc6902";
import { EdinBackend } from "./EdinBackend";
import { EdinUpdate } from "./EdinUpdate";
import { EdinDocData } from "./EdinDocData";
import { DocConfig } from "./DocConfig";

/**
 * Atomic syncronised structure.
 */
export class EdinDoc<T extends object = object> implements EdinDocData<T> {
	/**
	 * Document identifier.
	 */
	readonly id: string;

	/**
	 * Current document version.
	 * Each time document is updated, version is incremented.
	 */
	version: number;

	/**
	 * Document content. Actual useful data.
	 */
	private _content: T;
	private getter: () => T;
	private setter: (content: T) => void;

	public get content(): T {
		return this.getter();
	}

	private set content(value: T) {
		this.setter(value);
	}

	/**
	 * Edin backend.
	 */
	private edin: EdinBackend;

	/**
	 * Subscriptions to update events.
	 */
	private updateListeners: ((content: T) => void)[] = [];

	private config?: DocConfig;

	constructor(edin: EdinBackend, identifier: string, content: T | {
		get: () => T,
		set: (content: T) => void
	}, version: number = 0, config?: DocConfig) {
		this.edin = edin;
		this.id = identifier;
		this.version = version;
		this.config = config;

		if ("get" in content) {
			this.getter = content.get;
			this.setter = content.set;
		} else {
			this._content = content;
			this.getter = () => this._content;
			this.setter = (val) => this._content = val;
		}
	}

	private updateQueue: Operation[] = [];
	private updateTimeout: ReturnType<typeof setTimeout> | null = null;

	private batchUpdate(changes: Operation[]) {
		const { batchTime, maxBatchSize } = this.edin.getConfig();
		this.updateQueue.push(...changes);

		if (maxBatchSize) {
			if (JSON.stringify(this.updateQueue).length >= maxBatchSize) {
				clearTimeout(this.updateTimeout);
				this.updateTimeout = null;
				this.normalUpdate(this.updateQueue);
				this.updateQueue = [];
				return;
			}
		}

		if (!this.updateTimeout) {
			this.updateTimeout = setTimeout(() => {
				this.updateTimeout = null;
				this.normalUpdate(this.updateQueue);
				this.updateQueue = [];
			}, batchTime);
		}
	}

	private normalUpdate(changes: Operation[]) {
		this.version++;
		this.edin.updateDocument({
			id: this.id,
			patch: changes,
			version: this.version
		}).catch((e) => {
			this.edin.getDocument(this.id, this.content as EdinDoc);
		});
	}


	private notifySubscribers() {
		this.updateListeners.forEach((handler) => {
			handler(this.content);
		});
	}

	/**
	 * Updates document content.
	 * @param partial Content updater function.
	 */
	update(partial: T | Partial<T> | ((state: T) => T | Partial<T>)) {
		const initialState = this.content;
		if (!initialState) throw new Error("Getter faield to retrieve valid data.");

		const newState =
			produce(initialState, (draft) => {
				if (typeof partial === "function") {
					const newState = partial(draft as T);
					if (newState) {
						Object.assign(draft, newState);
					}
				} else {
					Object.assign(draft, partial);
				}
			});

		const changes = createPatch(initialState, newState);
		this.content = newState;
		this.notifySubscribers();

		const { batchTime } = this.edin.getConfig();
		if (batchTime) {
			this.batchUpdate(changes);
		} else {
			this.normalUpdate(changes);
		}
	}

	/**
	 * Subscribes to document changes.
	 * @param handler Callback function which will be called on document change.
	 * @returns Unsubscribe function.
	 */
	subscribe(handler: (content: T) => void): () => void {
		this.updateListeners.push(handler);
		return () => {
			// Remove the listener from the list of event listeners.
			this.updateListeners = this.updateListeners.filter((listener) => listener !== handler);
		}
	}

	/**
	 * Destroys the document, clearing any updates and removing the document from server.
	 */
	remove() {
		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout);
			this.updateTimeout = null;
		}

		this.updateListeners = [];
		this.edin.removeDocument(this.id);
	}

	/**
	 * Applies update to this document and notifies subscribers if update is successful.
	 * If not, throws an exception.
	 */
	applyUpdate(iUpdate: EdinUpdate) {
		const update = this.config?.updateMiddleware ? this.config.updateMiddleware(iUpdate, this) : iUpdate;
		let ok = false;
		const updatedContent = produce(this.content, (draft) => {
			const results = applyPatch(draft, update.patch);
			ok = results.every((result => result === null));
		});

		if (!ok) throw new Error("Could not apply update");

		this.version = update.version;
		this.content = updatedContent;
		this.notifySubscribers();
	}

	/**
	 * Apply patch without changing version. 
	 * Should only be used in extensions for internals.
	 */
	applyPatch(patch: Operation[]) {
		const updatedContent = produce(this.content, (draft) => {
			applyPatch(draft, patch);
		});
		this.content = updatedContent;
		this.notifySubscribers();
	}

	/**
	 * Overwrites document completely and notifies subscribers.
	 * @param doc Edin Document Data.
	 */
	overwrite(doc: EdinDocData) {
		this.content = doc.content as T;
		this.version = doc.version;
		this.notifySubscribers();
		this.promiseResolve();
	}

	private promiseResolve: () => void;
	private readyPromise: Promise<void> = new Promise((resolve) => {
		this.promiseResolve = resolve;
	});
	

	/**
	 * Resolves when this document is first synchronized with server.
	 */
	async ready() {
		return this.readyPromise;
	}
}