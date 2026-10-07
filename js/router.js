const VIEW_PATHS = {
    all: "notes",
    pinned: "pinned",
    trash: "trash",
};

const PATH_VIEWS = {
    notes: "all",
    pinned: "pinned",
    trash: "trash",
};

export function getCurrentRoute() {
    const path = window.location.hash
        .replace(/^#/, "")
        .replace(/^\/+/, "");

    const segments = path
        .split("/")
        .filter(Boolean);

    if (segments.length === 0) {
        return {
            view: "all",
            noteId: null,
            notFound: false,
        };
    }

    if (segments.length > 2) {
        return {
            view: null,
            noteId: null,
            notFound: true,
        };
    }

    const view = PATH_VIEWS[segments[0]];

    if (!view) {
        return {
            view: null,
            noteId: null,
            notFound: true,
        };
    }

    return {
        view,
        noteId: segments[1]
            ? decodeURIComponent(segments[1])
            : null,
        notFound: false,
    };
}

export function navigate(view, noteId = null) {
    const path = VIEW_PATHS[view];

    if (!path) {
        return;
    }

    const hash = noteId
        ? `#/${path}/${encodeURIComponent(noteId)}`
        : `#/${path}`;

    window.location.hash = hash;
}

export function ensureDefaultRoute() {
    if (window.location.hash) {
        return;
    }

    window.history.replaceState(
        null,
        "",
        `${window.location.pathname}#/notes`,
    );
}