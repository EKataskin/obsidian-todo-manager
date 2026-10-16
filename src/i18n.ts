// UI string localization. English is the default; German or Russian is used
// when Obsidian's interface language is German or Russian.

export type Lang = "en" | "de" | "ru";

export interface Strings {
	cmdMoveCompleted: string;
	noticeMoved: (moved: number, returned: number) => string;
	noticeAutoMoved: (count: number) => string;
	noticeNoCompleted: string;
	settingAutoModeName: string;
	settingAutoModeDesc: string;
	settingCalloutName: string;
	settingCalloutDesc: string;
	settingDateName: string;
	settingDateDesc: string;
	settingExcludedName: string;
	settingExcludedDesc: string;
}

const en: Strings = {
	cmdMoveCompleted: "Move completed tasks",
	noticeMoved: (moved, returned) => `Moved: ${moved}, returned: ${returned}.`,
	noticeAutoMoved: (count) => `Automatically moved ${count} completed task(s).`,
	noticeNoCompleted: "Nothing to move.",
	settingAutoModeName: "Auto mode",
	settingAutoModeDesc:
		"Move fully completed tasks automatically as soon as they are checked " +
		"(only when all of their sub-tasks are checked too).",
	settingCalloutName: "Done block header",
	settingCalloutDesc:
		'First line of the callout that holds completed tasks, e.g. "> [!done]- Done". ' +
		"Existing blocks are found by callout type.",
	settingDateName: "Append completion date",
	settingDateDesc: 'Appends "✅ YYYY-MM-DD" to every moved, checked line.',
	settingExcludedName: "Excluded folders/files",
	settingExcludedDesc:
		"One vault path per line. Auto mode stays inactive in these folders " +
		"(including subfolders) and files. Manual commands still work.",
};

const de: Strings = {
	cmdMoveCompleted: "Erledigte Aufgaben verschieben",
	noticeMoved: (moved, returned) => `Verschoben: ${moved}, zurückgeholt: ${returned}.`,
	noticeAutoMoved: (count) => `${count} erledigte Aufgabe(n) automatisch verschoben.`,
	noticeNoCompleted: "Nichts zu verschieben.",
	settingAutoModeName: "Auto-Modus",
	settingAutoModeDesc:
		"Vollständig erledigte Aufgaben automatisch verschieben, sobald sie " +
		"abgehakt werden (nur wenn auch alle Unteraufgaben abgehakt sind).",
	settingCalloutName: "Kopfzeile des Erledigt-Blocks",
	settingCalloutDesc:
		"Erste Zeile des Callouts für erledigte Aufgaben, z. B. „> [!done]- Erledigt\". " +
		"Vorhandene Blöcke werden am Callout-Typ erkannt.",
	settingDateName: "Erledigt-Datum anhängen",
	settingDateDesc: 'Hängt "✅ JJJJ-MM-TT" an jede verschobene, abgehakte Zeile an.',
	settingExcludedName: "Ausgeschlossene Ordner/Dateien",
	settingExcludedDesc:
		"Ein Vault-Pfad pro Zeile. Der Auto-Modus bleibt in diesen Ordnern " +
		"(inklusive Unterordnern) und Dateien inaktiv. Manuelle Befehle funktionieren weiterhin.",
};

const ru: Strings = {
	cmdMoveCompleted: "Перенести выполненные задачи",
	noticeMoved: (moved, returned) => `Перенесено: ${moved}, возвращено: ${returned}.`,
	noticeAutoMoved: (count) => `Автоматически перенесено выполненных задач: ${count}.`,
	noticeNoCompleted: "Нечего переносить.",
	settingAutoModeName: "Автоперенос",
	settingAutoModeDesc:
		"Переносить полностью выполненные задачи автоматически, как только они " +
		"отмечены (только если отмечены и все подзадачи).",
	settingCalloutName: "Заголовок блока выполненных",
	settingCalloutDesc:
		"Первая строка callout для выполненных задач, например «> [!done]- Выполнено». " +
		"Существующий блок находится по типу callout.",
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
