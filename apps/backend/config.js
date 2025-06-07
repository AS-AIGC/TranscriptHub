require('dotenv').config();


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
  
// Path configurations
const paths = {
  task_script_path: `${TASK_HOME}/scripts`,
  task_script: 'exec_whisperx_task_v1.0.py',
  uploaded_files_path: `${TASK_HOME}/upload/`,
  uploaded_files_lc_path: `${TASK_HOME}/uploadlc/`,
  python_bin: process.env.PYTHON_BIN,
  transcribe_txt_path: `${TASK_HOME}/transcribe/txt/`,
  transcribe_srt_path: `${TASK_HOME}/transcribe/srt/`,
  transcribe_vtt_path: `${TASK_HOME}/transcribe/vtt/`,
  transcribe_tsv_path: `${TASK_HOME}/transcribe/tsv/`,
  transcribe_json_path: `${TASK_HOME}/transcribe/json/`,
  log_path: `${TASK_HOME}/log/`
};

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
  key_path: `${TASK_HOME}/key.pem`,
  certificate_path: `${TASK_HOME}/certificate.pem`
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
