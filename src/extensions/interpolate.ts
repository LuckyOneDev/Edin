import { applyPatch } from "rfc6902";
import { DocConfig } from "src/DocConfig";

export type InterpolationConfig = InterpolationEntry[];

export type InterpolationEntry = {
	path: string,
	timeSpan: number,
	timeStep: number,
	fn: (start: number, end: number, time: number) => number
}

/**
 * Middleware that interpolates numeric values of updates.
 * @param cfg Array of interpolation configs.
 */
export const interpolate = (cfg: InterpolationConfig): DocConfig["updateMiddleware"] => (update, doc) => {
	update.patch.forEach(patch => {
		const entry = cfg.find(entry => entry.path === patch.path);
		if (entry && patch.op === "replace") {
			// Start interpolation
			const start = getFieldByPointer(doc.content, entry.path) as number;
			const end = patch.value as number;
			const timeSpan = entry.timeSpan;
			const timeStep = entry.timeStep;
			let time = 0;

			patch.value = entry.fn(start, end, time / timeSpan);
			doc.applyPatch([patch]);

			const interval = setInterval(() => {
				time += timeStep;
				patch.value = entry.fn(start, end, time / timeSpan);
				doc.applyPatch([patch]);
				if (time >= timeSpan) {
					clearInterval(interval);
				}
			}, 1);
		}
	});

	// Remove patches that are no longer needed
	update.patch = update.patch.filter(patch => !cfg.find(entry => entry.path === patch.path));
	return update;
}

function easeInOut(t) { return t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1 }

export const easeInOutInterpolation = (y1: number, y2: number, t: number) => lerp(y1, y2, easeInOut(t));

export const linearInterpolation = (y1: number, y2: number, t: number) => lerp(y1, y2, t);

function getFieldByPointer(obj: any, pointer: string): any | null {
  const fields = pointer.split('/');
  // Remove first
  fields.shift();
  let current: any = obj;

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (typeof current === 'object' && current !== null && field in current) {
      current = current[field];
    } else {
      return null;
    }
  }

  return current;
}

function lerp(start: number, end: number, t: number) {
	return start + (end - start) * t;
}