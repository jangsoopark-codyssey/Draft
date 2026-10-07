import {
    createNote,
    getAllNotes,
} from "./repositories/note-repository.js";

const app = document.querySelector("#app");

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

            <main class="editor-panel">
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
            return `
                <button
                    type="button"
                    class="note-item"
                    data-note-id="${note.id}"
                >
                    <strong>${note.title}</strong>
                </button>
            `;
        })
        .join("");
}

function init() {
    renderApp();
    renderNoteList();

    const newNoteButton =
        document.querySelector("#new-note-button");

    newNoteButton.addEventListener("click", () => {
        createNote();
        renderNoteList();
    });
}

init();
