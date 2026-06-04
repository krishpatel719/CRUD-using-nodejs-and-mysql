// Creates a temporary toast notification for success or error feedback.
function showToast(message, type = "success") {
    const stack = document.querySelector("[data-toast-stack]");
    if (!stack || !message) {
        return;
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    stack.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, 3500);
}

// Reads flash-style messages from the query string and shows them once.
function readFlashFromQuery() {
    const url = new URL(window.location.href);
    const message = url.searchParams.get("message");
    const type = url.searchParams.get("type") || "success";

    if (message) {
        showToast(message, type);
        url.searchParams.delete("message");
        url.searchParams.delete("type");
        window.history.replaceState({}, "", url);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    readFlashFromQuery();
});
