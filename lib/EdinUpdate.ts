import { Operation } from "rfc6902";

/**
 * Update event propagated from Edin.
 */

export interface EdinUpdate {
	docId: string;
	issuerId: string;
	version: number;
	ops: Operation[];
}
