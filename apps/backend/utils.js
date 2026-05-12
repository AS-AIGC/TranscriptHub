/**
 * @file utils.dev.js
 * @brief Core utilities for Sparrow transcription system
 * 
 * Media Operations:
 * - File type validation
 * - Duration extraction using ffprobe
 * - MIME type checking
 * 
 * Network Features:
 * - HTTPS notification delivery
 * - IPv4/IPv6 address handling
 * - SSL configuration (dev mode)
 * 
 * Utilities:
 * - Promise and callback patterns
 * - Error handling and logging
 * - Response processing
 * 
 * @requires External
 * - https, fs, path
 * - fluent-ffmpeg
 * - mime-types
 * 
 * @requires Internal
 * - ./logger.js
 * - ./constants.js
 * - ./config.js
 * - ./shared.js
 * - ./env.js
 * 
 * @exports
 * - translate_ipv4_to_ipv6: IP address normalization
 * - send_notification:      HTTPS notification sender
 * - get_media_duration:     Media file analysis
 * 
 * @note Supports both Promise and callback patterns
 * @note Development mode disables SSL verification
 */

// ...existing code...
const https = require('https');
const fs = require('fs');
const path = require('path');

const { logger } = require('./logger.js');
const { LOG_LEVEL } = require('./constants.js');
const cfg = require('./config.js');
const { 
  get_worker_pids, 
  set_worker_pids, 
  add_worker_pid, 
  remove_worker_pid,
  operation_memo
} = require('./shared.js');
const ffprobe = require('fluent-ffmpeg');
const mime = require('mime-types');
const { __PROD__ } = require('./env.js');

function is_path_within(parent_path, target_path) {
  const parent = path.resolve(parent_path);
  const target = path.resolve(target_path);
  const rel = path.relative(parent, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function is_allowed_media_path(file_path) {
  const allowed_roots = [
    cfg.paths.uploaded_files_path,
    cfg.paths.uploaded_files_lc_path
  ];
  return allowed_roots.some((root) => is_path_within(root, file_path));
}

/**
 * @brief Check if file is a supported media type (callback version)
 * 
 * @param file_path [in] Path to media file to check
 * @param callback  [in] Function(err, is_media)
 *   - err:      Error object if operation failed
 *   - is_media: Boolean indicating if file is supported
 * 
 * Supported Types:
 * - video/mp4, video/mpeg, video/m4a
 * - audio/mpeg, audio/wav, audio/mp3
 * 
 * @note Checks both file existence and MIME type
 */
function is_media_file_callback(file_path, callback) {
  if (!is_allowed_media_path(file_path)) {
    logger(LOG_LEVEL.ERROR, `Refused media access outside upload paths: ${file_path}`);
    return callback(null, false);
  }

  fs.access(file_path, (err) => {
    if (err) {
      logger(LOG_LEVEL.ERROR, `Error accessing audio source file ${err.message}`);
      return callback(null, false);
    }

    const mime_type = mime.lookup(file_path);
    
    callback(null, cfg.media_mime_types.includes(mime_type));
  });
}

/**
 * @brief Get media file duration and metadata (callback version)
 * 
 * @param file_path [in] Path to media file
 * @param callback  [in] Function(err, result)
 *   - err:    Error if operation failed
 *   - result: Object with duration, file_type, mime_type
 * 
 * @note Uses ffprobe for metadata extraction
 * @note Validates media type before processing
 */
function get_media_duration_callback(file_path, callback) {
  is_media_file_callback(file_path, (err, is_media) => {
    if (err) {
      return callback(err);
    }

    if (!is_media) {
      return callback(new Error('Not a supported media file'));
    }

    ffprobe.ffprobe(file_path, (err, metadata) => {
      if (err) {
        console.error('FFprobe Error:', {
          message: err.message,
          code: err.code,
          file_path: file_path
        });
        return callback(err);
      }

      const duration = metadata.format?.duration || 0;
      
      callback(null, {
        duration: duration,
        file_type: path.extname(file_path),
        mime_type: mime.lookup(file_path)
      });
    });
  });
}



/**
 * @brief Universal media duration getter (supports both patterns)
 * 
 * @param file_path [in] Path to media file
 * @param done     [opt] Optional callback for non-Promise usage
 * @return Promise<number> Duration in seconds
 * @return void if callback provided
 * 
 * Usage Examples:
 * ```js
 * // Promise usage
 * const duration = await get_media_duration('file.mp3');
 * 
 * // Callback usage
 * get_media_duration('file.mp3', (err, duration) => {
 *   if (err) handleError(err);
 *   else handleDuration(duration);
 * });
 * ```
 * 
 * @note Returns 0 if duration cannot be determined
 * @note Uses callback internally and wraps in Promise
 * @note Validates media type before processing
 */
function get_media_duration(file_path, done) {
  const run =  () => new Promise((resolve, reject) => {
        get_media_duration_callback(file_path, (err, result) => {
          if (err) 
            reject(err);
          else 
            resolve(result?.duration ?? 0);
        });
      }) 

  if (typeof done === 'function') {
    run().then((duration) => done(null, duration)).catch((e) => done(e));
  } else {
    return run();
  }

  // return new Promise((resolve, reject) => {
  //   ffprobe.ffprobe(file_path, (err, metadata) => {
  //     if (err) {
  //       reject(err);
  //     } else {
  //       const duration = metadata.format.duration;
  //       resolve(duration);
  //     }
  //   });
  // });
}

/**
 * @brief Translates IPv6 addresses to IPv4 format when applicable
 * 
 * Rules:
 * 1. IPv4-mapped IPv6 (::ffff:x.x.x.x) -> IPv4 (x.x.x.x)
 * 2. IPv6 loopback (::1) -> IPv4 loopback (127.0.0.1) 
 * 3. All others -> unchanged
 * 
 * Example: 
 *   "::ffff:192.168.1.1" -> "192.168.1.1"
 *   "::1" -> "127.0.0.1"
 */
function translate_ipv4_to_ipv6(ip_address) {
  if (ip_address.includes('::ffff:')) {
    return ip_address.replace('::ffff:', '');
  } else if (ip_address === '::1') {
    return '127.0.0.1';
  }
  return ip_address;
}


/**
 * @brief HTTPS notification sender for task status updates
 * 
 * @param notify_config [in] Server configuration object containing:
 *   - server [string] Target hostname
 *   - port   [number] Target port
 *   - path   [string] API endpoint path
 *   - method [string] HTTP method (GET/POST)
 * @param notify_data [in] JSON-serializable notification payload
 * @param task_objid [in] Task identifier for logging
 * 
 * Request:
 * - Content-Type: application/json
 * - SSL Certificate: Disabled
 * - Body: JSON payload
 * 
 * Error Handling:
 * - Network errors logged with task context
 * - Response parsing errors captured
 * 
 * @note Async function without Promise return
 * @note SSL verification disabled for development
 */
async function send_notification(notify_config, notify_data, task_objid) {
  const options = prepare_request_options(notify_config, notify_data);
  const memo = operation_memo({ ref: task_objid });

  const req = https.request(options, (res) => {
      handle_response(res, task_objid, memo);
  });

  req.on('error', (err) => {
      logger(LOG_LEVEL.ERROR, 
          `Task ${task_objid} notification error ${err}`, 
          memo
      );
  });

  req.write(notify_data);
  req.end();
}

/**
 * @brief Prepare HTTPS request configuration
 * 
 * @param config [in] Server configuration object containing:
 *   - server [string] Target hostname
 *   - port   [number] Target port
 *   - path   [string] API endpoint path
 *   - method [string] HTTP method
 * @param data   [in] Request body payload
 * @return HTTPS options object with:
 *   - Basic connection settings
 *   - SSL verification disabled
 *   - JSON content headers
 * 
 * @note Content length calculated from data parameter
 * @note SSL verification intentionally disabled
 */
function prepare_request_options(config, data) {
  const should_reject_unauthorized = __PROD__;
  return {
      hostname: config.server,
      port: config.port,
      path: config.path,
      method: config.method,
      rejectUnauthorized: should_reject_unauthorized,
      headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
      }
  };
}

/**
 * @brief Handle HTTP response data accumulation
 * 
 * @param response [in] HTTP response object with event emitters
 * @param task_objid [in] Task identifier for tracking
 * @param memo    [in] Operation memo for logging context
 * 
 * Events Handled:
 * - 'data': Accumulates response chunks
 * - 'end':  Processes complete response
 * 
 * @note Asynchronous event-based processing
 * @note Response data accumulated in memory
 */
function handle_response(response, task_objid, memo) {
  let response_data = '';

  response.on('data', (chunk) => {
      response_data += chunk;
  });

  response.on('end', () => {
      process_response_data(response_data, task_objid, memo);
  });
}

/**
 * @brief Parses and processes HTTP response data
 *
 * @param data       [in] Raw response data string to parse
 * @param task_objid [in] Task identifier for tracing
 * @param memo       [in] Operation context for logging
 *
 * @note Handles both successful and failed JSON parsing
 */
function process_response_data(data, task_objid, memo) {
  try {
      const parsed_data = JSON.parse(data);
      log_successful_response(parsed_data, task_objid, memo);
  } catch (err) {
      log_failed_response(err, data, task_objid, memo);
  }
}

/**
 * @brief Logs successfully parsed response data
 *
 * @param data       [in] Parsed JSON object
 * @param task_objid [in] Task identifier for tracing
 * @param memo       [in] Operation context for logging
 *
 * @note Logs both formatted string and tabular data
 */
function log_successful_response(data, task_objid, memo) {
  const formatted_data = JSON.stringify(data, null, 2);
  logger(LOG_LEVEL.INFO, 
      `Received response ${formatted_data} after task ${task_objid} notification.`, 
      memo
  );
  logger(LOG_LEVEL.INFO_TABLE, data);
}

/**
 * @brief Logs failed parse attempt with raw data
 *
 * @param error      [in] JSON parse error object
 * @param data       [in] Original unparsed data
 * @param task_objid [in] Task identifier for tracing
 * @param memo       [in] Operation context for logging
 *
 * @note Logs error and raw data in tabular format
 */
function log_failed_response(error, data, task_objid, memo) {
  logger(LOG_LEVEL.ERROR, 
      `Error parsing the response ${error} after task ${task_objid} notification.`, 
      memo
  );
  logger(LOG_LEVEL.INFO_TABLE, data);
}

module.exports = {
    translate_ipv4_to_ipv6,
    send_notification,
    get_media_duration
};

  
