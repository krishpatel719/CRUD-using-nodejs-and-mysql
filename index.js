const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");
const { randomUUID } = require("crypto");

const app = express();
const PORT = Number(process.env.PORT) || 8080;
const DEFAULT_PAGE_SIZE = 8;
const ALLOWED_SORT_COLUMNS = new Set(["username", "email", "created_at"]);

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "Krish@27",
    database: process.env.DB_NAME || "first_conncetion",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));

// Normalizes page and page-size values coming from query strings.
function sanitizePagination(value, fallback) {
    const parsed = Number.parseInt(value, 10);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// Restricts sorting to a safe allowlist and normalizes direction values.
function getSortOptions(query) {
    const requestedSortBy = String(query.sortBy || "created_at").toLowerCase();
    const requestedSortDir = String(query.sortDir || "desc").toLowerCase();

    return {
        sortBy: ALLOWED_SORT_COLUMNS.has(requestedSortBy) ? requestedSortBy : "created_at",
        sortDir: requestedSortDir === "asc" ? "ASC" : "DESC",
    };
}

// Validates and trims user input before it reaches the database layer.
function normalizeUserInput(body, { isEdit = false } = {}) {
    const username = String(body.username || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const errors = {};

    if (!username) {
        errors.username = "Username is required.";
    } else if (username.length < 3 || username.length > 40) {
        errors.username = "Username must be between 3 and 40 characters.";
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
        errors.email = "Email is required.";
    } else if (!emailPattern.test(email)) {
        errors.email = "Please enter a valid email address.";
    }

    if (!isEdit || password) {
        if (!password) {
            errors.password = "Password is required.";
        } else if (password.length < 6 || password.length > 50) {
            errors.password = "Password must be between 6 and 50 characters.";
        }
    }

    return {
        values: { username, email, password },
        errors,
        isValid: Object.keys(errors).length === 0,
    };
}

// Fetches a single user so routes can reuse the same lookup behavior.
async function ensureUserExists(id) {
    const [rows] = await pool.query(
        "SELECT id, username, email, password, created_at, updated_at FROM user WHERE id = ?",
        [id]
    );
    return rows[0] || null;
}

// Dashboard route that shows the total number of stored user records.
app.get("/", async (req, res, next) => {
    try {
        const [[summary]] = await pool.query(
            "SELECT COUNT(*) AS userCount FROM user"
        );

        res.render("home", {
            title: "User Management Dashboard",
            count: summary.userCount,
        });
    } catch (error) {
        next(error);
    }
});

// Main table page for browsing, searching, and managing users.
app.get("/users", (req, res) => {
    res.render("users/index", {
        title: "User Directory",
        pageSize: DEFAULT_PAGE_SIZE,
    });
});

// Create form route used to render a blank user entry form.
app.get("/users/new", (req, res) => {
    res.render("users/form", {
        title: "Add User",
        formMode: "create",
        user: { username: "", email: "", password: "" },
    });
});

// Edit form route that preloads an existing user for updates.
app.get("/users/:id/edit", async (req, res, next) => {
    try {
        const user = await ensureUserExists(req.params.id);

        if (!user) {
            return res.status(404).render("errors/not-found", {
                title: "User Not Found",
                message: "The user you are trying to edit does not exist.",
            });
        }

        res.render("users/form", {
            title: "Edit User",
            formMode: "edit",
            user: { ...user, password: "" },
        });
    } catch (error) {
        next(error);
    }
});

// Read API that returns paginated, searchable, and sortable user data.
app.get("/api/users", async (req, res, next) => {
    try {
        const page = sanitizePagination(req.query.page, 1);
        const pageSize = sanitizePagination(req.query.pageSize, DEFAULT_PAGE_SIZE);
        const { sortBy, sortDir } = getSortOptions(req.query);
        const search = String(req.query.search || "").trim().toLowerCase();
        const emailDomain = String(req.query.emailDomain || "").trim().toLowerCase();

        const filters = [];
        const params = [];

        if (search) {
            filters.push("(LOWER(username) LIKE ? OR LOWER(email) LIKE ?)");
            params.push(`%${search}%`, `%${search}%`);
        }

        if (emailDomain) {
            filters.push("LOWER(email) LIKE ?");
            params.push(`%@${emailDomain}`);
        }

        const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
        const offset = (page - 1) * pageSize;

        const [rows] = await pool.query(
            `
                SELECT id, username, email, created_at, updated_at
                FROM user
                ${whereClause}
                ORDER BY ${sortBy} ${sortDir}
                LIMIT ? OFFSET ?
            `,
            [...params, pageSize, offset]
        );

        const [[countResult]] = await pool.query(
            `SELECT COUNT(*) AS total FROM user ${whereClause}`,
            params
        );

        res.json({
            data: rows,
            meta: {
                page,
                pageSize,
                total: countResult.total,
                totalPages: Math.max(1, Math.ceil(countResult.total / pageSize)),
                sortBy,
                sortDir: sortDir.toLowerCase(),
                search,
                emailDomain,
            },
        });
    } catch (error) {
        next(error);
    }
});

// Read API for fetching one user record by its id.
app.get("/api/users/:id", async (req, res, next) => {
    try {
        const user = await ensureUserExists(req.params.id);

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        res.json({ data: user });
    } catch (error) {
        next(error);
    }
});

// Create API that validates input, stores the record, and returns the new user.
app.post("/api/users", async (req, res, next) => {
    const validation = normalizeUserInput(req.body);
    if (!validation.isValid) {
        return res.status(400).json({
            message: "Please fix the highlighted errors.",
            errors: validation.errors,
        });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { username, email, password } = validation.values;
        const userId = randomUUID();

        await connection.query(
            `
                INSERT INTO user (id, username, email, password)
                VALUES (?, ?, ?, ?)
            `,
            [userId, username, email, password]
        );

        await connection.commit();

        const createdUser = await ensureUserExists(userId);
        res.status(201).json({
            message: "User created successfully.",
            data: createdUser,
        });
    } catch (error) {
        await connection.rollback();

        if (error && error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                message: "That email address is already in use.",
                errors: { email: "Use a different email address." },
            });
        }

        next(error);
    } finally {
        connection.release();
    }
});

// Update API that edits an existing user and preserves the password if left blank.
app.put("/api/users/:id", async (req, res, next) => {
    const validation = normalizeUserInput(req.body, { isEdit: true });
    if (!validation.isValid) {
        return res.status(400).json({
            message: "Please fix the highlighted errors.",
            errors: validation.errors,
        });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const existingUser = await ensureUserExists(req.params.id);
        if (!existingUser) {
            await connection.rollback();
            return res.status(404).json({ message: "User not found." });
        }

        const { username, email, password } = validation.values;
        const nextPassword = password || existingUser.password;

        await connection.query(
            `
                UPDATE user
                SET username = ?, email = ?, password = ?
                WHERE id = ?
            `,
            [username, email, nextPassword, req.params.id]
        );

        await connection.commit();

        const updatedUser = await ensureUserExists(req.params.id);
        res.json({
            message: "User updated successfully.",
            data: updatedUser,
        });
    } catch (error) {
        await connection.rollback();

        if (error && error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                message: "That email address is already in use.",
                errors: { email: "Use a different email address." },
            });
        }

        next(error);
    } finally {
        connection.release();
    }
});

// Delete API that removes a single user after confirming the record exists.
app.delete("/api/users/:id", async (req, res, next) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const existingUser = await ensureUserExists(req.params.id);
        if (!existingUser) {
            await connection.rollback();
            return res.status(404).json({ message: "User not found." });
        }

        await connection.query("DELETE FROM user WHERE id = ?", [req.params.id]);
        await connection.commit();

        res.json({ message: "User deleted successfully." });
    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
});

// Fallback page route for unknown URLs.
app.use((req, res) => {
    res.status(404).render("errors/not-found", {
        title: "Page Not Found",
        message: "The page you requested could not be found.",
    });
});

// Centralized error handler for both page requests and API requests.
app.use((error, req, res, next) => {
    console.error(error);

    if (req.path.startsWith("/api/")) {
        return res.status(500).json({
            message: "Something went wrong while processing your request.",
        });
    }

    res.status(500).render("errors/not-found", {
        title: "Unexpected Error",
        message: "Something went wrong while loading this page.",
    });
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
