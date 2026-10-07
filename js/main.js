import {
    createNote,
    getAllNotes,
    getNoteById,
    moveNoteToTrash,
    restoreNote,
    updateNote,
    deleteNotePermanently,
} from "./repositories/note-repository.js";

import {
    ensureDefaultRoute,
    getCurrentRoute,
    navigate,
} from "./router.js";

const app = document.querySelector("#app");
let selectedNoteId = null;
let currentView = "all";
let searchQuery = "";
let savedEditorRange = null;

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value;
    return element.innerHTML;
}

function plainTextToHtml(text) {
    if (!text) {
        return "";
    }

    return text
        .split("\n")
        .map((line) => `<p>${line ? escapeHtml(line) : "<br>"}</p>`)
        .join("");
}

function richTextToPlainText(html) {
    const container = document.createElement("div");
    container.innerHTML = html;
    container.querySelectorAll("br").forEach((element) => {
        element.replaceWith("\n");
    });
    container.querySelectorAll("p, div, li, h1, h2, h3").forEach((element) => {
        element.append("\n");
    });
    return container.textContent.replace(/\n{3,}/g, "\n\n").trim();
}

function getNotePlainText(note) {
    if (note.mode === "plain") {
        return note.content;
    }
    return richTextToPlainText(note.content);
}

function getNotePreview(note) {
    const normalizedContent = getNotePlainText(note).replace(/\s+/g, " ").trim();
    if (!normalizedContent) {
        return "No additional text";
    }
    const maxLength = 60;
    if (normalizedContent.length <= maxLength) {
        return normalizedContent;
    }
    return `${normalizedContent.slice(0, maxLength)}...`;
}


const INLINE_FORMAT_TAGS = {
    bold: "strong",
    italic: "em",
};

const BLOCK_FORMAT_TAGS = {
    normal: "p",
    h1: "h1",
    h2: "h2",
    h3: "h3",
};

const TEXT_BLOCK_TAG_NAMES = new Set(["P", "DIV", "H1", "H2", "H3", "LI"]);
const ROOT_BLOCK_TAG_NAMES = new Set(["P", "DIV", "H1", "H2", "H3", "UL", "OL"]);

function getRichEditor() {
    return document.querySelector("#note-content.editor-rich");
}

function findClosestTag(node, editor, tagName) {
    let element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    const normalizedTagName = tagName.toUpperCase();

    while (element && element !== editor) {
        if (element.tagName === normalizedTagName) {
            return element;
        }

        element = element.parentElement;
    }

    return null;
}

function getActiveEditorRange(editor) {
    const selection = window.getSelection();

    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);

        if (editor.contains(range.commonAncestorContainer)) {
            return range;
        }
    }

    if (savedEditorRange && editor.contains(savedEditorRange.commonAncestorContainer)) {
        return savedEditorRange;
    }

    return null;
}

function saveEditorSelection() {
    const editor = getRichEditor();
    const selection = window.getSelection();

    if (!editor || !selection || selection.rangeCount === 0) {
        return;
    }

    const range = selection.getRangeAt(0);

    if (!editor.contains(range.commonAncestorContainer)) {
        return;
    }

    savedEditorRange = range.cloneRange();
}

function setSelectionToNodeContents(node, collapseToEnd = false) {
    const selection = window.getSelection();
    const range = document.createRange();

    range.selectNodeContents(node);

    if (collapseToEnd) {
        range.collapse(false);
    }

    selection.removeAllRanges();
    selection.addRange(range);
    savedEditorRange = range.cloneRange();
}

function unwrapElement(element) {
    const parent = element.parentNode;

    while (element.firstChild) {
        parent.insertBefore(element.firstChild, element);
    }

    element.remove();
}

function wrapNodesBetweenMarkers(startMarker, endMarker, templateElement) {
    const nodes = [];
    let node = startMarker.nextSibling;

    while (node && node !== endMarker) {
        nodes.push(node);
        node = node.nextSibling;
    }

    if (nodes.length === 0) {
        return null;
    }

    const wrapper = templateElement.cloneNode(false);
    endMarker.parentNode.insertBefore(wrapper, endMarker);
    nodes.forEach((currentNode) => wrapper.append(currentNode));

    return wrapper;
}

function removeInlineFormattingFromSelection(element, range, selection, editor) {
    const outerStartMarker = document.createComment("format-start");
    const outerEndMarker = document.createComment("format-end");
    const startMarker = document.createComment("selection-start");
    const endMarker = document.createComment("selection-end");
    const parent = element.parentNode;

    parent.insertBefore(outerStartMarker, element);
    parent.insertBefore(outerEndMarker, element.nextSibling);

    const endRange = range.cloneRange();
    endRange.collapse(false);
    endRange.insertNode(endMarker);

    const startRange = range.cloneRange();
    startRange.collapse(true);
    startRange.insertNode(startMarker);

    unwrapElement(element);

    wrapNodesBetweenMarkers(outerStartMarker, startMarker, element);
    wrapNodesBetweenMarkers(endMarker, outerEndMarker, element);

    const newRange = document.createRange();
    newRange.setStartAfter(startMarker);
    newRange.setEndBefore(endMarker);

    selection.removeAllRanges();
    selection.addRange(newRange);

    outerStartMarker.remove();
    outerEndMarker.remove();
    startMarker.remove();
    endMarker.remove();

    editor.normalize();
    savedEditorRange = selection.getRangeAt(0).cloneRange();
}

function removeMatchingTags(root, tagName) {
    const elements = Array.from(root.querySelectorAll(tagName)).reverse();
    elements.forEach((element) => unwrapElement(element));
}

function toggleInlineFormatting(tagName) {
    const editor = getRichEditor();

    if (!editor) {
        return false;
    }

    const range = getActiveEditorRange(editor);

    if (!range || range.collapsed) {
        return false;
    }

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    const startElement = findClosestTag(range.startContainer, editor, tagName);
    const endElement = findClosestTag(range.endContainer, editor, tagName);

    if (startElement && startElement === endElement) {
        removeInlineFormattingFromSelection(startElement, range, selection, editor);
        return true;
    }

    const wrapper = document.createElement(tagName);
    const selectedContent = range.extractContents();

    removeMatchingTags(selectedContent, tagName);
    wrapper.append(selectedContent);
    range.insertNode(wrapper);

    setSelectionToNodeContents(wrapper);
    return true;
}

function normalizeRichTextBlocks(editor) {
    const nodes = Array.from(editor.childNodes);
    let paragraph = null;

    for (const node of nodes) {
        if (node.nodeType === Node.ELEMENT_NODE && ROOT_BLOCK_TAG_NAMES.has(node.tagName)) {
            paragraph = null;
            continue;
        }

        if (node.nodeName === "BR") {
            if (paragraph) {
                node.remove();
                paragraph = null;
            } else {
                const emptyParagraph = document.createElement("p");
                editor.insertBefore(emptyParagraph, node);
                emptyParagraph.append(node);
            }

            continue;
        }

        if (!paragraph) {
            paragraph = document.createElement("p");
            editor.insertBefore(paragraph, node);
        }

        paragraph.append(node);
    }
}

function findClosestBlock(node, editor) {
    let element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;

    while (element && element !== editor) {
        if (TEXT_BLOCK_TAG_NAMES.has(element.tagName)) {
            return element;
        }

        element = element.parentElement;
    }

    return null;
}

function replaceElementTag(element, tagName) {
    const replacement = document.createElement(tagName);

    for (const attribute of element.attributes) {
        replacement.setAttribute(attribute.name, attribute.value);
    }

    while (element.firstChild) {
        replacement.append(element.firstChild);
    }

    element.replaceWith(replacement);
    return replacement;
}

function applyBlockFormatting(format) {
    const editor = getRichEditor();
    const tagName = BLOCK_FORMAT_TAGS[format];

    if (!editor || !tagName) {
        return false;
    }

    const range = getActiveEditorRange(editor);

    if (!range) {
        return false;
    }

    const block = findClosestBlock(range.startContainer, editor);

    if (!block || block.tagName === "LI") {
        return false;
    }

    const currentTagName = block.tagName.toLowerCase();

    if (currentTagName === tagName || (format === "normal" && (currentTagName === "p" || currentTagName === "div"))) {
        editor.focus();
        return false;
    }

    const replacement = replaceElementTag(block, tagName);
    setSelectionToNodeContents(replacement, true);
    editor.focus();

    return true;
}

function unwrapListItemToParagraph(listItem) {
    const list = listItem.parentElement;
    const parent = list.parentElement;
    const items = Array.from(list.children);
    const itemIndex = items.indexOf(listItem);
    const beforeItems = items.slice(0, itemIndex);
    const afterItems = items.slice(itemIndex + 1);
    const paragraph = document.createElement("p");

    while (listItem.firstChild) {
        paragraph.append(listItem.firstChild);
    }

    if (beforeItems.length > 0) {
        const beforeList = document.createElement(list.tagName.toLowerCase());
        beforeItems.forEach((item) => beforeList.append(item));
        parent.insertBefore(beforeList, list);
    }

    parent.insertBefore(paragraph, list);

    if (afterItems.length > 0) {
        const afterList = document.createElement(list.tagName.toLowerCase());
        afterItems.forEach((item) => afterList.append(item));
        parent.insertBefore(afterList, list);
    }

    list.remove();
    return paragraph;
}

function toggleListFormatting(listTagName) {
    const editor = getRichEditor();

    if (!editor) {
        return false;
    }

    const range = getActiveEditorRange(editor);

    if (!range) {
        return false;
    }

    const listItem = findClosestTag(range.startContainer, editor, "li");

    if (listItem) {
        const list = listItem.parentElement;

        if (!list || (list.tagName !== "UL" && list.tagName !== "OL")) {
            return false;
        }

        if (list.tagName.toLowerCase() === listTagName) {
            const paragraph = unwrapListItemToParagraph(listItem);
            setSelectionToNodeContents(paragraph, true);
        } else {
            replaceElementTag(list, listTagName);
            setSelectionToNodeContents(listItem, true);
        }

        editor.focus();
        return true;
    }

    const block = findClosestBlock(range.startContainer, editor);

    if (!block || block.tagName === "LI") {
        return false;
    }

    const list = document.createElement(listTagName);
    const newListItem = document.createElement("li");

    while (block.firstChild) {
        newListItem.append(block.firstChild);
    }

    list.append(newListItem);
    block.replaceWith(list);

    setSelectionToNodeContents(newListItem, true);
    editor.focus();

    return true;
}

function normalizeLinkUrl(value) {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
        return null;
    }

    if (/^(https?:\/\/|mailto:)/i.test(trimmedValue)) {
        return trimmedValue;
    }

    return `https://${trimmedValue}`;
}

function toggleLinkFormatting() {
    const editor = getRichEditor();

    if (!editor) {
        return false;
    }

    const range = getActiveEditorRange(editor);

    if (!range) {
        return false;
    }

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    const startAnchor = findClosestTag(range.startContainer, editor, "a");
    const endAnchor = findClosestTag(range.endContainer, editor, "a");

    if (startAnchor && startAnchor === endAnchor) {
        if (range.collapsed) {
            const anchorRange = document.createRange();
            anchorRange.selectNodeContents(startAnchor);
            removeInlineFormattingFromSelection(startAnchor, anchorRange, selection, editor);
        } else {
            removeInlineFormattingFromSelection(startAnchor, range, selection, editor);
        }

        editor.focus();
        return true;
    }

    const enteredUrl = window.prompt("Enter URL:", "https://");

    if (enteredUrl === null) {
        return false;
    }

    const href = normalizeLinkUrl(enteredUrl);

    if (!href) {
        return false;
    }

    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";

    if (range.collapsed) {
        anchor.textContent = enteredUrl.trim() || href;
        range.insertNode(anchor);
        setSelectionToNodeContents(anchor, true);
    } else {
        const selectedContent = range.extractContents();
        removeMatchingTags(selectedContent, "a");
        anchor.append(selectedContent);
        range.insertNode(anchor);
        setSelectionToNodeContents(anchor);
    }

    editor.focus();
    return true;
}

const CLEAR_FORMAT_TAG_NAMES = new Set(["STRONG", "EM", "A"]);

function findClosestClearFormatTag(node, editor) {
    let element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;

    while (element && element !== editor) {
        if (CLEAR_FORMAT_TAG_NAMES.has(element.tagName)) {
            return element;
        }

        element = element.parentElement;
    }

    return null;
}

function splitInlineFormattingAtMarker(marker, editor) {
    let element = findClosestClearFormatTag(marker, editor);

    while (element) {
        const parent = element.parentNode;
        const afterRange = document.createRange();

        afterRange.setStartAfter(marker);
        afterRange.setEnd(element, element.childNodes.length);

        const afterContent = afterRange.extractContents();
        const afterElement = element.cloneNode(false);

        afterElement.append(afterContent);
        parent.insertBefore(marker, element.nextSibling);

        if (afterElement.hasChildNodes()) {
            parent.insertBefore(afterElement, marker.nextSibling);
        }

        element = findClosestClearFormatTag(marker, editor);
    }
}

function removeSelectedInlineFormatting(range, editor) {
    const selection = window.getSelection();
    const startMarker = document.createComment("clear-start");
    const endMarker = document.createComment("clear-end");

    const endRange = range.cloneRange();
    endRange.collapse(false);
    endRange.insertNode(endMarker);

    const startRange = range.cloneRange();
    startRange.collapse(true);
    startRange.insertNode(startMarker);

    splitInlineFormattingAtMarker(startMarker, editor);
    splitInlineFormattingAtMarker(endMarker, editor);

    const selectedRange = document.createRange();
    selectedRange.setStartAfter(startMarker);
    selectedRange.setEndBefore(endMarker);

    const formattedElements = Array.from(
        editor.querySelectorAll("strong, em, a"),
    )
        .filter((element) => selectedRange.intersectsNode(element))
        .reverse();

    formattedElements.forEach((element) => unwrapElement(element));

    const newRange = document.createRange();
    newRange.setStartAfter(startMarker);
    newRange.setEndBefore(endMarker);

    selection.removeAllRanges();
    selection.addRange(newRange);

    startMarker.remove();
    endMarker.remove();

    editor.normalize();

    if (selection.rangeCount > 0) {
        savedEditorRange = selection.getRangeAt(0).cloneRange();
    }

    editor.focus();
}

function clearCurrentBlockFormatting(range, editor) {
    let block = findClosestBlock(range.startContainer, editor);

    if (!block) {
        return false;
    }

    const plainText = richTextToPlainText(block.innerHTML);

    if (block.tagName === "LI") {
        block = unwrapListItemToParagraph(block);
    } else if (block.tagName !== "P") {
        block = replaceElementTag(block, "p");
    }

    block.innerHTML = plainText ? escapeHtml(plainText).replace(/\n/g, "<br>") : "<br>";

    setSelectionToNodeContents(block, true);
    editor.focus();

    return true;
}

function clearSelectedFormatting() {
    const editor = getRichEditor();

    if (!editor) {
        return false;
    }

    const range = getActiveEditorRange(editor);

    if (!range) {
        return false;
    }

    if (range.collapsed) {
        return clearCurrentBlockFormatting(range, editor);
    }

    removeSelectedInlineFormatting(range, editor);
    return true;
}

function setToolbarButtonActive(button, active) {
    button.classList.toggle("editor-toolbar__button--active", active);
    button.setAttribute("aria-pressed", String(active));
}

function updateToolbarState() {
    const editor = getRichEditor();
    const toolbar = document.querySelector(".editor-toolbar");

    if (!editor || !toolbar) {
        return;
    }

    const range = getActiveEditorRange(editor);
    const blockFormatSelect = toolbar.querySelector("[data-block-format]");
    const formatButtons = toolbar.querySelectorAll("[data-format]");
    const commandButtons = toolbar.querySelectorAll("[data-command]");

    if (!range) {
        blockFormatSelect.value = "normal";
        formatButtons.forEach((button) => setToolbarButtonActive(button, false));
        commandButtons.forEach((button) => {
            if (button.dataset.command !== "clear-formatting") {
                setToolbarButtonActive(button, false);
            }
        });
        return;
    }

    const node = range.startContainer;
    const block = findClosestBlock(node, editor);
    const blockTagName = block?.tagName.toLowerCase();

    blockFormatSelect.value = ["h1", "h2", "h3"].includes(blockTagName) ? blockTagName : "normal";

    formatButtons.forEach((button) => {
        const tagName = INLINE_FORMAT_TAGS[button.dataset.format];
        const active = tagName ? Boolean(findClosestTag(node, editor, tagName)) : false;
        setToolbarButtonActive(button, active);
    });

    commandButtons.forEach((button) => {
        const command = button.dataset.command;
        let active = false;

        if (command === "unordered-list") {
            active = Boolean(findClosestTag(node, editor, "ul"));
        } else if (command === "ordered-list") {
            active = Boolean(findClosestTag(node, editor, "ol"));
        } else if (command === "link") {
            active = Boolean(findClosestTag(node, editor, "a"));
        }

        if (command !== "clear-formatting") {
            setToolbarButtonActive(button, active);
        }
    });
}

function persistRichContent() {
    if (!selectedNoteId || currentView === "trash") {
        return;
    }

    const contentInput = document.querySelector("#note-content");

    if (!contentInput) {
        return;
    }

    updateNote(selectedNoteId, {
        content: contentInput.innerHTML,
        mode: undefined,
    });

    renderNoteList();
}


function formatUpdatedAt(updatedAt) {
    const updatedDate = new Date(updatedAt);
    const now = new Date();
    const diffMilliseconds = now.getTime() - updatedDate.getTime();
    const diffMinutes = Math.floor(diffMilliseconds / 1000 / 60);
    if (diffMinutes < 1) {
        return "Just now";
    }
    if (diffMinutes < 60) {
        return `${diffMinutes} min ago`;
    }
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
        return `${diffHours} hr ago`;
    }
    return updatedDate.toLocaleDateString();
}

function syncStateWithRoute() {
    const route = getCurrentRoute();
    if (route.notFound) {
        currentView = null;
        selectedNoteId = null;
        return false;
    }
    currentView = route.view;
    selectedNoteId = route.noteId;
    return true;
}

function normalizeSelectedNoteRoute() {
    if (!selectedNoteId) {
        return true;
    }
    const note = getNoteById(selectedNoteId);
    if (!note) {
        return true;
    }
    if (note.deleted && currentView !== "trash") {
        navigate("trash", note.id);
        return false;
    }
    if (!note.deleted && currentView === "trash") {
        navigate("all", note.id);
        return false;
    }
    if (currentView === "pinned" && !note.pinned) {
        navigate("all", note.id);
        return false;
    }
    return true;
}

function renderApp() {
    app.innerHTML = `
        <div class="app-layout">
            <aside class="sidebar">
                <h1 class="logo">Draft</h1>
                <nav class="sidebar-nav">
                    <button
                        type="button"
                        class="sidebar-nav__item sidebar-nav__item--active"
                        data-view="all"
                    >
                        All Notes
                    </button>
                    <button
                        type="button"
                        class="sidebar-nav__item"
                        data-view="pinned"
                    >
                        Pinned
                    </button>
                    <button
                        type="button"
                        class="sidebar-nav__item"
                        data-view="trash"
                    >
                        Trash
                    </button>
                </nav>
                <button
                    id="new-note-button"
                    type="button"
                    class="new-note-button"
                >
                    + New Note
                </button>
            </aside>
            <section class="note-list-panel">
                <header class="note-list-header">
                    <h2 id="note-list-title">Notes</h2>
                </header>
                <div class="note-search">
                    <input
                        id="note-search"
                        type="search"
                        placeholder="Search notes..."
                        aria-label="Search notes"
                        value="${escapeHtml(searchQuery)}"
                    >
                </div>
                <div
                    id="note-list"
                    class="note-list"
                ></div>
            </section>
            <main
                id="editor-panel"
                class="editor-panel"
            >
                <div class="editor-empty">
                    <p>Select or create a note.</p>
                </div>
            </main>
        </div>
    `;
}

function renderNavigation() {
    const navigationItems = document.querySelectorAll("[data-view]");
    navigationItems.forEach((item) => {
        const isActive = item.dataset.view === currentView;
        item.classList.toggle("sidebar-nav__item--active", isActive);
    });
    if (!currentView) {
        return;
    }
    const noteListTitle = document.querySelector("#note-list-title");
    const titles = {
        all: "Notes",
        pinned: "Pinned",
        trash: "Trash",
    };
    noteListTitle.textContent = titles[currentView];
}

function renderNoteList() {
    const noteList = document.querySelector("#note-list");
    let notes = getAllNotes();
    if (currentView === "all") {
        notes = notes.filter((note) => !note.deleted);
    }
    if (currentView === "pinned") {
        notes = notes.filter((note) => !note.deleted && note.pinned);
    }
    if (currentView === "trash") {
        notes = notes.filter((note) => note.deleted);
    }
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (normalizedQuery) {
        notes = notes.filter((note) => {
            const title = note.title.toLowerCase();
            const content = getNotePlainText(note).toLowerCase();
            return title.includes(normalizedQuery) || content.includes(normalizedQuery);
        });
    }
    notes.sort((a, b) => {
        if (a.pinned !== b.pinned) {
            return Number(b.pinned) - Number(a.pinned);
        }
        return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    if (notes.length === 0) {
        const emptyMessages = {
            all: "No notes yet.",
            pinned: "No pinned notes.",
            trash: "Trash is empty.",
        };
        const message = searchQuery.trim() ? "No matching notes." : emptyMessages[currentView];
        noteList.innerHTML = `
            <p class="empty-message">
                ${message}
            </p>
        `;
        return;
    }
    noteList.innerHTML = notes
        .map((note) => {
            const isSelected = note.id === selectedNoteId;
            const displayTitle = note.title.trim() || "Untitled";
            const preview = getNotePreview(note);
            const updatedAt = formatUpdatedAt(note.updatedAt);
            return `
                <button
                    type="button"
                    class="note-item ${isSelected ? "note-item--selected" : ""}"
                    data-note-id="${note.id}"
                >
                    <div class="note-item__header">
                        <div class="note-item__title-wrap">
                            ${note.pinned ? '<span class="note-item__pin" aria-label="Pinned">●</span>' : ""}
                            <strong class="note-item__title">
                                ${escapeHtml(displayTitle)}
                            </strong>
                        </div>
                        <span class="note-item__time">
                            ${escapeHtml(updatedAt)}
                        </span>
                    </div>
                    <p class="note-item__preview">${escapeHtml(preview)}</p>
                </button>
            `;
        })
        .join("");
}

function renderEditor() {
    const editorPanel = document.querySelector("#editor-panel");

    if (!selectedNoteId) {
        editorPanel.innerHTML = `
            <div class="editor-empty">
                <p>Select or create a note.</p>
            </div>
        `;
        return;
    }

    const note = getNoteById(selectedNoteId);

    if (!note) {
        selectedNoteId = null;
        editorPanel.innerHTML = `
            <div class="editor-empty">
                <p>Note not found.</p>
            </div>
        `;
        return;
    }

    const isTrashView = currentView === "trash";

    editorPanel.innerHTML = `
        <div class="editor-content">
            <header class="editor-header">
                <input
                    id="note-title"
                    class="editor-title"
                    type="text"
                    placeholder="Untitled"
                    aria-label="Note title"
                    ${isTrashView ? "readonly" : ""}
                >
                <div class="editor-actions">
                    ${
                        isTrashView
                            ? `
                                <button
                                    id="restore-note-button"
                                    class="editor-action-button"
                                    type="button"
                                >
                                    Restore
                                </button>
                                <button
                                    id="delete-note-button"
                                    class="editor-action-button editor-action-button--danger"
                                    type="button"
                                >
                                    Delete Permanently
                                </button>
                            `
                            : `
                                <button
                                    id="toggle-pin-button"
                                    class="editor-action-button"
                                    type="button"
                                    aria-pressed="${note.pinned}"
                                >
                                    ${note.pinned ? "Unpin" : "Pin"}
                                </button>
                                <button
                                    id="trash-note-button"
                                    class="editor-action-button"
                                    type="button"
                                >
                                    Trash
                                </button>
                            `
                    }
                </div>
            </header>
            ${
                isTrashView
                    ? ""
                    : `
                        <div class="editor-toolbar">
                            <select
                                class="editor-toolbar__select"
                                data-block-format
                                aria-label="Text style"
                            >
                                <option value="normal">Normal</option>
                                <option value="h1">Heading 1</option>
                                <option value="h2">Heading 2</option>
                                <option value="h3">Heading 3</option>
                            </select>
                            <button
                                type="button"
                                class="editor-toolbar__button"
                                data-format="bold"
                                aria-label="Bold"
                                aria-pressed="false"
                            >
                                <strong>B</strong>
                            </button>
                            <button
                                type="button"
                                class="editor-toolbar__button"
                                data-format="italic"
                                aria-label="Italic"
                                aria-pressed="false"
                            >
                                <em>I</em>
                            </button>
                            <span class="editor-toolbar__separator" aria-hidden="true"></span>
                            <button
                                type="button"
                                class="editor-toolbar__button"
                                data-command="unordered-list"
                                aria-label="Bulleted list"
                                aria-pressed="false"
                            >
                                • List
                            </button>
                            <button
                                type="button"
                                class="editor-toolbar__button"
                                data-command="ordered-list"
                                aria-label="Numbered list"
                                aria-pressed="false"
                            >
                                1. List
                            </button>
                            <button
                                type="button"
                                class="editor-toolbar__button"
                                data-command="link"
                                aria-label="Link"
                                aria-pressed="false"
                            >
                                Link
                            </button>
                            <span class="editor-toolbar__separator" aria-hidden="true"></span>
                            <button
                                type="button"
                                class="editor-toolbar__button"
                                data-command="clear-formatting"
                                aria-label="Clear formatting"
                            >
                                Clear
                            </button>
                        </div>
                    `
            }
            <div
                id="note-content"
                class="editor-rich"
                contenteditable="${isTrashView ? "false" : "true"}"
                role="textbox"
                aria-multiline="true"
                aria-label="Note content"
                data-placeholder="Start writing..."
            ></div>
        </div>
    `;

    const titleInput = document.querySelector("#note-title");
    const contentInput = document.querySelector("#note-content");
    const editorContent = note.mode === "plain" ? plainTextToHtml(note.content) : note.content;

    titleInput.value = note.title;
    contentInput.innerHTML = editorContent;
    normalizeRichTextBlocks(contentInput);
    savedEditorRange = null;
    updateToolbarState();
}

function renderRoute() {
    const routeExists = syncStateWithRoute();
    renderNavigation();
    if (!routeExists) {
        renderNotFound();
        return;
    }
    const routeIsValid = normalizeSelectedNoteRoute();
    if (!routeIsValid) {
        return;
    }
    renderNoteList();
    renderEditor();
}

function renderNotFound() {
    const noteListTitle = document.querySelector("#note-list-title");
    const noteList = document.querySelector("#note-list");
    const editorPanel = document.querySelector("#editor-panel");
    noteListTitle.textContent = "Not Found";
    noteList.innerHTML = `
        <p class="empty-message">
            The requested page does not exist.
        </p>
    `;
    editorPanel.innerHTML = `
        <div class="editor-empty">
            <p>Page not found.</p>
        </div>
    `;
}

function init() {
    renderApp();
    ensureDefaultRoute();
    renderRoute();

    const newNoteButton = document.querySelector("#new-note-button");
    const sidebarNavigation = document.querySelector(".sidebar-nav");
    const noteSearch = document.querySelector("#note-search");
    const noteList = document.querySelector("#note-list");
    const editorPanel = document.querySelector("#editor-panel");

    window.addEventListener("hashchange", () => {
        renderRoute();
    });

    document.addEventListener("selectionchange", () => {
        const editor = getRichEditor();
        const selection = window.getSelection();

        if (!editor || !selection || selection.rangeCount === 0) {
            return;
        }

        const range = selection.getRangeAt(0);

        if (!editor.contains(range.commonAncestorContainer)) {
            return;
        }

        savedEditorRange = range.cloneRange();
        updateToolbarState();
    });

    newNoteButton.addEventListener("click", () => {
        const note = createNote();
        navigate("all", note.id);
    });

    sidebarNavigation.addEventListener("click", (event) => {
        const navigationItem = event.target.closest("[data-view]");

        if (!navigationItem) {
            return;
        }

        navigate(navigationItem.dataset.view);
    });

    noteSearch.addEventListener("input", (event) => {
        searchQuery = event.target.value;

        if (selectedNoteId) {
            navigate(currentView);
            return;
        }

        renderNoteList();
    });

    noteList.addEventListener("click", (event) => {
        const noteItem = event.target.closest(".note-item");

        if (!noteItem) {
            return;
        }

        navigate(currentView, noteItem.dataset.noteId);
    });

    editorPanel.addEventListener("input", (event) => {
        if (!selectedNoteId || currentView === "trash") {
            return;
        }

        if (event.target.id !== "note-title" && event.target.id !== "note-content") {
            return;
        }

        const note = getNoteById(selectedNoteId);

        if (!note) {
            return;
        }

        const titleInput = document.querySelector("#note-title");
        const contentInput = document.querySelector("#note-content");

        if (event.target.id === "note-content") {
            normalizeRichTextBlocks(contentInput);
        }

        updateNote(selectedNoteId, {
            title: titleInput.value,
            content: contentInput.innerHTML,
            mode: undefined,
        });

        renderNoteList();

        if (event.target.id === "note-content") {
            saveEditorSelection();
            updateToolbarState();
        }
    });

    editorPanel.addEventListener("click", (event) => {
        if (!selectedNoteId) {
            return;
        }

        const editorLink = event.target.closest("#note-content.editor-rich a");

        if (editorLink) {
            event.preventDefault();
            return;
        }

        const pinButton = event.target.closest("#toggle-pin-button");
        const trashButton = event.target.closest("#trash-note-button");
        const restoreButton = event.target.closest("#restore-note-button");
        const deleteButton = event.target.closest("#delete-note-button");
        const formatButton = event.target.closest("[data-format]");
        const commandButton = event.target.closest("[data-command]");

        if (formatButton) {
            const note = getNoteById(selectedNoteId);

            if (!note || currentView === "trash") {
                return;
            }

            const tagName = INLINE_FORMAT_TAGS[formatButton.dataset.format];

            if (!tagName) {
                return;
            }

            const changed = toggleInlineFormatting(tagName);

            if (changed) {
                persistRichContent();
            }

            saveEditorSelection();
            updateToolbarState();
            return;
        }

        if (commandButton) {
            const note = getNoteById(selectedNoteId);

            if (!note || currentView === "trash") {
                return;
            }

            const command = commandButton.dataset.command;
            let changed = false;

            if (command === "unordered-list") {
                changed = toggleListFormatting("ul");
            } else if (command === "ordered-list") {
                changed = toggleListFormatting("ol");
            } else if (command === "link") {
                changed = toggleLinkFormatting();
            } else if (command === "clear-formatting") {
                changed = clearSelectedFormatting();
            }

            if (changed) {
                persistRichContent();
            }

            saveEditorSelection();
            updateToolbarState();
            return;
        }

        if (pinButton) {
            const note = getNoteById(selectedNoteId);

            if (!note) {
                return;
            }

            const willBePinned = !note.pinned;

            updateNote(selectedNoteId, {
                pinned: willBePinned,
            });

            if (currentView === "pinned" && !willBePinned) {
                navigate("pinned");
                return;
            }

            renderNoteList();
            renderEditor();
            return;
        }

        if (trashButton) {
            moveNoteToTrash(selectedNoteId);
            navigate(currentView);
            return;
        }

        if (restoreButton) {
            restoreNote(selectedNoteId);
            navigate("trash");
            return;
        }

        if (deleteButton) {
            const confirmed = window.confirm("Delete this note permanently? This action cannot be undone.");

            if (!confirmed) {
                return;
            }

            deleteNotePermanently(selectedNoteId);
            navigate("trash");
        }
    });

    editorPanel.addEventListener("change", (event) => {
        const blockFormatSelect = event.target.closest("[data-block-format]");

        if (!blockFormatSelect || !selectedNoteId || currentView === "trash") {
            return;
        }

        const note = getNoteById(selectedNoteId);

        if (!note) {
            return;
        }

        const changed = applyBlockFormatting(blockFormatSelect.value);

        if (changed) {
            persistRichContent();
        }

        saveEditorSelection();
        updateToolbarState();
    });

    editorPanel.addEventListener("mousedown", (event) => {
        const blockFormatSelect = event.target.closest("[data-block-format]");

        if (blockFormatSelect) {
            saveEditorSelection();
            return;
        }

        const toolbarButton = event.target.closest("[data-format], [data-command]");

        if (!toolbarButton) {
            return;
        }

        saveEditorSelection();
        event.preventDefault();
    });
}

init();
