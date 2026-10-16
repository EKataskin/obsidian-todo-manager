// Shared types and defaults. No Obsidian imports here so this stays unit-testable.

export interface DoneMoverSettings {
	/** When on, fully completed tasks are moved automatically shortly after being checked. */
	autoMode: boolean;
	/** First line of the callout that collects completed tasks (e.g. "> [!done]- Done"). */
	calloutHeader: string;
	/** When on, a completion date is added to moved checked lines. */
	appendCompletionDate: boolean;
	/** Where the date goes: right after the checkbox or at the end of the line. */
	datePosition: DatePosition;
	/** Date text; "{date}" is replaced with YYYY-MM-DD. */
	dateTemplate: string;
	/** Status chars of closed tasks ("x" in "- [x]"); any other char means open. */
	closedChars: string;
	/** Vault paths (folders or files) in which auto mode stays inactive. */
	excludedPaths: string[];
}

export const DEFAULT_SETTINGS: DoneMoverSettings = {
	autoMode: false,
	calloutHeader: "> [!done]- Done",
	appendCompletionDate: true,
	datePosition: "end",
	dateTemplate: "<small>[{date}]</small>",
	closedChars: "xX-",
	excludedPaths: [],
};

export type DatePosition = "start" | "end";

/** Options consumed by the pure mover functions. */
export interface MoveOptions {
	calloutHeader: string;
	appendDate: boolean;
	datePosition: DatePosition;
	/** Must contain "{date}". */
	dateTemplate: string;
	/** Must not be empty. */
	closedChars: string;
	/** When on, blocks with an unchecked line go back from the callout to the list. */
	returnUnchecked: boolean;
	/** Today's date as YYYY-MM-DD. Passed in so the logic stays deterministic/testable. */
	today: string;
}

export interface MoveResult {
	/** The full document text after the move (unchanged if nothing moved). */
	text: string;
	/** Number of top-level task blocks that were moved into callouts. */
	movedCount: number;
	/** Number of top-level task blocks that were returned from callouts. */
	returnedCount: number;
}

/** A contiguous run of lines: a task line plus all of its indented sub-lines. */
export interface TaskBlock {
	/** Line index of the task line itself. */
	start: number;
	/** Line index of the last line belonging to the block (inclusive). */
	end: number;
}
