import { Operation } from "rfc6902";

/**
 * Update event propagated from Edin.
 */
export interface EdinUpdate {
	docId: string;
	issuerId: string;
	/**
	 * Update version is kept on server.
	 * Version that comes from client is ignored.
	 */
	version: number;
	ops: Operation[];
	time: string;
}
