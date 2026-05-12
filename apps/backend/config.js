require('dotenv').config();
const fs = require('fs');
const path = require('path');


// DB configurations
const sql_config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME,
  options: {
    encrypt: false, // Enable encryption if needed
    trustServerCertificate: true, // true means to skip certificate validation, so even a self-signed certificate will be accepted.
    applicationName: 'Sparrow'
  },
  pool: {
    max: 10, // Maximum number of connections in the pool
    min: 0,
    idleTimeoutMillis: 30000, // Connection idle time before closing
    acquireTimeoutMillis: 30000
  }
};

const download_server = {
  host: process.env.DOWNLOAD_SERVER,
  port: process.env.DOWNLOAD_SERVER_PORT 
}

const notify_server = {
  server: process.env.NOTIFY_SERVER,
  port: process.env.NOTIFY_SERVER_PORT,
  path: '/jobdone',
  method: 'POST',
};

const notify_status = {
  finish: 10,
  pending: 5,
  cancel: 1,
  error: 0
};

const TASK_HOME = process.env.TASK_HOME;

function mustEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}
  
// Path configurations
const taskHomeAbs = path.resolve(mustEnv('TASK_HOME'));
const scriptsDir = process.env.TASK_SCRIPT
  ? path.resolve(process.env.TASK_SCRIPT)
  : path.join(taskHomeAbs, 'scripts');

const uploadDir = path.join(taskHomeAbs, 'upload');
const uploadlcDir = path.join(taskHomeAbs, 'uploadlc');
const transcribeDir = path.join(taskHomeAbs, 'transcribe');
const logDir = path.join(taskHomeAbs, 'log');

// Ensure runtime directories exist (Windows-friendly)
ensureDir(scriptsDir);
ensureDir(uploadDir);
ensureDir(uploadlcDir);
ensureDir(logDir);
ensureDir(path.join(transcribeDir, 'txt'));
ensureDir(path.join(transcribeDir, 'srt'));
ensureDir(path.join(transcribeDir, 'vtt'));
ensureDir(path.join(transcribeDir, 'tsv'));
ensureDir(path.join(transcribeDir, 'json'));

const paths = {
  task_script_path: scriptsDir,
  task_script: 'exec_whisperx_task_v1.2.py',
  uploaded_files_path: uploadDir + path.sep,
  uploaded_files_lc_path: uploadlcDir + path.sep,
  python_bin: mustEnv('PYTHON_BIN'),
  transcribe_txt_path: path.join(transcribeDir, 'txt') + path.sep,
  transcribe_srt_path: path.join(transcribeDir, 'srt') + path.sep,
  transcribe_vtt_path: path.join(transcribeDir, 'vtt') + path.sep,
  transcribe_tsv_path: path.join(transcribeDir, 'tsv') + path.sep,
  transcribe_json_path: path.join(transcribeDir, 'json') + path.sep,
  log_path: logDir + path.sep,
  whisperx_config_path: null
};

// WhisperX config selection:
// - Default (Linux): scripts/config.json
// - Windows: scripts/config.windows.json (if exists) else scripts/config.json
// - Override: set WHISPERX_CONFIG_PATH in .env (absolute or relative to TASK_HOME)
const configuredConfigPath = process.env.WHISPERX_CONFIG_PATH;
if (configuredConfigPath) {
  paths.whisperx_config_path = path.isAbsolute(configuredConfigPath)
    ? configuredConfigPath
    : path.resolve(taskHomeAbs, configuredConfigPath);
} else {
  const windowsCandidate = path.join(scriptsDir, 'config.windows.json');
  const defaultCandidate = path.join(scriptsDir, 'config.json');
  paths.whisperx_config_path =
    process.platform === 'win32' && fs.existsSync(windowsCandidate)
      ? windowsCandidate
      : defaultCandidate;
}

const tasks = {
  days_limit: 30 
}

// System configurations
const system = {
  num_CPUs: 2
}

const http_server = {
  host: process.env.TASK_SERVER,
  port: process.env.TASK_SERVER_PORT,
  port_http: process.env.TASK_SERVER_PORT_HTTP,
  key_path: path.join(taskHomeAbs, 'key.pem'),
  certificate_path: path.join(taskHomeAbs, 'certificate.pem')
}

// Supported MIME types
const media_mime_types = [
  'video/mp4', 
  'video/mpeg', 
  'audio/mp4', // m4a
  'audio/mpeg', // mp3
  'audio/wav',
  'audio/wave',
  'application/octet-stream'
];

// Export all configurations as an object
module.exports = {
  sql_config,
  download_server,
  notify_server,
  notify_status,
  paths,
  tasks,
  system,
  http_server,
  media_mime_types
};
