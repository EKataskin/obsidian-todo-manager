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
	/** Status chars of closed tasks ("x" in "- [x]"); any other char means open. */
	closedChars: string;
	/** Status chars offered in the editor menu, in this order, after the open status (" "). */
	menuChars: string;
	/** Vault paths (folders or files) in which auto mode stays inactive. */
	excludedPaths: string[];
	/** Templates of the "Complete by template" menu, after the built-in one. */
	completeTemplates: CompleteTemplate[];
}

export const DEFAULT_SETTINGS: DoneMoverSettings = {
	autoMode: false,
	calloutHeader: "> [!done]- Done",
	appendCompletionDate: true,
	datePosition: "end",
	dateTemplate: "<small>[{YYYY-MM-DD}]</small>\n[{MM.YYYY}]",
	closedChars: "xX-",
	// The closed chars, then the custom checkboxes of the AnuPpuccin theme.
	menuChars: 'xX-><!/?*nliISpcb"udwkf',
	excludedPaths: [],
	completeTemplates: [],
};

/** A menu item that sets the status, adds a date and moves the task in one step. */
export interface CompleteTemplate {
	/** The menu item title. */
	name: string;
	/** The status char put into the brackets. */
	char: string;
	/** The template of the added date; empty means no date. */
	dateTemplate: string;
	datePosition: DatePosition;
	/** When on, the changed tasks go to the done block, whatever their status. */
	move: boolean;
}

export type DatePosition = "start" | "end";

/** Options consumed by the pure mover functions. */
export interface MoveOptions {
	calloutHeader: string;
	appendDate: boolean;
	datePosition: DatePosition;
	/** The template of added dates; must pass isDateTemplate. */
	dateTemplate: string;
	/** The other date templates: their dates are not doubled and are stripped on return. */
	otherDateTemplates: string[];
	/** Must not be empty. */
	closedChars: string;
	/** When on, blocks with an unchecked line go back from the callout to the list. */
	returnUnchecked: boolean;
	/** Today's date. Passed in so the logic stays deterministic/testable. */
	today: Date;
	/**
	 * When set, only the blocks of these line indices move: a block whose task
	 * line is in the set moves whatever its status, a block with only sub-lines
	 * in it moves when it is fully done.
	 */
	moveLines?: ReadonlySet<number>;
	/** When set, only the callout blocks with one of these line indices return. */
	returnLines?: ReadonlySet<number>;
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
