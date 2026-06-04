# DataFlow Admin — Node + MySQL CRUD Dashboard

A modern, full-stack user management dashboard built with **Express 5**, **EJS**, and **MySQL**. Features a responsive glassmorphic UI, RESTful CRUD APIs, server-side validation, searchable and sortable paginated tables, toast notifications, and confirmation dialogs.

---

## ✨ Features

- **Dashboard** — Landing page with live user count pulled from MySQL.
- **User Table** — Browse all records with real-time search, email domain filtering, column sorting, and pagination.
- **Create & Edit Forms** — Validated on both client and server; edit mode preserves the current password when left blank.
- **Delete Confirmation** — Native `<dialog>` modal prevents accidental deletions.
- **Toast Notifications** — Success and error feedback with auto-dismiss.
- **Responsive Design** — Glassmorphic cards, smooth animations, and a mobile-friendly layout.
- **XSS Protection** — All user-generated content is HTML-escaped before rendering.

---

## 🛠 Tech Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Runtime    | Node.js 18+                         |
| Framework  | Express 5.2                         |
| Templating | EJS 6                               |
| Database   | MySQL 8 (via `mysql2` promise API)  |
| IDs        | UUIDs (`crypto.randomUUID`)         |
| Styling    | Vanilla CSS with CSS custom props   |

---

## 📁 Project Structure

```
node-with-sql/
├── index.js                  # Express server, API routes, validation
├── schema.sql                # Database and table creation script
├── package.json
│
├── views/
│   ├── home.ejs              # Dashboard landing page
│   ├── partials/
│   │   ├── head.ejs          # Shared HTML head, nav, toast container
│   │   └── footer.ejs        # Shared scripts and closing tags
│   ├── users/
│   │   ├── index.ejs         # User table with filters and pagination
│   │   └── form.ejs          # Create / Edit user form
│   └── errors/
│       └── not-found.ejs     # 404 and generic error page
│
└── public/
    ├── css/
    │   └── app.css           # Full design system and responsive styles
    └── js/
        ├── shared.js         # Toast notifications and flash message reader
        ├── users-table.js    # Table fetch, render, sort, search, delete
        └── user-form.js      # Form submission via REST API
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **MySQL** 8 running locally (or remotely)

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd node-with-sql
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up the Database

Open a MySQL client and run the schema script:

```sql
SOURCE schema.sql;
```

Or paste the contents of [`schema.sql`](./schema.sql) into your MySQL workbench / terminal. This creates the `first_conncetion` database and the `user` table with the correct columns and constraints.

### 4. Configure Environment (Optional)

The app uses sensible defaults for local development. Override them with environment variables if needed:

| Variable      | Default            | Description             |
| ------------- | ------------------ | ----------------------- |
| `PORT`        | `8080`             | Server listening port   |
| `DB_HOST`     | `localhost`        | MySQL host              |
| `DB_USER`     | `root`             | MySQL user              |
| `DB_PASSWORD` | `Krish@27`         | MySQL password          |
| `DB_NAME`     | `first_conncetion` | MySQL database name     |

**PowerShell:**

```powershell
$env:DB_PASSWORD="your_password"
```

**Bash:**

```bash
export DB_PASSWORD="your_password"
```

### 5. Start the Server

```bash
npm start
```

Open **http://localhost:8080** in your browser.

---

## 📡 API Reference

All API endpoints return JSON and accept `application/json` request bodies.

### List Users

```
GET /api/users
```

| Query Param   | Type   | Default      | Description                          |
| ------------- | ------ | ------------ | ------------------------------------ |
| `page`        | number | `1`          | Current page number                  |
| `pageSize`    | number | `8`          | Records per page                     |
| `sortBy`      | string | `created_at` | Column to sort (`username`, `email`, `created_at`) |
| `sortDir`     | string | `desc`       | Sort direction (`asc` or `desc`)     |
| `search`      | string | —            | Filter by username or email          |
| `emailDomain` | string | —            | Filter by email domain (e.g. `gmail.com`) |

**Response `200`:**

```json
{
  "data": [ { "id": "...", "username": "...", "email": "...", "created_at": "...", "updated_at": "..." } ],
  "meta": { "page": 1, "pageSize": 8, "total": 42, "totalPages": 6, "sortBy": "created_at", "sortDir": "desc" }
}
```

---

### Get Single User

```
GET /api/users/:id
```

**Response `200`:** `{ "data": { ... } }`
**Response `404`:** `{ "message": "User not found." }`

---

### Create User

```
POST /api/users
```

```json
{ "username": "janedoe", "email": "jane@example.com", "password": "secret123" }
```

| Field      | Rules                              |
| ---------- | ---------------------------------- |
| `username` | Required, 3–40 characters          |
| `email`    | Required, valid format, unique     |
| `password` | Required, 6–50 characters          |

**Response `201`:** `{ "message": "User created successfully.", "data": { ... } }`
**Response `400`:** `{ "message": "Please fix the highlighted errors.", "errors": { ... } }`
**Response `409`:** `{ "message": "That email address is already in use." }`

---

### Update User

```
PUT /api/users/:id
```

```json
{ "username": "janedoe_updated", "email": "jane@example.com", "password": "" }
```

> Leave `password` blank to keep the current value.

**Response `200`:** `{ "message": "User updated successfully.", "data": { ... } }`

---

### Delete User

```
DELETE /api/users/:id
```

**Response `200`:** `{ "message": "User deleted successfully." }`
**Response `404`:** `{ "message": "User not found." }`

---

## 🖥 Page Routes

| Route               | Description                 |
| -------------------- | --------------------------- |
| `GET /`              | Dashboard with user count   |
| `GET /users`         | Searchable user table       |
| `GET /users/new`     | Create user form            |
| `GET /users/:id/edit`| Edit user form              |

---

## 🔒 Security Notes

- **XSS Protection** — User-generated content is escaped via `escapeHtml()` before being inserted into the DOM.
- **SQL Injection** — All queries use parameterized placeholders (`?`), never string concatenation.
- **Input Validation** — Both backend and frontend validate username length, email format, and password requirements.
- **Sort Column Allow-List** — Only `username`, `email`, and `created_at` are accepted as sort columns to prevent SQL injection via `ORDER BY`.

> ⚠️ **Passwords are stored in plain text.** This is a learning project. In production, always hash passwords with a library like `bcrypt` before saving.

---

## 🐛 Troubleshooting

| Problem | Cause | Fix |
| ------- | ----- | --- |
| `ER_BAD_FIELD_ERROR: Unknown column 'created_at'` | The `user` table is missing `created_at` / `updated_at` columns | Drop and recreate the table using `schema.sql` |
| `ECONNREFUSED 127.0.0.1:3306` | MySQL is not running | Start your MySQL service |
| `ER_ACCESS_DENIED_ERROR` | Wrong MySQL credentials | Set `DB_USER` and `DB_PASSWORD` environment variables |
| `EADDRINUSE :::8080` | Port 8080 is already in use | Kill the other process or set `PORT` to a different value |
| Toast notifications not appearing | `shared.js` not loaded before page scripts | Ensure the footer partial is included **before** page-specific `<script>` tags |

---

## 📝 License

ISC
