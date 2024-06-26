import { StateCreator } from "zustand";
import { EdinClient } from "../EdinClient.js";

// Middleware for synchronizing zustand store with Edin.
export const edin = <T>(stateCreator: StateCreator<T>, Edin: EdinClient, identifier: string): StateCreator<T> => {
	return (set, get, api) => {
		// Get an initial state to send to server
		const initialState = stateCreator(set, get, api);
		const doc = Edin.doc(identifier, initialState);

		const patchedSet: typeof set = (partial) => {
			set(partial);
			doc.update(get);
		};

		doc.subscribe((content) => {
			set(content);
		});

		api.setState = patchedSet;
		return stateCreator(patchedSet, get, api);;
	};
};
