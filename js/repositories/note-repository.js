const STORAGE_KEY = "draft.notes";

function readNotes() {
    const storedNotes = localStorage.getItem(STORAGE_KEY);

    if (!storedNotes) {
        return [];
    }

    try {
        return JSON.parse(storedNotes);
    } catch (error) {
        console.error("Failed to read notes from LocalStorage.", error);
        return [];
    }
}

function writeNotes(notes) {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(notes),
    );
}

export function getAllNotes() {
    return readNotes();
}

export function createNote() {
    const notes = readNotes();

    const now = new Date().toISOString();

    const note = {
        id: crypto.randomUUID(),
        title: "Untitled",
        content: "",
        mode: "plain",
        pinned: false,
        deleted: false,
        createdAt: now,
        updatedAt: now,
    };

    notes.push(note);

    writeNotes(notes);

    return note;
}

export function getNoteById(id) {
    const notes = readNotes();

    return notes.find((note) => note.id === id) ?? null;
}

