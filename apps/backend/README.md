# TranscriptHub Backend

---

## 中文版（主要）

### 專案說明
本服務為 TranscriptHub 的後端轉錄系統，採用 Node.js + WhisperX，提供音檔上傳、任務管理與多格式輸出（TXT/SRT/VTT/TSV/JSON）。

### Windows 快速安裝

1. 下載程式碼並進入目錄
```powershell
git clone https://github.com/AS-AIGC/TranscriptHub.git
cd TranscriptHub\apps\backend
```

2. 準備設定檔
```powershell
copy .env.example .env
copy scripts\config.json.example scripts\config.json
```

3. 編輯 `.env`
- 設定資料庫連線（`DB_*`）
- 設定 `TASK_HOME`
- 設定 `PYTHON_BIN`（例如：`<PYTHON_ENV_PATH>\python.exe`）
- 需要時可設定 `WHISPERX_CONFIG_PATH`

4. 安裝 Node.js 套件
```powershell
npm install
```

5. 安裝 Python 套件
```powershell
<PYTHON_ENV_PATH>\python.exe -m pip install -r requirements.txt
```

6. 初始化資料庫
```powershell
node scripts\db-migrate.js
```

7. 啟動服務
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-windows.ps1
```

### Linux/macOS 快速安裝
```bash
git clone https://github.com/AS-AIGC/TranscriptHub.git
cd TranscriptHub/apps/backend
cp .env.example .env
cp scripts/config.json.example scripts/config.json
npm install
python -m pip install -r requirements.txt
./run.sh start
```

### 主要 API
- `POST /api/v1/rest/CreateTranscribeTask`
- `POST /api/v1/rest/CancelTask`
- `POST /api/v1/rest/ViewAllTask`
- `GET /api/v1/rest/RetrieveTranscribe/TXT/:filename`
- `GET /api/v1/rest/RetrieveTranscribe/SRT/:filename`
- `GET /api/v1/rest/RetrieveTranscribe/VTT/:filename`
- `GET /api/v1/rest/RetrieveTranscribe/TSV/:filename`
- `GET /api/v1/rest/RetrieveTranscribe/JSON/:filename`

### 健康檢查（自簽憑證）
```powershell
curl.exe -k -I https://localhost:8080/api/v1/rest/RetrieveTranscribe/TXT/test
```

### 目錄摘要
```text
apps/backend/
├─ controller/
├─ middlewares/
├─ services/
├─ scripts/
├─ sql/
├─ transcribe/
├─ upload/
├─ uploadlc/
├─ .env.example
├─ config.js
├─ db-init.js
├─ main.js
└─ requirements.txt
```

### 注意事項
- README 以「提供他人安裝」為目的，請將範例路徑替換成你的實際環境。
- 不要提交個人機器路徑、帳號資訊或密鑰。
- `scripts/config.json` 若含敏感資訊，請改用安全方式管理。

---

## English (Reference)

### Overview
TranscriptHub backend is a Node.js + WhisperX service for audio transcription, task management, and multi-format output (TXT/SRT/VTT/TSV/JSON).

### Quick Start (Windows)

1. Clone and enter backend folder
```powershell
git clone https://github.com/AS-AIGC/TranscriptHub.git
cd TranscriptHub\apps\backend
```

2. Prepare config files
```powershell
copy .env.example .env
copy scripts\config.json.example scripts\config.json
```

3. Update `.env`
- Configure DB connection (`DB_*`)
- Set `TASK_HOME`
- Set `PYTHON_BIN` (example: `<PYTHON_ENV_PATH>\python.exe`)
- Optionally set `WHISPERX_CONFIG_PATH`

4. Install Node.js dependencies
```powershell
npm install
```

5. Install Python dependencies
```powershell
<PYTHON_ENV_PATH>\python.exe -m pip install -r requirements.txt
```

6. Initialize DB schema
```powershell
node scripts\db-migrate.js
```

7. Start service
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-windows.ps1
```

### Quick Start (Linux/macOS)
```bash
git clone https://github.com/AS-AIGC/TranscriptHub.git
cd TranscriptHub/apps/backend
cp .env.example .env
cp scripts/config.json.example scripts/config.json
npm install
python -m pip install -r requirements.txt
./run.sh start
```

### API Endpoints
- `POST /api/v1/rest/CreateTranscribeTask`
- `POST /api/v1/rest/CancelTask`
- `POST /api/v1/rest/ViewAllTask`
- `GET /api/v1/rest/RetrieveTranscribe/TXT/:filename`
- `GET /api/v1/rest/RetrieveTranscribe/SRT/:filename`
- `GET /api/v1/rest/RetrieveTranscribe/VTT/:filename`
- `GET /api/v1/rest/RetrieveTranscribe/TSV/:filename`
- `GET /api/v1/rest/RetrieveTranscribe/JSON/:filename`

### Health Check (self-signed cert)
```powershell
curl.exe -k -I https://localhost:8080/api/v1/rest/RetrieveTranscribe/TXT/test
```
