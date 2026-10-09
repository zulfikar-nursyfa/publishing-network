/** The job waits and retries later without using an attempt (paused automation, budget). */
export class DeferredJob extends Error {}

/** The job fails now; retrying cannot help without a person changing something. */
export class PermanentJob extends Error {}

/** Another worker took over the job; this worker must stop without writing anything. */
export class LostLease extends Error {}
