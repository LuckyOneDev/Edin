import { describe, expect, test } from '@jest/globals';
import { EdinClient } from "./lib/EdinClient";
import { TestBackend } from "./test/TestBackend";

describe("Edin", () => {
	test("New data should be put to server", () => {
		const backend = new TestBackend();
		const Edin = new EdinClient(backend);
		Edin.start();
		const doc = Edin.doc("test", { test: 9 });
		return new Promise<void>((resolve) => {
			doc.subscribe((content) => {
				const serverContent = backend.docs.get("test")?.content as { test: number };
				expect(serverContent.test).toBe(9);
				resolve();
			});
		})
	});

	test("Existing data should be loaded from server", () => {
		const backend = new TestBackend();
		backend.docs.set("test", {
			id: "test",
			version: 4,
			content: { test: 2 }
		});

		const Edin = new EdinClient(backend);
		Edin.start();

		const doc = Edin.doc("test", { test: 5 });

		return new Promise<void>((resolve) => {
			doc.subscribe((content) => {
				expect(content.test).toBe(2);
				resolve();
			});
		})
	});

	test("Data should be updated on server", () => {
		const backend = new TestBackend();
		
		const Edin = new EdinClient(backend);
		Edin.start();
		const doc = Edin.doc("test", { test: 6 });

		return new Promise<void>((resolve) => {
			backend.updateListeners.push((update) => {
				const serverContent = backend.docs.get("test")?.content as { test: number };
				expect(serverContent.test).toBe(9);
				resolve();
			});

			doc.update((content) => {
				content.test = 9
			});
		})
	});

	test("Data should be removed on server", () => {
		const backend = new TestBackend();
		const Edin = new EdinClient(backend);
		Edin.start();
		const doc = Edin.doc("test", { test: 6 });

		return new Promise<void>((resolve) => {
			backend.removeListeners.push((update) => {
				const serverContent = backend.docs.get("test");
				expect(serverContent).toBeFalsy();
				resolve();
			});

			doc.destroy();
		})
	});

	test("Data should be updated on client", () => {
		const backend = new TestBackend();
		const Edin1 = new EdinClient(backend);
		const Edin2 = new EdinClient(backend);
		
		Edin1.start();
		Edin2.start();

		const doc1 = Edin1.doc("test", { test: 5 });
		const doc2 = Edin2.doc("test", { test: 0 });

		return new Promise<void>((resolve) => {
			let first = true;
			doc2.subscribe((content) => {
				if (!first) {
					expect(content.test).toBe(9);
					resolve();
				}
				first = false;
			});
			
			doc1.update((content) => {
				content.test = 9
			});
		})
	});
});