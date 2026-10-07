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

                <button type="button" class="new-note-button">
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

                <div class="note-list">
                    <p class="empty-message">
                        No notes yet.
                    </p>
                </div>
            </section>

            <main class="editor-panel">
                <div class="editor-empty">
                    <p>Select or create a note.</p>
                </div>
            </main>
        </div>
    `;
}

renderApp();
