# TranscriptHub Configuration Reference

TranscriptHub uses three configuration files:

- Frontend: `apps/frontend/envfile`
- Backend: `apps/backend/.env`
- WhisperX script: `apps/backend/scripts/config.json`

These files must agree on hosts, ports, and filesystem paths.

Do not commit real secrets, machine-specific paths, Hugging Face tokens, database passwords, or private certificates.

## Frontend `envfile`

Template:

- `apps/frontend/envfile.example`

Used by:

- `apps/frontend/server.go`
- frontend upload/download/job handling code.

| Variable | Required | Meaning |
| --- | --- | --- |
| `SystemName` | No | Display/system identifier. |
| `PORT` | Yes | Frontend listen port. Defaults to `80` if empty in code. |
| `ContainerName` | No | Docker container name used by makefile. |
| `OriginAllowList` | No | Intended CORS/origin allow list. |
| `AllowMethods` | No | Intended HTTP method allow list. |
| `ResponseType` | No | SSO/OAuth-style response type placeholder. |
| `DocumentRoot` | Yes | Static file root. Usually `www/html`. |
| `TemplateRoot` | Yes | Template root. Usually `www/template/`. Must include trailing slash for current code. |
| `UploadFolder` | Yes | Local frontend upload/job storage directory. Usually `tmp/`. Must include trailing slash for current code. |
| `JobsFile` | Yes | Local job JSON filename. Usually `joblists`. |
| `mailHost` | No | SMTP host for notification email. |
| `smtpPort` | No | SMTP port. |
| `smtpEmail` | No | SMTP sender/account. |
| `smtpPassword` | No | SMTP password. Do not commit real values. |
| `TranslateEndpoint` | Yes | Backend API base URL ending in `/api/v1/rest/`. |
| `TranslateUrl` | Yes | Backend `CreateTranscribeTask` URL. |
| `TranslateQueryUrl` | No | Backend `ViewAllTask` URL. |
| `DownloadServer` | Yes | Backend result download base URL ending in `/RetrieveTranscribe/`. |
| `Scope` | No | SSO placeholder. |
| `TokenUrl` | No | SSO token URL placeholder. |
| `UserUrl` | No | SSO user-info URL placeholder. |
| `JwtKey` | No | JWT placeholder. Do not commit production values. |
| `MaxUploadSize` | Yes | Max upload size in MiB. |
| `NGROK_AUTHTOKEN` | No | Local tunnel token if used. |
| `RAGUrl` | No | Placeholder for future integration. |

Important current behavior:

- `GetUserInfoViaBearer` in `userinf.go` returns hard-coded user info.
- `UploadFolder + "files/"` must exist before uploads.
- `UploadFolder + JobsFile` must be readable at startup if no in-memory job list exists.

## Backend `.env`

Template:

- `apps/backend/.env.example`

Used by:

- `apps/backend/config.js`
- `apps/backend/db.js`
- `apps/backend/main.js`
- Python scripts through inherited environment.

| Variable | Required | Meaning |
| --- | --- | --- |
| `NODE_ENV` | No | `development`, `production`, or `test`. Defaults to `development`. |
| `TASK_HOME` | Yes | Absolute backend runtime root. Used to create upload, uploadlc, transcribe, log, certificate paths. |
| `NODE_DB` | No | Database type flag. Current implementation targets `mssql`. |
| `DB_USER` | Yes | MSSQL username. |
| `DB_PASSWORD` | Yes | MSSQL password. |
| `DB_SERVER` | Yes | MSSQL host. |
| `DB_PORT` | Yes | MSSQL TCP port, usually `1433`. |
| `DB_NAME` | Yes | Database name, often `AI_AP`. |
| `TASK_SERVER` | Yes | Backend host advertised/listened for task service. |
| `TASK_SERVER_PORT` | Yes | Backend HTTPS port. |
| `TASK_SERVER_PORT_HTTP` | No | Development HTTP port. |
| `DOWNLOAD_SERVER` | Yes | Host used when generating result URLs. |
| `DOWNLOAD_SERVER_PORT` | Yes | Port used when generating result URLs. |
| `NOTIFY_SERVER` | Yes | Frontend host for completion callback. |
| `NOTIFY_SERVER_PORT` | Yes | Frontend port for completion callback. |
| `HF_TOKEN` | Sometimes | Hugging Face token used by diarization/gated models. |
| `PYTHON_HOME` | No | Human reference to Python environment path. |
| `PYTHON_BIN` | Yes | Absolute Python executable path used to spawn WhisperX script. |
| `WHISPERX_CONFIG_PATH` | No | Override path for Python script config. Absolute or relative to `TASK_HOME`. |

Runtime directories created by `config.js`:

- `${TASK_HOME}/upload`
- `${TASK_HOME}/uploadlc`
- `${TASK_HOME}/transcribe/txt`
- `${TASK_HOME}/transcribe/srt`
- `${TASK_HOME}/transcribe/vtt`
- `${TASK_HOME}/transcribe/tsv`
- `${TASK_HOME}/transcribe/json`
- `${TASK_HOME}/log`

Certificate paths:

- `${TASK_HOME}/key.pem`
- `${TASK_HOME}/certificate.pem`

## WhisperX `scripts/config.json`

Template:

- `apps/backend/scripts/config.json.example`

Used by:

- `apps/backend/scripts/exec_whisperx_task_v1.2.py`

The template contains JSON-style comments, so it may need cleanup before strict JSON parsing. The runtime file must be valid JSON.

| Field | Required | Meaning |
| --- | --- | --- |
| `device` | Yes | `cuda` or `cpu`. Script falls back based on CUDA availability in some paths. |
| `compute_type` | Yes | WhisperX compute type, for example `float16`, `int8`, `float32`. |
| `model_size` | Yes | Whisper model size, for example `large-v3`, `medium`, `small`. |
| `as_dir_path` | Yes | Source audio directory. Should match backend upload directory. |
| `aslc_dir_path` | Yes | Mono converted audio directory. Should match backend uploadlc directory. |
| `tr_dir_path` | Yes | Transcription output parent directory. |
| `log_path` | Yes | Python transcription log directory. |
| `batch_size` | Yes | WhisperX batch size. Reduce for low GPU memory. |
| `chunk_size` | Yes | Audio chunk size in seconds. |
| `print_progress` | Yes | Whether WhisperX prints progress. |
| `return_char_alignments` | Yes | Whether to return character-level alignment. |
| `min_speaker` | No | Minimum speaker count for diarization. Currently loaded but not passed deeply in all code paths. |
| `max_speaker` | No | Maximum speaker count for diarization. Currently loaded but not passed deeply in all code paths. |

Path consistency example:

```text
TASK_HOME=/srv/TranscriptHub/apps/backend

config.json:
  as_dir_path=/srv/TranscriptHub/apps/backend/upload
  aslc_dir_path=/srv/TranscriptHub/apps/backend/uploadlc
  tr_dir_path=/srv/TranscriptHub/apps/backend/transcribe
  log_path=/srv/TranscriptHub/apps/backend/log
```

## Backend API Path Settings

Frontend should point to backend:

```text
TranslateEndpoint=https://BACKEND_HOST:BACKEND_PORT/api/v1/rest/
TranslateUrl=https://BACKEND_HOST:BACKEND_PORT/api/v1/rest/CreateTranscribeTask
TranslateQueryUrl=https://BACKEND_HOST:BACKEND_PORT/api/v1/rest/ViewAllTask
DownloadServer=https://BACKEND_HOST:BACKEND_PORT/api/v1/rest/RetrieveTranscribe/
```

Backend should point back to frontend:

```text
NOTIFY_SERVER=FRONTEND_HOST
NOTIFY_SERVER_PORT=FRONTEND_PORT
```

The backend notification path is currently fixed in `config.js`:

```text
/jobdone
```

## Database Configuration

The backend expects MSSQL tables:

- `TASK`
- `ACCESS_OPERATION`
- `ACCESS_OPERATION_ERROR`

And sequence:

- `hibernate_sequence`

Preferred migration command:

```bash
cd apps/backend
npm run db:migrate
```

Raw SQL files are available in `apps/backend/sql`, but `scripts/db-migrate.js` is safer for repeat runs.

## Status Configuration Notes

Task state values are currently split across frontend, backend DB, and backend notification payloads. Avoid changing one layer without checking the others.

Backend DB values are defined in:

- `apps/backend/constants.js`

Backend notification values are also defined in:

- `apps/backend/constants.js`
- `apps/backend/config.js`

Frontend job strings are handled in:

- `apps/frontend/jobs.go`
- frontend templates in `apps/frontend/www/template`

## Sensitive Values

Never commit real values for:

- `DB_PASSWORD`
- `HF_TOKEN`
- `smtpPassword`
- private key files
- production JWT keys
- internal hostnames if they should not be public
- real user/account values in examples
