import {
    createNote,
    getAllNotes,
    getNoteById,
    updateNote,
} from "./repositories/note-repository.js";

const app = document.querySelector("#app");
let selectedNoteId = null;

function escapeHtml(value) {
    const element = document.createElement("div");

    element.textContent = value;

    return element.innerHTML;
}

function getNotePreview(content) {
    const normalizedContent = content
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

function renderApp() {
    app.innerHTML = `
        <div class="app-layout">
            <aside class="sidebar">
                <h1 class="logo">Draft</h1>

                <nav class="sidebar-nav">
                    <button type="button">All Notes</button>
                    <button type="button">Pinned</button>
                    <button type="button">Trash</button>
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
                    <h2>Notes</h2>
                </header>

                <div class="note-search">
                    <input
                        type="search"
                        placeholder="Search notes..."
                        aria-label="Search notes"
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

function renderNoteList() {
    const noteList = document.querySelector("#note-list");


    const notes = getAllNotes()
        .filter((note) => !note.deleted);

    if (notes.length === 0) {
        noteList.innerHTML = `
            <p class="empty-message">
                No notes yet.
            </p>
        `;

        return;
    }

    noteList.innerHTML = notes
        .map((note) => {
            const isSelected = note.id === selectedNoteId;
            const displayTitle = note.title.trim() || "Untitled";
            const preview = getNotePreview(note.content);
            const updatedAt = formatUpdatedAt(note.updatedAt);

            return `
                <button
                    type="button"
                    class="note-item ${isSelected ? "note-item--selected" : ""}"
                    data-note-id="${note.id}"
                >
                    <div class="note-item__header">
                        <strong>${escapeHtml(displayTitle)}</strong>
                        <span class="note-item__time">${escapeHtml(updatedAt)}</span>
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

    editorPanel.innerHTML = `
        <div class="editor-content">
            <header class="editor-header">
                <input
                    id="note-title"
                    class="editor-title"
                    type="text"
                    aria-label="Note title"
                >
            </header>

            <textarea
                id="note-content"
                class="editor-textarea"
                aria-label="Note content"
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

function init() {
    renderApp();
    renderNoteList();
    renderEditor();

    const newNoteButton = document.querySelector("#new-note-button");

    const noteList = document.querySelector("#note-list");

    const editorPanel = document.querySelector("#editor-panel");

    newNoteButton.addEventListener("click", () => {
        const note = createNote();

        selectedNoteId = note.id;

        renderNoteList();
        renderEditor();
    });

    noteList.addEventListener("click", (event) => {
        const noteItem = event.target.closest(".note-item");

        if (!noteItem) {
            return;
        }

        selectedNoteId =
            noteItem.dataset.noteId;

        renderNoteList();
        renderEditor();
    });

    editorPanel.addEventListener("input", (event) => {
        if (!selectedNoteId) {
            return;
        }

        if (
            event.target.id !== "note-title"
            && event.target.id !== "note-content"
        ) {
            return;
        }

        const titleInput =
            document.querySelector("#note-title");

        const contentInput =
            document.querySelector("#note-content");

        updateNote(selectedNoteId, {
            title: titleInput.value,
            content: contentInput.value,
        });

        renderNoteList();
    });
}

init();
