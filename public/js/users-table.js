// Escapes HTML special characters to prevent XSS when inserting into innerHTML.
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
}

// Holds the current UI state for filters, sorting, pagination, and deletion.
const state = {
    page: 1,
    pageSize: Number(document.body.dataset.pageSize || 8),
    search: "",
    emailDomain: "",
    sortBy: "created_at",
    sortDir: "desc",
    pendingDeleteId: null,
};

// Collects frequently used DOM nodes once so table logic stays easier to read.
const elements = {
    body: document.querySelector("[data-users-body]"),
    loading: document.querySelector("[data-loading]"),
    pageInfo: document.querySelector("[data-page-info]"),
    totalInfo: document.querySelector("[data-total-info]"),
    emptyState: document.querySelector("[data-empty-state]"),
    searchInput: document.querySelector("[data-search-input]"),
    domainInput: document.querySelector("[data-domain-input]"),
    pageSizeSelect: document.querySelector("[data-page-size]"),
    prevButton: document.querySelector("[data-prev-page]"),
    nextButton: document.querySelector("[data-next-page]"),
    deleteDialog: document.querySelector("[data-delete-dialog]"),
    confirmDelete: document.querySelector("[data-confirm-delete]"),
    cancelDelete: document.querySelector("[data-cancel-delete]"),
};

// Keeps the password column informative without exposing stored values in the UI.
function maskPassword() {
    return "Hidden";
}

// Toggles the loading overlay while API requests are running.
function setLoading(isLoading) {
    if (elements.loading) {
        elements.loading.classList.toggle("is-visible", isLoading);
    }
}

// Builds the current query string from the active table controls.
function buildQueryString() {
    const params = new URLSearchParams({
        page: String(state.page),
        pageSize: String(state.pageSize),
        sortBy: state.sortBy,
        sortDir: state.sortDir,
    });

    if (state.search) {
        params.set("search", state.search);
    }

    if (state.emailDomain) {
        params.set("emailDomain", state.emailDomain);
    }

    return params.toString();
}

// Renders table rows from API data or reveals the empty state when needed.
function renderRows(users) {
    if (!elements.body || !elements.emptyState) {
        return;
    }

    if (!users.length) {
        elements.body.innerHTML = "";
        elements.emptyState.hidden = false;
        return;
    }

    elements.emptyState.hidden = true;
    elements.body.innerHTML = users
        .map(
            (user) => `
                <tr>
                    <td>${escapeHtml(user.username)}</td>
                    <td>${escapeHtml(user.email)}</td>
                    <td>${maskPassword()}</td>
                    <td>${new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                        <div class="table-actions">
                            <a class="button-secondary" href="/users/${encodeURIComponent(user.id)}/edit">Edit</a>
                            <button class="button-danger" type="button" data-delete-id="${escapeHtml(user.id)}">Delete</button>
                        </div>
                    </td>
                </tr>
            `
        )
        .join("");
}

// Updates pagination and total-result labels after each API response.
function updateMeta(meta) {
    if (elements.pageInfo) {
        elements.pageInfo.textContent = `Page ${meta.page} of ${meta.totalPages}`;
    }

    if (elements.totalInfo) {
        elements.totalInfo.textContent = `${meta.total} record${meta.total === 1 ? "" : "s"} found`;
    }

    if (elements.prevButton) {
        elements.prevButton.disabled = meta.page <= 1;
    }

    if (elements.nextButton) {
        elements.nextButton.disabled = meta.page >= meta.totalPages;
    }
}

// Fetches user rows from the API and refreshes the table view.
async function loadUsers() {
    setLoading(true);

    try {
        const response = await fetch(`/api/users?${buildQueryString()}`);
        const payload = await response.json();

        if (!response.ok) {
            throw new Error(payload.message || "Failed to load users.");
        }

        renderRows(payload.data);
        updateMeta(payload.meta);
    } catch (error) {
        renderRows([]);
        updateMeta({ page: 1, totalPages: 1, total: 0 });
        showToast(error.message, "error");
    } finally {
        setLoading(false);
    }
}

let searchTimer;

// Switches active sort column or direction before reloading the table.
function updateSorting(button) {
    const nextSortBy = button.dataset.sortBy;

    if (state.sortBy === nextSortBy) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
    } else {
        state.sortBy = nextSortBy;
        state.sortDir = "asc";
    }

    state.page = 1;
    loadUsers();
}

// Opens a confirmation dialog before deleting a user record.
function openDeleteDialog(id) {
    state.pendingDeleteId = id;

    if (elements.deleteDialog?.showModal) {
        elements.deleteDialog.showModal();
        return;
    }

    if (window.confirm("Delete this user? This action cannot be undone.")) {
        handleDelete();
    }
}

// Sends the delete request to the backend and refreshes the table afterward.
async function handleDelete() {
    if (!state.pendingDeleteId) {
        return;
    }

    try {
        const response = await fetch(`/api/users/${state.pendingDeleteId}`, {
            method: "DELETE",
        });
        const payload = await response.json();

        if (!response.ok) {
            throw new Error(payload.message || "Failed to delete user.");
        }

        showToast(payload.message || "User deleted successfully.");
        state.pendingDeleteId = null;

        if (elements.deleteDialog?.open) {
            elements.deleteDialog.close();
        }

        loadUsers();
    } catch (error) {
        showToast(error.message, "error");
    }
}

// Wires up table filters, sorting, pagination, and delete actions.
document.addEventListener("DOMContentLoaded", () => {
    loadUsers();

    document.querySelectorAll("[data-sort-by]").forEach((button) => {
        button.addEventListener("click", () => updateSorting(button));
    });

    elements.searchInput?.addEventListener("input", (event) => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => {
            state.search = event.target.value.trim();
            state.page = 1;
            loadUsers();
        }, 250);
    });

    let domainTimer;
    elements.domainInput?.addEventListener("input", (event) => {
        window.clearTimeout(domainTimer);
        domainTimer = window.setTimeout(() => {
            state.emailDomain = event.target.value.trim().toLowerCase();
            state.page = 1;
            loadUsers();
        }, 250);
    });

    elements.pageSizeSelect?.addEventListener("change", (event) => {
        state.pageSize = Number(event.target.value);
        state.page = 1;
        loadUsers();
    });

    elements.prevButton?.addEventListener("click", () => {
        if (state.page > 1) {
            state.page -= 1;
            loadUsers();
        }
    });

    elements.nextButton?.addEventListener("click", () => {
        state.page += 1;
        loadUsers();
    });

    elements.body?.addEventListener("click", (event) => {
        const deleteButton = event.target.closest("[data-delete-id]");
        if (deleteButton) {
            openDeleteDialog(deleteButton.dataset.deleteId);
        }
    });

    elements.confirmDelete?.addEventListener("click", handleDelete);
    elements.cancelDelete?.addEventListener("click", () => {
        state.pendingDeleteId = null;
        elements.deleteDialog?.close();
    });
});
