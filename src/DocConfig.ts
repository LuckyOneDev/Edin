import { EdinDoc } from "./EdinDoc";
import { EdinUpdate } from "./EdinUpdate";

export interface DocConfig {
	updateMiddleware?: (update: EdinUpdate, doc: EdinDoc) => EdinUpdate;
}
