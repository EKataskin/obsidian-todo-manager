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
	/**
	 * Date templates, one per line, e.g. "[{MM.YYYY}]": the first one is used for
	 * moved tasks, all of them in the editor menu.
	 */
	dateTemplate: string;
	/** First templates used before; dates written with them are still recognized. */
	oldDateTemplates: string[];
	/** Status chars of closed tasks ("x" in "- [x]"); any other char means open. */
	closedChars: string;
	/** Status chars offered in the editor menu, in this order, after the open status (" "). */
	menuChars: string;
	/** Vault paths (folders or files) in which auto mode stays inactive. */
	excludedPaths: string[];
}

export const DEFAULT_SETTINGS: DoneMoverSettings = {
	autoMode: false,
	calloutHeader: "> [!done]- Done",
	appendCompletionDate: true,
	datePosition: "end",
	dateTemplate: "<small>[{YYYY-MM-DD}]</small>\n[{MM.YYYY}]",
	oldDateTemplates: [],
	closedChars: "xX-",
	// The closed chars, then the custom checkboxes of the AnuPpuccin theme.
	menuChars: 'xX-><!/?*nliISpcb"udwkf',
	excludedPaths: [],
};

export type DatePosition = "start" | "end";

/** Options consumed by the pure mover functions. */
export interface MoveOptions {
	calloutHeader: string;
	appendDate: boolean;
	datePosition: DatePosition;
	/** The template of added dates; must pass isDateTemplate. */
	dateTemplate: string;
	/** Other known templates: their dates are not doubled and are stripped on return. */
	oldDateTemplates: string[];
	/** Must not be empty. */
	closedChars: string;
	/** When on, blocks with an unchecked line go back from the callout to the list. */
	returnUnchecked: boolean;
	/** Today's date. Passed in so the logic stays deterministic/testable. */
	today: Date;
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
