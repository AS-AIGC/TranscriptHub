# AGENTS.md

This file guides AI agents and maintainers working on TranscriptHub.

Before making changes, read:

1. `docs/PROJECT_OVERVIEW.md`
2. `docs/CONFIGURATION.md`
3. The specific source files involved in the task

For installation tasks, also read:

1. `docs/INSTALLATION.md`
2. `apps/backend/.env.example`
3. `apps/frontend/envfile.example`
4. `apps/backend/scripts/config.json.example`

## Repository Shape

- `apps/frontend`: Go frontend and templates.
- `apps/backend`: Node.js backend API, DB code, worker scheduler.
- `apps/backend/scripts`: Python WhisperX scripts and DB migration helper.
- `apps/backend/sql`: raw MSSQL schema files.
- `docs`: human and AI-facing project documentation.

## Important Runtime Contracts

### Frontend To Backend

The frontend sends uploads to:

```text
POST /api/v1/rest/CreateTranscribeTask
```

Multipart fields:

- `audiofile`
- `label`
- `sso_account`
- `token`
- `multiplespeaker`

### Backend To Frontend

The backend sends completion notifications to:

```text
POST /jobdone
```

Payload fields:

- `task_objid`
- `status`
- `message`
- `results`

### Result Downloads

Backend routes:

```text
GET /api/v1/rest/RetrieveTranscribe/TXT/:filename
GET /api/v1/rest/RetrieveTranscribe/SRT/:filename
GET /api/v1/rest/RetrieveTranscribe/VTT/:filename
GET /api/v1/rest/RetrieveTranscribe/TSV/:filename
GET /api/v1/rest/RetrieveTranscribe/JSON/:filename
```

Frontend route:

```text
/result/{taskID}/{fileType}
```

## Safety Rules

- Do not commit real `.env`, `envfile`, or `scripts/config.json` secrets.
- Do not commit private keys or certificates.
- Do not remove user data under `upload`, `uploadlc`, `transcribe`, `tmp`, or `log` unless explicitly asked.
- Do not change task statuses without checking frontend, backend constants, DB queries, and templates.
- Do not assume authentication is production-ready. `apps/frontend/userinf.go` currently uses placeholder user data.
- Preserve path traversal protections in backend download and media utilities.
- Be careful with SQL changes. The target database is MSSQL.

## Development Workflow

When changing frontend Go code:

```bash
cd apps/frontend
gofmt -w .
go test ./...
```

When changing backend Node.js code:

```bash
cd apps/backend
npm install
npm audit
node --check main.js
node --check controller/task_controller.js
node --check services/task_service.js
node --check config.js
```

When changing Python transcription code:

```bash
cd apps/backend
python -m py_compile scripts/exec_whisperx_task_v1.2.py
```

If the local machine lacks Go, Python packages, MSSQL, ffmpeg, or CUDA, report that clearly instead of pretending the full workflow passed.

## Installation Assistance Workflow

When helping a user install TranscriptHub:

1. Identify OS and install target path.
2. Check prerequisites: Go, Node, npm, Python, ffmpeg, ffprobe, MSSQL.
3. Clone the repository.
4. Configure backend `.env`.
5. Configure `scripts/config.json`.
6. Install Node dependencies.
7. Install Python dependencies.
8. Create backend certificates.
9. Run `npm run db:migrate`.
10. Start backend.
11. Configure frontend `envfile`.
12. Start frontend.
13. Run a minimal upload/download test.

When blocked, provide a concrete missing item and the exact command that failed.

## Common High-Risk Areas

- Task status mapping across DB, backend notification, and frontend UI.
- File path construction for uploads and downloads.
- Worker cleanup logic in clustered backend execution.
- Python environment and GPU/CUDA compatibility.
- MSSQL migration behavior.
- Callback connectivity from backend to frontend.

## Known Issues To Consider

- Frontend docs and root README mention different Go versions; `apps/frontend/go.mod` currently requires Go 1.24.
- Backend `VIEW_ALL_TASK` query selects `DURZATION`, which appears inconsistent with the `DURATION` column in schema.
- Frontend `Download` checks for status `done`, while job updates use `Done`.
- Backend upload filtering currently accepts all MIME types.
- Some local development paths disable TLS verification.
- `scripts/config.json.example` contains comments and is not strict JSON until cleaned.

## Documentation Expectations

When adding or changing behavior, update documentation if any of these change:

- Required environment variables.
- Public API behavior.
- Task status values.
- Database schema.
- Installation steps.
- Python runtime dependencies.
- Directory layout or generated files.

Prefer precise examples over prose-only explanations.
