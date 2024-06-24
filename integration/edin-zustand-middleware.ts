import { StateCreator } from "zustand";
import { EdinFactory } from "../lib/EdinFactory";

// Middleware for synchronizing zustand store with Edin.
export const edin = <T>(initializer: StateCreator<T>, Edin: EdinFactory, identifier: string): StateCreator<T> => {
	return (set, get, store) => {
		const obj = initializer(set, get, store);
		const doc = Edin.doc(identifier, obj);

		const setter: typeof set = (partial) => {
			set(partial);
			doc.update((content) => {
				const newContent = get();
				Object.assign(content as object, newContent);
			});
		};

		return initializer(setter, get, store);
	};
};
