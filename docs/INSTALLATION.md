# TranscriptHub Installation Guide

This guide describes how to install TranscriptHub from source. The system has three moving parts:

- Go frontend in `apps/frontend`.
- Node.js backend in `apps/backend`.
- Python WhisperX runtime used by the backend.

The backend also requires Microsoft SQL Server.

## Prerequisites

Install these before setup:

- Git
- Go 1.24 or newer
- Node.js 20 or newer
- npm
- Python environment suitable for WhisperX
- ffmpeg and ffprobe
- Microsoft SQL Server
- A Hugging Face token if speaker diarization or gated models require it

Optional but recommended:

- CUDA-capable GPU and compatible PyTorch stack for production transcription.
- OpenSSL for local self-signed certificates.

## Repository

```bash
git clone https://github.com/AS-AIGC/TranscriptHub.git
cd TranscriptHub
```

## Backend Setup

Go to the backend directory:

```bash
cd apps/backend
```

Install Node dependencies:

```bash
npm install
```

Create backend environment file:

```bash
cp .env.example .env
```

Edit `.env`. At minimum, configure:

- `TASK_HOME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_SERVER`
- `DB_PORT`
- `DB_NAME`
- `TASK_SERVER`
- `TASK_SERVER_PORT`
- `DOWNLOAD_SERVER`
- `DOWNLOAD_SERVER_PORT`
- `NOTIFY_SERVER`
- `NOTIFY_SERVER_PORT`
- `PYTHON_BIN`
- `HF_TOKEN`

Create Python script config:

```bash
cp scripts/config.json.example scripts/config.json
```

Edit `scripts/config.json`. Set:

- `as_dir_path`: backend upload directory.
- `aslc_dir_path`: backend mono-audio directory.
- `tr_dir_path`: backend transcription output directory.
- `log_path`: backend log directory.
- model/device parameters.

The path values should usually point inside `TASK_HOME`, for example:

```json
{
  "as_dir_path": "/absolute/path/to/TranscriptHub/apps/backend/upload",
  "aslc_dir_path": "/absolute/path/to/TranscriptHub/apps/backend/uploadlc",
  "tr_dir_path": "/absolute/path/to/TranscriptHub/apps/backend/transcribe",
  "log_path": "/absolute/path/to/TranscriptHub/apps/backend/log"
}
```

Install Python dependencies. The repository has two requirements files:

```bash
python -m pip install -r requirements.txt
python -m pip install -r scripts/requirements.txt
```

Depending on the environment, WhisperX, PyTorch, CUDA, and CKIP packages may require manual installation steps. Verify the chosen Python environment can import the runtime libraries:

```bash
python -c "import whisperx, torch, ffmpeg; print('python runtime ok')"
```

Create backend certificates if they do not exist. The backend reads these from `TASK_HOME`:

```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out certificate.pem -days 365 -nodes
```

Initialize or migrate the database:

```bash
npm run db:migrate
```

Start the backend:

```bash
./run.sh start
```

For Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-windows.ps1
```

Basic backend health check:

```bash
curl -k https://localhost:3000/
```

If `TASK_SERVER_PORT_HTTP` is set in development mode, an HTTP health check may also be available:

```bash
curl http://localhost:3001/
```

## Frontend Setup

Go to the frontend directory:

```bash
cd ../frontend
```

Install Go dependencies:

```bash
go mod download
```

Create frontend environment file:

```bash
cp envfile.example envfile
```

Edit `envfile`. At minimum, configure:

- `PORT`
- `DocumentRoot`
- `TemplateRoot`
- `UploadFolder`
- `JobsFile`
- `TranslateEndpoint`
- `TranslateUrl`
- `TranslateQueryUrl`
- `DownloadServer`
- `MaxUploadSize`

Make sure frontend backend URLs match the backend server:

```text
TranslateEndpoint=https://localhost:3000/api/v1/rest/
TranslateUrl=https://localhost:3000/api/v1/rest/CreateTranscribeTask
TranslateQueryUrl=https://localhost:3000/api/v1/rest/ViewAllTask
DownloadServer=https://localhost:3000/api/v1/rest/RetrieveTranscribe/
```

Run the frontend:

```bash
go run *.go
```

Or build and run:

```bash
make build
make run
```

Open the frontend in a browser:

```text
https://localhost/
```

The default port comes from `envfile`. If `PORT=80`, use `http://localhost/` or the mapped Docker port depending on how it was started.

## Minimal End-To-End Check

1. Confirm MSSQL is reachable.
2. Run backend migration.
3. Start backend.
4. Check backend `/` health endpoint.
5. Start frontend.
6. Open `/homepage`.
7. Upload a small supported audio file.
8. Wait for the task to complete.
9. Download TXT output.

## Common Installation Problems

### Backend fails at startup with missing environment variables

Check `.env` and confirm `TASK_HOME` and `PYTHON_BIN` are set.

### Backend fails reading certificate files

Create `key.pem` and `certificate.pem` inside `TASK_HOME`.

### Database connection fails

Check:

- SQL Server is running.
- `DB_SERVER`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`.
- The SQL Server allows TCP connections.
- The configured user has schema creation privileges for migration.

### Python script fails importing WhisperX

Use the exact Python binary configured in `PYTHON_BIN`:

```bash
/path/to/python -c "import whisperx; print('ok')"
```

### ffprobe or ffmpeg errors

Install ffmpeg and ensure both commands are on `PATH`:

```bash
ffmpeg -version
ffprobe -version
```

### Frontend upload succeeds locally but backend never receives the task

Check frontend `TranslateUrl` and backend HTTPS certificate behavior. The frontend currently disables TLS verification for backend requests, but the host and port must still be correct.

### Task finishes in backend but frontend does not update

Check backend `.env`:

- `NOTIFY_SERVER`
- `NOTIFY_SERVER_PORT`

The backend sends completion callbacks to `/jobdone` on the frontend server.
