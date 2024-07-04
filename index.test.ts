import { describe, expect, test } from '@jest/globals';
import { EdinClient } from "./src/EdinClient";
import { TestBackend } from "./test/TestBackend";
import { create } from 'zustand';
import { edin } from './src/extensions/zustand';
import { produce } from 'immer';
import { easeInOutInterpolation, interpolate, linearInterpolation } from "./src/extensions/interpolate";

describe("Basic", () => {
	test("New data should be put to server", () => {
		const backend = new TestBackend();
		const Edin = new EdinClient(backend);
		Edin.start();
		const doc = Edin.doc("test", { test: 9 });
		return new Promise<void>((resolve) => {
			doc.subscribe((content) => {
				const serverContent = backend.storage.get("test")?.content as { test: number };
				expect(serverContent.test).toBe(9);
				resolve();
			});
		})
	});

	test("Existing data should be loaded from server", () => {
		const backend = new TestBackend();
		backend.storage.set("test", {
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
		});
	});

	test("Data should be updated on server", () => {
		const backend = new TestBackend();

		const Edin = new EdinClient(backend);
		Edin.start();
		const doc = Edin.doc("test", { test: 6 });

		return new Promise<void>((resolve) => {
			backend.updateListeners.push((update) => {
				const serverContent = backend.storage.get("test")?.content as { test: number };
				expect(serverContent.test).toBe(9);
				resolve();
			});

			doc.update(produce((content) => {
				content.test = 9
			}));
		})
	});

	test("Data should be removed on server", () => {
		const backend = new TestBackend();
		const Edin = new EdinClient(backend);
		Edin.start();
		const doc = Edin.doc("test", { test: 6 });

		return new Promise<void>((resolve) => {
			backend.removeListeners.push((update) => {
				const serverContent = backend.storage.get("test");
				expect(serverContent).toBeFalsy();
				resolve();
			});

			doc.remove();
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
			doc2.subscribe((content) => {
				expect(content.test).toBe(9);
				resolve();
			});

			doc1.update(produce((content) => {
				content.test = 9
			}));
		})
	});
});

describe("Batching", () => {
	test("Data should be updated on server with batching", () => {
		const backend = new TestBackend();
		backend.config.batchTime = 15;
		const Edin = new EdinClient(backend);
		Edin.start();
		const doc = Edin.doc("test", { test1: 6, test2: 6 });

		return new Promise<void>((resolve) => {
			backend.updateListeners.push((update) => {
				const serverContent = backend.storage.get("test")?.content as { test1: number, test2: number };
				expect(serverContent.test1).toBe(-5);
				expect(serverContent.test2).toBe(1000);
				resolve();
			});

			doc.update(produce((content) => {
				content.test1 = -5
			}));
			doc.update(produce((content) => {
				content.test2 = 1000
			}));
		})
	});
});

describe("Doc Config", () => {
	test('updateMiddleware should work', () => {
		const backend = new TestBackend();
		const Edin = new EdinClient(backend);
		Edin.start();

		const doc = Edin.doc("test", { test1: 6, test2: 6 }, {
			updateMiddleware(update) {
				update.patch = update.patch.map(patch => {
					if (patch.path === "/test1" && patch.op === "replace") {
						patch.value = -500;
					}
					return patch;
				});
				return update;
			},
		});

		return new Promise<void>(async (resolve) => {
			await doc.ready();

			doc.subscribe((state) => {
				expect(state.test1).toBe(-500);
				expect(state.test2).toBe(1000);
				resolve();
			});

			backend.updateDocument({
				id: "test",
				patch: [
					{
						op: "replace",
						path: "/test1",
						value: 1
					},
					{
						op: "replace",
						path: "/test2",
						value: 1000
					}
				],
				version: 2
			});
		});
	});

	test('Interpolation middleware should work', () => {
		const backend = new TestBackend();
		const Edin = new EdinClient(backend);
		Edin.start();

		const doc = Edin.doc("test", { test1: 1, test2: 5 }, {
			updateMiddleware: interpolate([
				{
					path: "/test1",
					timeSpan: 10,
					timeStep: 1,
					fn: linearInterpolation,
				}
			]),
		});

		return new Promise<void>(async (resolve) => {
			await doc.ready();
			
			// ! This test in non-deterministic so it might fail.
			// TODO: Make it deterministic.
			setTimeout(() => {
				expect(doc.content.test1).toBeGreaterThanOrEqual(5);
				resolve();
			}, 5);

			setTimeout(() => {
				expect(doc.content.test1).toBeGreaterThanOrEqual(8);
				resolve();
			}, 8);

			setTimeout(() => {
				expect(doc.content.test1).toBe(10);
				resolve();
			}, 25);

			backend.updateDocument({
				id: "test",
				patch: [
					{
						path: "/test1",
						op: "replace",
						value: 100
					},
				],
				version: 2
			});
		});
	});
});

describe("Zustand", () => {
	test("Zustand should sync data from server", () => {
		const backend = new TestBackend();
		backend.storage.set("test", {
			id: "test",
			version: 4,
			content: { test: 2 }
		});

		const Edin = new EdinClient(backend);
		Edin.start();

		const testStore = create<{ test: number, setTest: (value: number) => void }>(edin((set) => ({
			test: 0,
			setTest: (value: number) => {
				set({ test: value });
			}
		}), Edin, "test"));

		return new Promise<void>((resolve) => {
			testStore.subscribe((state) => {
				expect(state.test).toBe(2);
				resolve();
			});
		});
	});

	test("Zustand should update data on server (setState)", () => {
		const backend = new TestBackend();

		const Edin = new EdinClient(backend);
		Edin.start();

		const testStore = create<{ test: number, setTest: (value: number) => void }>(edin((set) => ({
			test: 0,
			setTest: (value: number) => {
				set({ test: value });
			}
		}), Edin, "test"));

		return new Promise<void>((resolve) => {
			backend.updateListeners.push((update) => {
				const serverContent = backend.storage.get("test")?.content as { test: number };
				expect(serverContent.test).toBe(9);
				resolve();
			});

			testStore.setState({ test: 9 });
		})
	});

	test("Zustand should update data on server (setter method)", () => {
		const backend = new TestBackend();

		const Edin = new EdinClient(backend);
		Edin.start();

		const testStore = create<{ test: number, setTest: (value: number) => void }>(edin((set) => ({
			test: 0,
			setTest: (value: number) => {
				set({ test: value });
			}
		}), Edin, "test"));

		return new Promise<void>((resolve) => {
			backend.updateListeners.push((update) => {
				const serverContent = backend.storage.get("test")?.content as { test: number };
				expect(serverContent.test).toBe(9);
				resolve();
			});

			testStore.getState().setTest(9);
		})
	});

	test("Zustand should recieve updates from server", () => {
		const backend = new TestBackend();

		const Edin = new EdinClient(backend);
		Edin.start();

		const testStore = create<{ test: number, setTest: (value: number) => void }>(edin((set) => ({
			test: 0,
			setTest: (value: number) => {
				set({ test: value });
			}
		}), Edin, "test"));

		return new Promise<void>((resolve) => {
			testStore.subscribe((state) => {
				expect(state.test).toBe(9);
				resolve();
			});

			backend.updateDocument({
				id: "test",
				patch: [
					{ op: "replace", path: "/test", value: 9 }
				],
				version: 5
			});
		})
	});
});