import { Operation } from "rfc6902";

/**
 * Update event propagated from Edin.
 */
export interface EdinUpdate {
	id: string;
	patch: Operation[];
	version: number;
}
