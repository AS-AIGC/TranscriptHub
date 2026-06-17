// logger-writer.js
const fs = require('fs');
const path = require('path');
const cfg = require('./config.js'); 

/* Initialize logging directory and file path */
const log_path = cfg.paths.log_path;
if (!fs.existsSync(log_path)) {
    fs.mkdirSync(log_path, { recursive: true });
}
const today = new Date().toISOString().slice(0, 10);
const log_file = path.join(log_path, `sparrow-${today}.log`); //TODO: config path


// Default: non-blocking append for medium traffic
function write_to_log_file(text) {
  fs.appendFile(log_file, text + '\n', 'utf8', (err) => {
      if (err) console.error('Failed to write to log file:', err);
  });
}

/*
// High-traffic mode (optional)
// const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
// function writeToLogFile(text) {
//   logStream.write(text + '\n');
// }
*/

/**
 * @brief Writes log entry to database with metadata
 */
async function write_to_database(level, message, data) {
  const { log_operation_to_db } = require('./db.js');
  await log_operation_to_db({
      route: data.route || '',
      token: data.token || '',
      sso_account: data.sso_account || '',
      ip_address: data.ip_address || '',
      query_time: data.query_time || '',
      process_id: data.process_id || '',
      code: String(level),
      ref: data.ref,
      log: message
  });
}

module.exports = {
  write_to_log_file,
  write_to_database
};
