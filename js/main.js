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

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value;

    return element.innerHTML;
}

function plainTextToHtml(text) {
    return escapeHtml(text)
        .replace(/\n/g, "<br>");
}

function richTextToPlainText(html) {
    const container =
        document.createElement("div");

    container.innerHTML = html;

    container
        .querySelectorAll("br")
        .forEach((element) => {
            element.replaceWith("\n");
        });

    container
        .querySelectorAll("p, div, li")
        .forEach((element) => {
            element.append("\n");
        });

    return container.textContent
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function getNotePlainText(note) {
    if (note.mode === "rich") {
        return richTextToPlainText(
            note.content,
        );
    }

    return note.content;
}

function getNotePreview(note) {
    const normalizedContent = getNotePlainText(note)
        .replace(/\s+/g, " ")
        .trim();

    if (!normalizedContent) {
        return "No additional text";
    }

    const maxLength = 60;

    if (normalizedContent.length <= maxLength) {
        return normalizedContent;
    }

    return `${normalizedContent.slice(0, maxLength)}...`;
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

    if (
        currentView === "pinned"
        && !note.pinned
    ) {
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
    const navigationItems =
        document.querySelectorAll("[data-view]");

    navigationItems.forEach((item) => {
        const isActive = item.dataset.view === currentView;

        item.classList.toggle(
            "sidebar-nav__item--active",
            isActive,
        );
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
        notes = notes.filter(
            (note) => !note.deleted,
        );
    }

    if (currentView === "pinned") {
        notes = notes.filter(
            (note) =>
                !note.deleted
                && note.pinned,
        );
    }

    if (currentView === "trash") {
        notes = notes.filter(
            (note) => note.deleted,
        );
    }

    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (normalizedQuery) {
        notes = notes.filter((note) => {
            const title = note.title.toLowerCase();
            const content = getNotePlainText(note).toLowerCase();

            return (
                title.includes(normalizedQuery)
                || content.includes(normalizedQuery)
            );
        });
    }

    notes.sort((a, b) => {
        if (a.pinned !== b.pinned) {
            return Number(b.pinned) - Number(a.pinned);
        }

        return new Date(b.updatedAt)
            - new Date(a.updatedAt);
    });

    if (notes.length === 0) {
        const emptyMessages = {
            all: "No notes yet.",
            pinned: "No pinned notes.",
            trash: "Trash is empty.",
        };

        const message =
            searchQuery.trim()
                ? "No matching notes."
                : emptyMessages[currentView];

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

            <textarea
                id="note-content"
                class="editor-textarea"
                placeholder="Start writing..."
                aria-label="Note content"
                ${isTrashView ? "readonly" : ""}
            ></textarea>
        </div>
    `;

    const titleInput =
        document.querySelector("#note-title");

    const contentInput =
        document.querySelector("#note-content");

    titleInput.value = note.title;
    contentInput.value = note.content;
}

function renderRoute() {
    const routeExists =
        syncStateWithRoute();

    renderNavigation();

    if (!routeExists) {
        renderNotFound();

        return;
    }

    const routeIsValid =
        normalizeSelectedNoteRoute();

    if (!routeIsValid) {
        return;
    }

    renderNoteList();
    renderEditor();
}

function renderNotFound() {
    const noteListTitle =
        document.querySelector("#note-list-title");

    const noteList =
        document.querySelector("#note-list");

    const editorPanel =
        document.querySelector("#editor-panel");

    noteListTitle.textContent =
        "Not Found";

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

    window.addEventListener(
        "hashchange",
        () => {
            renderRoute();
        },
    );

    newNoteButton.addEventListener("click", () => {
        const note = createNote();

        navigate(
            "all",
            note.id,
        );
    });

    sidebarNavigation.addEventListener(
        "click",
        (event) => {
            const navigationItem =
                event.target.closest("[data-view]");

            if (!navigationItem) {
                return;
            }

            navigate(
                navigationItem.dataset.view,
            );
        },
    );

    noteSearch.addEventListener(
        "input",
        (event) => {
            searchQuery = event.target.value;

            if (selectedNoteId) {
                navigate(currentView);
                return;
            }

            renderNoteList();
        },
    );

    noteList.addEventListener("click", (event) => {
        const noteItem = event.target.closest(".note-item");

        if (!noteItem) {
            return;
        }

        navigate(
            currentView,
            noteItem.dataset.noteId,
        );
    });

    editorPanel.addEventListener("input", (event) => {
        if (!selectedNoteId || currentView === "trash") {
            return;
        }

        if (
            event.target.id !== "note-title"
            && event.target.id !== "note-content"
        ) {
            return;
        }

        const titleInput = document.querySelector("#note-title");
        const contentInput = document.querySelector("#note-content");

        updateNote(selectedNoteId, {
            title: titleInput.value,
            content: contentInput.value,
        });

        renderNoteList();
    });

    editorPanel.addEventListener("click", (event) => {
        if (!selectedNoteId) {
            return;
        }

        const pinButton = event.target.closest("#toggle-pin-button");
        const trashButton = event.target.closest("#trash-note-button");
        const restoreButton = event.target.closest("#restore-note-button");
        const deleteButton = event.target.closest("#delete-note-button");

        if (pinButton) {
            const note = getNoteById(selectedNoteId);
            if (!note) {
                return;
            }

            const willBePinned = !note.pinned;

            updateNote(selectedNoteId, {
                pinned: willBePinned,
            });

            if (
                currentView === "pinned"
                && !willBePinned
            ) {
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
        }

        if (deleteButton) {
            const confirmed = window.confirm(
                "Delete this note permanently? This action cannot be undone.",
            );

            if (!confirmed) {
                return;
            }

            deleteNotePermanently(selectedNoteId);

            navigate("trash");
        }
    });
}

init();
