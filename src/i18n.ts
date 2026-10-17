// UI string localization. English is the default; German or Russian is used
// when Obsidian's interface language is German or Russian.

export type Lang = "en" | "de" | "ru";

export interface Strings {
	cmdMoveCompleted: string;
	menuTaskStatus: string;
	menuCompletionDate: string;
	menuRemoveDate: string;
	noticeMoved: (moved: number, returned: number) => string;
	noticeAutoMoved: (count: number) => string;
	noticeNoCompleted: string;
	headingMove: string;
	headingStatusMenu: string;
	headingDate: string;
	settingAutoModeName: string;
	settingAutoModeDesc: string;
	settingCalloutName: string;
	settingCalloutDesc: string;
	settingClosedName: string;
	settingClosedDesc: string;
	settingMenuCharsName: string;
	settingMenuCharsDesc: string;
	buttonFromTheme: string;
	settingDateName: string;
	settingDateDesc: string;
	settingDatePositionName: string;
	settingDatePositionDesc: string;
	datePositionStart: string;
	datePositionEnd: string;
	settingDateTemplateName: string;
	settingDateTemplateDesc: string;
	settingExcludedName: string;
	settingExcludedDesc: string;
}

const en: Strings = {
	cmdMoveCompleted: "Move completed tasks",
	menuTaskStatus: "Task status",
	menuCompletionDate: "Completion date",
	menuRemoveDate: "Remove date",
	noticeMoved: (moved, returned) => `Moved: ${moved}, returned: ${returned}.`,
	noticeAutoMoved: (count) => `Automatically moved ${count} completed task(s).`,
	noticeNoCompleted: "Nothing to move.",
	headingMove: "Moving completed tasks",
	headingStatusMenu: "Status menu",
	headingDate: "Completion date",
	settingAutoModeName: "Auto mode",
	settingAutoModeDesc:
		"Move fully completed tasks automatically as soon as they are checked " +
		"(only when all of their sub-tasks are checked too).",
	settingCalloutName: "Done block header",
	settingCalloutDesc:
		'First line of the callout that holds completed tasks, e.g. "> [!done]- Done". ' +
		"Existing blocks are found by callout type.",
	settingClosedName: "Closed task characters",
	settingClosedDesc:
		'Characters in the brackets that mark a task as closed, e.g. "x" in "- [x]". ' +
		"Closed tasks are moved to the done block, any other character means an open task.",
	settingMenuCharsName: "Status characters",
	settingMenuCharsDesc:
		'Characters offered in the editor menu to set the task status, in this order. The open status is always offered first. ' +
		'"From theme" puts the closed task characters first, then the characters styled by the current theme and CSS snippets.',
	buttonFromTheme: "From theme",
	settingDateName: "Append completion date",
	settingDateDesc: "Adds the completion date by the first date template to every moved, closed task line.",
	settingDatePositionName: "Date position",
	settingDatePositionDesc: "Where the date goes in the task line.",
	datePositionStart: "At the start (after the checkbox)",
	datePositionEnd: "At the end",
	settingDateTemplateName: "Date templates",
	settingDateTemplateDesc:
		"One template per line. The date format goes in braces and is made of YYYY, MM, DD, M and D, " +
		'e.g. "✅ {YYYY-MM-DD}" or "[{MM.YYYY}]". The first template is used for moved tasks, ' +
		'all of them are offered in the editor menu under "Completion date".',
	settingExcludedName: "Excluded folders/files",
	settingExcludedDesc:
		"One vault path per line. Auto mode stays inactive in these folders " +
		"(including subfolders) and files. Manual commands still work.",
};

const de: Strings = {
	cmdMoveCompleted: "Erledigte Aufgaben verschieben",
	menuTaskStatus: "Aufgabenstatus",
	menuCompletionDate: "Erledigt-Datum",
	menuRemoveDate: "Datum entfernen",
	noticeMoved: (moved, returned) => `Verschoben: ${moved}, zurückgeholt: ${returned}.`,
	noticeAutoMoved: (count) => `${count} erledigte Aufgabe(n) automatisch verschoben.`,
	noticeNoCompleted: "Nichts zu verschieben.",
	headingMove: "Erledigte Aufgaben verschieben",
	headingStatusMenu: "Statusmenü",
	headingDate: "Erledigt-Datum",
	settingAutoModeName: "Auto-Modus",
	settingAutoModeDesc:
		"Vollständig erledigte Aufgaben automatisch verschieben, sobald sie " +
		"abgehakt werden (nur wenn auch alle Unteraufgaben abgehakt sind).",
	settingCalloutName: "Kopfzeile des Erledigt-Blocks",
	settingCalloutDesc:
		"Erste Zeile des Callouts für erledigte Aufgaben, z. B. „> [!done]- Erledigt\". " +
		"Vorhandene Blöcke werden am Callout-Typ erkannt.",
	settingClosedName: "Zeichen für abgeschlossene Aufgaben",
	settingClosedDesc:
		'Zeichen in den Klammern, die eine Aufgabe als abgeschlossen markieren, z. B. "x" in "- [x]". ' +
		"Abgeschlossene Aufgaben werden in den Erledigt-Block verschoben, jedes andere Zeichen bedeutet eine offene Aufgabe.",
	settingMenuCharsName: "Statuszeichen",
	settingMenuCharsDesc:
		"Zeichen, die im Editor-Menü zum Setzen des Aufgabenstatus angeboten werden, in dieser Reihenfolge. Der offene Status wird immer als Erstes angeboten. " +
		"„Aus dem Theme\" setzt die Zeichen für abgeschlossene Aufgaben an den Anfang, danach die Zeichen, die das aktuelle Theme und die CSS-Snippets gestalten.",
	buttonFromTheme: "Aus dem Theme",
	settingDateName: "Erledigt-Datum anhängen",
	settingDateDesc: "Fügt jeder verschobenen, abgeschlossenen Aufgabe das Erledigt-Datum nach der ersten Datumsvorlage hinzu.",
	settingDatePositionName: "Position des Datums",
	settingDatePositionDesc: "Wo das Datum in der Aufgabenzeile steht.",
	datePositionStart: "Am Anfang (nach dem Kontrollkästchen)",
	datePositionEnd: "Am Ende",
	settingDateTemplateName: "Datumsvorlagen",
	settingDateTemplateDesc:
		"Eine Vorlage pro Zeile. Das Datumsformat steht in geschweiften Klammern und besteht aus YYYY, MM, DD, M und D, " +
		'z. B. "✅ {YYYY-MM-DD}" oder "[{MM.YYYY}]". Die erste Vorlage gilt für verschobene Aufgaben, ' +
		"alle werden im Editor-Menü unter „Erledigt-Datum\" angeboten.",
	settingExcludedName: "Ausgeschlossene Ordner/Dateien",
	settingExcludedDesc:
		"Ein Vault-Pfad pro Zeile. Der Auto-Modus bleibt in diesen Ordnern " +
		"(inklusive Unterordnern) und Dateien inaktiv. Manuelle Befehle funktionieren weiterhin.",
};

const ru: Strings = {
	cmdMoveCompleted: "Перенести выполненные задачи",
	menuTaskStatus: "Статус задачи",
	menuCompletionDate: "Дата выполнения",
	menuRemoveDate: "Удалить дату",
	noticeMoved: (moved, returned) => `Перенесено: ${moved}, возвращено: ${returned}.`,
	noticeAutoMoved: (count) => `Автоматически перенесено выполненных задач: ${count}.`,
	noticeNoCompleted: "Нечего переносить.",
	headingMove: "Перенос выполненных задач",
	headingStatusMenu: "Меню статуса",
	headingDate: "Дата выполнения",
	settingAutoModeName: "Автоперенос",
	settingAutoModeDesc:
		"Переносить полностью выполненные задачи автоматически, как только они " +
		"отмечены (только если отмечены и все подзадачи).",
	settingCalloutName: "Заголовок блока выполненных",
	settingCalloutDesc:
		"Первая строка callout для выполненных задач, например «> [!done]- Выполнено». " +
		"Существующий блок находится по типу callout.",
	settingClosedName: "Символы закрытых задач",
	settingClosedDesc:
		"Символы в скобках, которые означают закрытую задачу, например «x» в «- [x]». " +
		"Закрытые задачи переносятся в блок выполненных, любой другой символ означает открытую задачу.",
	settingMenuCharsName: "Символы статуса",
	settingMenuCharsDesc:
		"Символы, которые меню редактора предлагает для статуса задачи, в этом порядке. Открытый статус предлагается всегда, первым. " +
		"«Из темы» ставит первыми символы закрытых задач, за ними символы, для которых есть стили в текущей теме и CSS-сниппетах.",
	buttonFromTheme: "Из темы",
	settingDateName: "Добавлять дату выполнения",
	settingDateDesc: "Добавляет дату выполнения по первому шаблону даты к каждой перенесённой закрытой задаче.",
	settingDatePositionName: "Положение даты",
	settingDatePositionDesc: "Куда ставить дату в строке задачи.",
	datePositionStart: "В начале (после галочки)",
	datePositionEnd: "В конце",
	settingDateTemplateName: "Шаблоны даты",
	settingDateTemplateDesc:
		"Один шаблон на строку. Формат даты пишется в фигурных скобках из YYYY, MM, DD, M и D, " +
		"например «✅ {YYYY-MM-DD}» или «[{MM.YYYY}]». Первый шаблон используется при переносе, " +
		"все шаблоны предлагает меню редактора в пункте «Дата выполнения».",
	settingExcludedName: "Исключённые папки и файлы",
	settingExcludedDesc:
		"Один путь в хранилище на строку. Автоперенос не работает в этих папках " +
		"(включая вложенные) и файлах. Ручные команды работают как обычно.",
};

const LANGUAGES: Record<Lang, Strings> = { en, de, ru };

/** Returns the UI strings for the given language. */
export function getStrings(lang: Lang): Strings {
	return LANGUAGES[lang];
}
