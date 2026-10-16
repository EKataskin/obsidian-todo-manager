// UI string localization. English is the default; German or Russian is used
// when Obsidian's interface language is German or Russian.

export type Lang = "en" | "de" | "ru";

export interface Strings {
	cmdMoveCompleted: string;
	cmdMoveSelection: string;
	noticeMoved: (count: number, heading: string) => string;
	noticeAutoMoved: (count: number) => string;
	noticeNoCompleted: string;
	noticeNoSelection: string;
	settingAutoModeName: string;
	settingAutoModeDesc: string;
	settingHeadingName: string;
	settingHeadingDesc: string;
	settingDateName: string;
	settingDateDesc: string;
	settingExcludedName: string;
	settingExcludedDesc: string;
}

const en: Strings = {
	cmdMoveCompleted: "Move completed tasks to Done",
	cmdMoveSelection: "Move selection to Done",
	noticeMoved: (count, heading) => `Moved ${count} task(s) to "${heading}".`,
	noticeAutoMoved: (count) => `Automatically moved ${count} completed task(s).`,
	noticeNoCompleted: "No fully completed tasks found.",
	noticeNoSelection: "No tasks found in the selection.",
	settingAutoModeName: "Auto mode",
	settingAutoModeDesc:
		"Move fully completed tasks automatically as soon as they are checked " +
		"(only when all of their sub-tasks are checked too).",
	settingHeadingName: "Done heading",
	settingHeadingDesc:
		"Name of the target heading that completed tasks are moved under.",
	settingDateName: "Append completion date",
	settingDateDesc: 'Appends "✅ YYYY-MM-DD" to every moved, checked line.',
	settingExcludedName: "Excluded folders/files",
	settingExcludedDesc:
		"One vault path per line. Auto mode stays inactive in these folders " +
		"(including subfolders) and files. Manual commands still work.",
};

const de: Strings = {
	cmdMoveCompleted: "Erledigte Aufgaben nach Done verschieben",
	cmdMoveSelection: "Auswahl nach Done verschieben",
	noticeMoved: (count, heading) => `${count} Aufgabe(n) nach „${heading}" verschoben.`,
	noticeAutoMoved: (count) => `${count} erledigte Aufgabe(n) automatisch verschoben.`,
	noticeNoCompleted: "Keine vollständig erledigten Aufgaben gefunden.",
	noticeNoSelection: "Keine Aufgaben in der Auswahl gefunden.",
	settingAutoModeName: "Auto-Modus",
	settingAutoModeDesc:
		"Vollständig erledigte Aufgaben automatisch verschieben, sobald sie " +
		"abgehakt werden (nur wenn auch alle Unteraufgaben abgehakt sind).",
	settingHeadingName: "Done-Überschrift",
	settingHeadingDesc:
		"Name der Ziel-Überschrift, unter die erledigte Aufgaben verschoben werden.",
	settingDateName: "Erledigt-Datum anhängen",
	settingDateDesc: 'Hängt "✅ JJJJ-MM-TT" an jede verschobene, abgehakte Zeile an.',
	settingExcludedName: "Ausgeschlossene Ordner/Dateien",
	settingExcludedDesc:
		"Ein Vault-Pfad pro Zeile. Der Auto-Modus bleibt in diesen Ordnern " +
		"(inklusive Unterordnern) und Dateien inaktiv. Manuelle Befehle funktionieren weiterhin.",
};

const ru: Strings = {
	cmdMoveCompleted: "Перенести выполненные задачи в Done",
	cmdMoveSelection: "Перенести выделенное в Done",
	noticeMoved: (count, heading) => `Перенесено задач в «${heading}»: ${count}.`,
	noticeAutoMoved: (count) => `Автоматически перенесено выполненных задач: ${count}.`,
	noticeNoCompleted: "Полностью выполненных задач не найдено.",
	noticeNoSelection: "В выделении нет задач.",
	settingAutoModeName: "Автоперенос",
	settingAutoModeDesc:
		"Переносить полностью выполненные задачи автоматически, как только они " +
		"отмечены (только если отмечены и все подзадачи).",
	settingHeadingName: "Заголовок Done",
	settingHeadingDesc:
		"Название заголовка, под который переносятся выполненные задачи.",
	settingDateName: "Добавлять дату выполнения",
	settingDateDesc: "Дописывает «✅ ГГГГ-ММ-ДД» к каждой перенесённой отмеченной строке.",
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
