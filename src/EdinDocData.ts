
/**
 * EdinDoc data structure.
 */
export interface EdinDocData<T = object> {
	id: string;
	version: number;
	content: T;
}