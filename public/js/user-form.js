// Prints backend validation messages beside their matching form fields.
function setFieldErrors(errors = {}) {
    document.querySelectorAll("[data-field-error]").forEach((node) => {
        node.textContent = "";
    });

    Object.entries(errors).forEach(([field, message]) => {
        const target = document.querySelector(`[data-field-error="${field}"]`);
        if (target) {
            target.textContent = message;
        }
    });
}

// Disables the submit button and swaps its label during saves.
function setSubmitting(isSubmitting) {
    const button = document.querySelector("[data-submit-button]");
    if (!button) {
        return;
    }

    button.disabled = isSubmitting;
    button.textContent = isSubmitting ? "Saving..." : button.dataset.defaultLabel;
}

// Handles create and edit form submission through the REST API.
document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("[data-user-form]");
    if (!form) {
        return;
    }

    const mode = form.dataset.mode;
    const userId = form.dataset.userId;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        setFieldErrors({});
        setSubmitting(true);

        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());
        const endpoint = mode === "edit" ? `/api/users/${userId}` : "/api/users";
        const method = mode === "edit" ? "PUT" : "POST";

        try {
            const response = await fetch(endpoint, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const result = await response.json();

            if (!response.ok) {
                setFieldErrors(result.errors || {});
                throw new Error(result.message || "Unable to save user.");
            }

            const message = encodeURIComponent(result.message || "Saved successfully.");
            window.location.href = `/users?message=${message}&type=success`;
        } catch (error) {
            showToast(error.message, "error");
        } finally {
            setSubmitting(false);
        }
    });
});
