import { StateCreator } from "zustand";
import { EdinClient } from "../EdinClient.js";
import { DocConfig } from "src/DocConfig.js";

// Middleware for synchronizing zustand store with Edin.
export const edin = <T extends object>(
	stateCreator: StateCreator<T>,
	Edin: EdinClient,
	identifier: string,
	config?: DocConfig): StateCreator<T> =>
	(set, get, store) => {
		// Get an initial state to send to server
		const initialState = stateCreator(set, get, store);
		const doc = Edin.transientDoc(identifier, get, set, initialState, config);

		// ! Do not simplify.
		// For some reason zustand getState() does not work
		// if you replace setState without wrapper function.
		store.setState = (state) => {
			doc.update(state);
		};

		return stateCreator(store.setState, get, store);
	};
