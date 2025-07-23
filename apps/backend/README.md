# Academia Sinica Transcription Platform - Backend Service

Academia Sinica AI 語音轉錄平台後端服務，基於 Node.js 與 WhisperX 引擎提供高效能語音轉文字處理能力。

Enterprise-grade audio transcription backend service powered by Node.js and WhisperX engine, developed for Academia Sinica.

## 目錄 | Table of Contents
- [核心功能 | Core Features](#核心功能--core-features)
- [系統架構 | System Architecture](#系統架構--system-architecture)
- [安裝指南 | Installation Guide](#安裝指南--installation-guide)
- [API 文件 | API Documentation](#api-文件--api-documentation)
- [部署方式 | Deployment](#部署方式--deployment)
- [專案結構 | Project Structure](#專案結構--project-structure)
- [授權條款 | License](#授權條款--license)

## 核心功能 | Core Features

### 高效能處理引擎 | High-Performance Processing Engine
- 基於 WhisperX 的最新語音識別技術
- Node.js cluster 多核心並行處理架構
- 任務隊列管理與負載平衡機制

- State-of-the-art speech recognition with WhisperX
- Multi-core parallel processing with Node.js cluster
- Task queue management and load balancing

### 企業級系統設計 | Enterprise System Design
- 完整的錯誤處理與日誌記錄機制
- 資料庫持久化儲存與備份機制
- 服務健康監控與自動恢復功能

- Comprehensive error handling and logging
- Database persistence and backup mechanisms
- Service health monitoring and auto-recovery

### 多樣化輸出格式 | Diverse Output Formats
- 標準文字檔案 (TXT)
- 時間碼字幕檔案 (SRT, VTT)
- JSON/TSV 結構化資料
- 多人對話分離標註

- Standard text files (TXT)
- Timestamped subtitle files (SRT, VTT)
- Structured data in JSON/TSV format
- Speaker diarization support

## 系統架構 | System Architecture

本系統採用多層架構設計：
The system employs a multi-layered architecture:

1. **API 層 | API Layer**：處理 HTTP 請求及回應，提供 RESTful API
   Handles HTTP requests and responses via RESTful endpoints
   
2. **服務層 | Service Layer**：實現核心業務邏輯，處理轉錄任務流程
   Implements core business logic and transcription workflow
   
3. **資料層 | Data Layer**：與 SQL Server 資料庫交互，儲存系統數據
   Interacts with SQL Server database for data persistence
   
4. **轉錄引擎層 | Transcription Engine Layer**：整合 WhisperX Python 處理引擎
   Integrates with WhisperX Python processing engine

## 安裝指南 | Installation Guide

### 環境需求 | Prerequisites
- Node.js v18.20.3+
- Python 3.9+ 與 Anaconda/Miniconda | Python 3.9+ with Anaconda/Miniconda
- SQL Server 2019+
- CUDA 支援的 NVIDIA GPU (建議 RTX 系列) | CUDA-compatible NVIDIA GPU (RTX series recommended)

### 安裝步驟 | Installation Steps

> [!TIP]
> 📖 **進階安裝筆記**：建議參考 [安裝筆記](https://hackmd.io/@San-Li/B1nKclLygx)（由社群整理，內容詳盡，涵蓋更多安裝細節與常見問題）。
>
> 📖 **Advanced Installation Notes**: For more details and troubleshooting, refer to the [Installation Notes](https://hackmd.io/@San-Li/B1nKclLygx) (community-maintained, comprehensive, and covers additional setup tips and common issues).

> [!NOTE]
> 以下安裝步驟由本專案團隊整理與維護，請依照指引操作。
>
> The following installation steps are provided and maintained by our project team. Please follow the instructions accordingly.
1. **設定資料庫 | Set up Database**
```bash
# 使用 Docker 快速部署 SQL Server | Quick deployment with Docker
docker run -e 'ACCEPT_EULA=Y' -e 'SA_PASSWORD=YourStrongPassword' \
  -p 1433:1433 --name as-sqlserver \
  -d mcr.microsoft.com/mssql/server:2019-latest

# 或使用現有的 SQL Server 實例 | Or use existing SQL Server instance
```
> [!TIP]  
> SQLServer 2019 docker manual: https://learn.microsoft.com/zh-tw/sql/linux/quickstart-install-connect-docker

2. **安裝 WhisperX | Install WhisperX**
```bash
# 請參考 [WhisperX GitHub](https://github.com/m-bain/whisperx) 的最新安裝指示。
Please refer to [WhisperX GitHub](https://github.com/m-bain/whisperx) for the latest installation instructions.
```


3. **複製並配置專案 | Clone and Configure Project**
```bash
# 複製專案 | Clone repository
git clone https://github.com/AS-AIGC/TranscriptHub.git
cd TranscriptHub/apps/backend/

# 配置環境變數 | Configure environment variables
cp .env.example .env
# 編輯 .env 設定資料庫連接與系統參數 | Edit .env file with database connection and system parameters

# 配置系統設定 | Configure system settings
cp scripts/config.json.example scripts/config.json
# 編輯 config.json 設定系統路徑與轉錄參數 | Edit config.json with system paths and transcription parameters
  
# 建立相關目錄 | Create Required Directories
TASK_HOME=/data/transcribehub    # 專案根目錄 | Root directory for transcription tasks
# ⚠️ 請確認此值與 .env 檔案內的 TASK_HOME 相同，避免路徑不一致導致檔案讀寫錯誤。 | ⚠️ Make sure this value matches the TASK_HOME in .env to avoid file path inconsistencies.

mkdir -p ${TASK_HOME}/upload            # 存放上傳檔案 | For uploaded files
mkdir -p ${TASK_HOME}/uploadlc          # 存放處理後的上傳檔案 | For processed uploads
mkdir -p ${TASK_HOME}/transcribe/txt    # 存放文字輸出 | For text output
mkdir -p ${TASK_HOME}/transcribe/srt    # 存放 SRT 字幕格式 | For SRT subtitles
mkdir -p ${TASK_HOME}/transcribe/vtt    # 存放 VTT 字幕格式 | For VTT subtitles
mkdir -p ${TASK_HOME}/transcribe/tsv    # 存放 TSV 資料格式 | For TSV data
mkdir -p ${TASK_HOME}/transcribe/json   # 存放 JSON 輸出格式 | For JSON output
mkdir -p ${TASK_HOME}/log               # 存放系統日誌 | For system logs

# 安裝專案 scripts 的相關套件 | Install dependencies for project scripts
pip install -r scripts/requirements.txt
```

4. **安裝 Node.js 套件 | Install Node.js Packages**
```bash
npm install
```

5. **初始化資料庫 | Initialize Database**
```bash
# 執行資料庫初始化腳本 | Run database initialization script
node db-init.js
# 或執行下列 SQL 腳本 (請依照實際資料庫設定修改連線資訊) | Or execute SQL scripts (modify connection settings accordingly)
cd sql
sqlcmd -S localhost -U sa -P YourStrongPassword -i createdb.sql
sqlcmd -S localhost -U sa -P YourStrongPassword -i access_operation.sql
sqlcmd -S localhost -U sa -P YourStrongPassword -i access_operation_error.sql
sqlcmd -S localhost -U sa -P YourStrongPassword -i initial.sql
sqlcmd -S localhost -U sa -P YourStrongPassword -i task.sql
```

6. **啟動服務 | Start Service**
```bash
# 使用控制腳本啟動服務 | Use control script to start service
./run.sh start

# 其他指令 | Other commands
./run.sh stop    # 停止服務 | Stop service
./run.sh status  # 檢查狀態 | Check status
./run.sh restart # 重新啟動 | Restart service
```

## 任務管理 API | Task Management API

### 1. 建立轉錄任務 | Create Transcription Task
```http
POST /api/v1/rest/CreateTranscribeTask
Content-Type: multipart/form-data
```

**請求參數 | Request Parameters**
| 參數名稱 | 說明 | 必填 | 預設值 |
|----------|------|------|--------|
| file | 音訊檔案 (支援 MP3/WAV/MPEG) Audio file | ✓ | - |
| label | 任務識別標籤 Task identifier | ✓ | - |
| sso_account | 使用者帳號 User account | ✓ | - |
| token | 認證權杖 Authentication token | ✓ | - |
| multiplespeaker | 說話者分離功能 Speaker diarization | ✗ | 0 |

**請求範例 | Request Example**
```json
{
   "file": "(binary audio file data)",
   "label": "meeting2024",
   "sso_account": "user@example.com",
   "token": "xxxxxxxx",
   "multiplespeaker": 1
}
```

**回應範例 | Response Example**
```json
{
   "status": "PENDING",
   "task_id": "xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxx",
   "message": "Success: Task created successfully"
}
```

**回應代碼 | Response Codes**
```
- 200: 任務建立成功 Task created successfully
- 400: 無效的請求參數 Invalid parameters
- 415: 不支援的檔案格式 Invalid file type
- 500: 伺服器內部錯誤 Server error
```

### 2. 查詢任務狀態 | Query Task Status
```http
POST /api/v1/rest/ViewAllTask
Content-Type: application/json
```

**請求參數 | Request Parameters**
| 參數名稱 | 說明 | 必填 | 備註 |
|----------|------|------|------|
| task_id | 任務編號 Task ID | ✗ | 不提供則返回所有任務 Returns all tasks if omitted |
| label | 任務標籤 Task label | ✗ | 過濾條件 Filter condition |
| sso_account | 使用者帳號 User account | ✓ | - |
| token | 認證權杖 Authentication token | ✗ | - |
| status | 任務狀態 Task status | ✗ | 99 表示所有狀態 99 for all statuses |

**請求範例 | Request Example**
```json
{
   "task_id": "xxxxxxxx",
   "label": "meeting2024",
   "sso_account": "user@example.com",
   "token": "xxxxxxxx",
   "status": 99
}
```

**回應範例 | Response Example**
```json
{
   "tasks": [{
      "objid": "xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxx",
      "label": "meeting2024",
      "sso_account": "user@example.com",
      "status": "1",
      "create_at": "2024-01-01T00:00:00Z",
      "exec_at": "2024-01-01T00:01:00Z",
      "finish_at": "2024-01-01T00:10:00Z",
      "original_filename": "meeting.mp3",
      "filename": "audiofile-xxxxxxxx.mp3",
      "file_size": "15728640",
      "transcribe": "1",
      "content_length": "1024"
   }]
}
```

**回應代碼 | Response Codes**
```
- 200: 查詢成功 Query successful
- 400: 無效的請求參數 Invalid parameters
- 401: 未授權存取 Unauthorized access
- 500: 伺服器內部錯誤 Server error
```

### 3. 取消任務 | Cancel Task
```http
POST /api/v1/rest/CancelTask
Content-Type: multipart/form-data
```

**請求參數 | Request Parameters**
| 參數名稱 | 說明 | 必填 | 備註 |
|----------|------|------|------|
| task_id | 任務識別碼 Task ID | ✓ | - |
| label | 任務標籤 Task label | ✗ | - |
| sso_account | 使用者帳號 User account | ✓ | - |
| token | 認證權杖 Authentication token | ✗ | - |

**請求範例 | Request Example**
```json
{
   "task_id": "xxxxxxxx",
   "label": "meeting2024",
   "sso_account": "user@example.com",
   "token": "xxxxxxxx"
}
```

**回應範例 | Response Example**
```json
{
   "message": "Operation result description",
   "task_id": "xxxxxxxx",
   "status": "CANCEL"
}
```

**回應代碼 | Response Codes**
```
- 200: 取消成功 Cancellation successful
- 400: 無效的請求參數 Invalid parameters
- 401: 未授權存取 Unauthorized access
- 404: 任務不存在 Task not found
- 500: 伺服器內部錯誤 Server error
```

### 4. 下載轉錄結果 | Download Transcription Results
```http
GET /api/v1/rest/RetrieveTranscribe/{FORMAT}/{filename}
Accept: text/plain|application/x-subrip|text/vtt|text/tab-separated-values|application/json
```

**請求參數 | Request Parameters**
| 參數名稱 | 說明 | 必填 | 格式選項 |
|----------|------|------|----------|
| FORMAT | 輸出格式 Output format | ✓ | txt, srt, vtt, json, tsv |
| filename | 檔案名稱 (不含副檔名) File name without extension | ✓ | - |

**輸出格式對應 | Format Mappings**
| 格式 Format | Content-Type | 說明 Description |
|-------------|--------------|------------------|
| txt | text/plain | 純文字格式 Plain text |
| srt | application/x-subrip | SRT 字幕格式 SRT subtitles |
| vtt | text/vtt | WebVTT 字幕格式 WebVTT subtitles |
| tsv | text/tab-separated-values | Tab 分隔值 Tab-separated values |
| json | application/json | JSON 結構化資料 JSON data |

**回應代碼 | Response Codes**
```
- 200: 下載成功 Download successful
- 401: 未授權存取 Unauthorized access
- 404: 檔案不存在 File not found
- 500: 伺服器錯誤 Server error
```

## 部署方式 | Deployment

### 生產環境建議 | Production Recommendations

1. **使用 PM2 管理進程 | Process Management with PM2**
```bash
npm install -g pm2
pm2 start main.js -i max --name "as-transcribe"
```

2. **設定 Nginx 反向代理 | Nginx Reverse Proxy Configuration**
```nginx
server {
    listen 443 ssl;
    server_name transcribe.yourdomain.com;

    # SSL 設定 | SSL configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

3. **配置防火牆與資安設定 | Security Configuration**
   - 限制訪問 IP | Restrict access by IP
   - 設定請求速率限制 | Set up request rate limiting
   - 啟用 HTTPS 強制跳轉 | Enable HTTPS redirect

## 專案結構 | Project Structure
```
apps/backend/
├── controller/                     # API 控制器目錄 | API controllers directory
│   ├── auth_controller.js          # 認證控制器 | Authentication controller
│   └── task_controller.js          # 任務控制器 | Task controller
├── log/                            # 系統日誌目錄 | System logs directory
├── middlewares/                    # 中間件目錄 | Middleware directory
│   └── validator_params.js         # 請求驗證中間件 | Request validation middleware
├── scripts/                        # 腳本目錄 | Scripts directory
│   ├── config.example.json         # 轉錄引擎配置檔範例 | Transcription engine config example
│   └── transcribe.py               # 轉錄處理主腳本 | Main transcription script
├── services/                       # 服務層目錄 | Services directory
│   └── task_service.js             # 轉錄服務 | Transcription service
├── sql/                            # SQL 腳本目錄 | SQL scripts directory
│   ├── access_operation_error.sql  # 操作異常資料表 | Operation error table
│   ├── access_operation.sql        # 操作紀錄資料表 | Operation log table
│   ├── createdb.sql                # 建立資料庫腳本 | Database creation script
│   ├── initial.sql                 # 系統初始化腳本 | System initialization
│   └── task.sql                    # 任務資料表腳本 | Task table script
├── transcribe/                     # 轉錄結果目錄 | Transcription results directory
│   ├── json/                       # JSON 格式輸出 | JSON format output
│   ├── srt/                        # SRT 格式輸出 | SRT format output
│   ├── tsv/                        # TSV 格式輸出 | TSV format output
│   ├── txt/                        # TXT 格式輸出 | Text format output
│   └── vtt/                        # VTT 格式輸出 | VTT format output
├── upload/                         # 上傳檔案目錄 | Upload directory
├── uploadlc/                       # 處理後檔案目錄 | Processed files directory
├── .env.example                    # 環境變數範例 | Environment variables example
├── db-init.js                      # 資料庫初始化腳本 | Database initialization script
├── db.js                           # 資料庫連接模組 | Database connection module
├── config.js                       # 系統配置檔 | System configuration
├── constants.js                    # 常數定義檔 | Constants definition
├── env.js                          # 環境變數處理 | Environment variables handler
├── logger-writter.js               # 日誌寫入器 | Log writer
├── logger.js                       # 日誌模組 | Logging module
├── main.js                         # 應用程式入口 | Application entry point
├── package.json                    # 專案描述檔 | Project descriptor
├── query_constants.js              # 查詢常數檔 | Query constants
├── run.sh                          # 服務控制腳本 | Service control script
├── shared.js                       # 共用函數模組 | Shared functions module
└── utils.js                        # 工具函數模組 | Utility functions module
```

## 授權條款 | License

本專案採用 MIT 授權條款。

This project is licensed under the MIT License.
