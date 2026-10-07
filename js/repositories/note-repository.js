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

export function updateNote(id, changes) {
    const notes = readNotes();

    const noteIndex = notes.findIndex(
        (note) => note.id === id,
    );

    if (noteIndex === -1) {
        return null;
    }

    const currentNote = notes[noteIndex];

    const updatedNote = {
        ...currentNote,
        ...changes,

        id: currentNote.id,
        createdAt: currentNote.createdAt,
        updatedAt: new Date().toISOString(),
    };

    notes[noteIndex] = updatedNote;

    writeNotes(notes);

    return updatedNote;
}

export function moveNoteToTrash(id) {
    return updateNote(id, {
        deleted: true,
    });
}

export function restoreNote(id) {
    return updateNote(id, {
        deleted: false,
    });
}

export function deleteNotePermanently(id) {
    const notes = readNotes();

    const filteredNotes = notes.filter(
        (note) => note.id !== id,
    );

    writeNotes(filteredNotes);
}