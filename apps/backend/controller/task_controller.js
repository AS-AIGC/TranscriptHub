/**
 * @file task_controller.js
 * @brief Express controllers for task management endpoints
 *
 * Controllers:
 * - create_transcribe_task: Creates new transcription tasks
 * - cancel_task: Cancels existing tasks
 * - view_all_tasks: Lists tasks by status
 * - handle_file_download: Serves transcribed files
 *
 * Features:
 * - File upload handling
 * - Worker process load balancing
 * - Task status management
 * - Access authorization
 * - File cleanup on cancellation
 *
 * @requires path, fs
 * @requires ../config.js 
 * @requires ../utils.dev.js
 * @requires ../services/task_service.js
 * @requires ./auth_controller.js
 *
 * @note All controllers are async functions
 * @note Implements proper error handling and logging
 */

const path = require('path');
const fs = require('fs');

const cfg = require('../config.js');
const { logger } = require('../logger.js');
const { LOG_LEVEL, NOTIFY_STATUS, TASK_STATUS } = require('../constants.js');
const { 
  translate_ipv4_to_ipv6, 
  send_notification, 
  get_media_duration 
} = require('../utils.js');

const { 
  is_authorized_to_access_file,
  is_authorized_to_access_task
} = require('./auth_controller.js');

const { 
  create_task,
  cancel_task,
  view_all_tasks,
  get_task_result_path,
  check_task_status
} = require('../services/task_service.js');

const { 
  get_worker_pids, 
  set_worker_pids, 
  add_worker_pid, 
  remove_worker_pid,
  operation_memo
} = require('../shared.js');

function is_safe_download_filename(filename) {
  return typeof filename === 'string' && /^[A-Za-z0-9_-]+$/.test(filename);
}


/**
 * @brief Create and initialize a new transcription task
 * 
 * @param req [in] Express request object containing:
 *   - file:     Uploaded audio file info
 *   - body:     Task parameters (label, sso_account, token, multiplespeaker)
 *   - headers:  Client IP and auth headers
 * @param res [out] Express response object
 * 
 * Operation Flow:
 * 1. Validate file upload and required parameters
 * 2. Assign task to available worker or current process
 * 3. Create task record in database
 * 4. Return task ID and status to client
 * 
 * @return JSON response with:
 *   - message:    Operation result description
 *   - task_objid: Created task identifier
 *   - status:     PENDING or ERROR
 * 
 * @note Handles file validation and parameter checking
 * @note Implements basic worker process load balancing
 */
async function create_transcribe_task_controller(req, res) {
  if (!req.file) {
    logger(LOG_LEVEL.ERROR, `The task creation failed, no file was uploaded.`);
    return res.status(500).json({
      message: 'The task creation failed, no file was uploaded.',
      task_objid: '',
      status: NOTIFY_STATUS.ERROR
    });
  }

  const route = '/api/v1/rest/CreateTranscribeTask';
  const o_filename = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  const o_file_mimetype = req.file.mimetype;
  const n_filename = req.file.filename;
  const file_size_in_bytes = req.file.size;
  const file_size_in_kbytes = (file_size_in_bytes / 1024).toFixed(2); // Rounded to 2 decimal places

  logger(LOG_LEVEL.INFO, `File ${o_filename}(${file_size_in_kbytes}KB, ${o_file_mimetype}) uploaded successfully.`);    
  
  const { label, sso_account, token, multiplespeaker } = req.body || {};
  let diarize = multiplespeaker || 0;

  const ip_address = translate_ipv4_to_ipv6(req.headers['x-forwarded-for'] || req.connection.remoteAddress);
  
  

  /****************************************/
  // Check whether the session has been authorized by FIDO
  // const auth_header = req.headers['authorization'];
  // if (!auth_header || !auth_header.startsWith('Bearer ')) {
  //   logger(LOG_LEVEL.INFO, `Invalid or missing Bearer token ${auth_header}.` );
  // } else {
  //   const auth_token = auth_header.split(' ')[1];
  //   logger(LOG_LEVEL.INFO, `Bearer token ${auth_token}.` );
  // }
  /****************************************/


  if (!sso_account || !token || !label ) {
    const memo = operation_memo({
      route: route,
      token: token,
      sso_account: sso_account,
      ip_address: ip_address
    });
    logger(LOG_LEVEL.ERROR, `The task creation failed because sso_account, token, label were not provided.`, memo);

    return res.status(400).json({
      message: 'The task creation failed becasue sso_account, token, label were not provided.',
      task_objid: '',
      status: NOTIFY_STATUS.ERROR
    });
  }

  var task_objid = 0;
  var task_assigned_pids;
  
  // If worker processes are available, randomly select one PID for task assignment.
  // Otherwise, fall back to the current process's PID.
  if (get_worker_pids() !== null) {
    //select a PID randomly and distribute
    task_assigned_pids = get_worker_pids()[Math.floor(Math.random() * get_worker_pids().length)];
  } else {
    task_assigned_pids = process.pid;
  }

  try {
    const start_time = process.hrtime();
    const audio_file_path = path.join(cfg.paths.uploaded_files_path, n_filename);
    const duration_result = await get_media_duration(audio_file_path);
    const duration = Number.isFinite(duration_result) ? duration_result : 0.0;

    task_objid = await create_task({
      label: label,
      original_filename: o_filename,
      new_filename: n_filename,
      status: '0',
      route: route,
      pid: task_assigned_pids,
      sso_account: sso_account,
      file_size: file_size_in_kbytes,
      diarize: diarize,
      duration: duration
    });

    const query_time = process.hrtime(start_time);
    const query_time_in_ms = (query_time[0] * 1e9 + query_time[1]) /1e6;
    const memo = operation_memo({
      route: route,
      token: token,
      sso_account: sso_account,
      ip_address: ip_address,
      query_time: '' + query_time_in_ms.toFixed(3) + ' ms',
      ref: task_objid
    });
    logger(LOG_LEVEL.INFO, `The task ${task_objid} was created successfully.`, memo);
 
    res.status(200).json({
      message: 'The task was created successfully', 
      task_objid,
      status: NOTIFY_STATUS.PENDING
    });
  } catch (err) {
    const memo = operation_memo({
      route: route,
      token: token,
      sso_account: sso_account,
      ip_address: ip_address,
      ref: task_objid
    });
    logger(LOG_LEVEL.ERROR, `${route}: ${err}`, memo);

    res.status(500).json({
      message: `The task creation failed because ${err}.`,
      task_objid,
      status: NOTIFY_STATUS.ERROR
    });
  } finally {
    //sql.close();
  }
  
}

/**
 * @brief Cancel an existing transcription task
 *
 * @param req [in] Express request object containing:
 *   - body.label       Task label
 *   - body.sso_account User account
 *   - body.token      Authorization token
 *   - body.task_objid Task identifier
 * @param res [out] Express response object
 *
 * Operation Flow:
 * 1. Validate required parameters
 * 2. Check task ownership authorization
 * 3. Cancel task if not running
 * 4. Clean up associated files
 *
 * @return JSON response with:
 *   - message:    Operation result description
 *   - task_objid: Cancelled task identifier
 *   - status:     CANCEL or ERROR
 *
 * Files Cleaned:
 * - Original audio (.wav)
 * - Lowercased audio
 * - Transcription outputs (.txt, .srt, .vtt, .tsv, .json)
 *
 * @note Cannot cancel currently executing tasks
 * @note Logs all file cleanup operations
 */
async function cancel_task_controller(req, res) {
  const route = '/api/v1/rest/CancelTask';
  const { label, sso_account, token, task_objid } = req.body || {};
  //const ip_address = req.ip;
  const ip_address = translate_ipv4_to_ipv6(req.headers['x-forwarded-for'] || req.connection.remoteAddress);

  const memo = operation_memo({
    route: route,
    token: token,
    sso_account: sso_account,
    ip_address: ip_address,
    ref: task_objid
  });
  if (!sso_account || !token || !label || !task_objid) {
    logger(LOG_LEVEL.ERROR, `The task cacellation failed because sso_account=${sso_account}, token=${token}, label=${label}, objid=${task_objid} were not provided.`, memo);
    return res.status(400).json({
      message: 'The task cancellation failed becasue sso_account, token, label, objid were not provided.',
      task_objid,
      status: NOTIFY_STATUS.ERROR
    });
  }

  // Check if the task belongs to the SSO account
  const is_valid = await is_authorized_to_access_task({task_objid, sso_account});
  if (!is_valid) {
    logger(LOG_LEVEL.WARNING, `${route}: This task ${task_objid} does not belong to the sso account ${sso_account}, or ${task_objid} is duplicated.`, memo);
    return res.status(401).json({
      message: 'This task objid does not belong to the sso account, or objid is duplicated.',
      task_objid,
      status: NOTIFY_STATUS.ERROR
    });
  }

  try {
    const start_time = process.hrtime();

    let result = await check_task_status({
      objid: task_objid
    });

    if (result?.recordset?.length === 1 && result.recordset[0].STATUS !== 1) {
      result = await cancel_task({
        objid: task_objid
      });
    } else {
      /* Force to cancel the runnning process, if status == 1 kill child_process or delete from 
      if (child_process && !child_process.killed) {
        child_process.kill('SIGINT');  
        res.status(200).send({ message: 'Cancellation initiated successfully.' });
      } else {
        res.status(200).send({ message: 'No active task found or task already terminated.' });
      }
      */
      logger(LOG_LEVEL.WARNING, `${route}: This task ${task_objid} does not exists or is currently executing.`, memo);
      return res.status(200).json({
        message: 'The task does not exists or is currently executing.',
        task_objid,
        status: NOTIFY_STATUS.ERROR
      });
    }

    const query_time = process.hrtime(start_time);
    const query_time_in_ms = (query_time[0] * 1e9 + query_time[1]) /1e6;

    // Extract cancelledFilename if exactly one record was updated
    let cancelled_file_basename = '';
    let cancelled_filename = '';
    if (result.rowsAffected[0] === 1) {
      // Parse the filename (FILENAME) and extract the base name (without extension)
      cancelled_file_basename = path.parse(result.recordset[0].FILENAME).name;
      cancelled_filename = result.recordset[0].FILENAME;
    } else {
      // TODO: if result.rowsAffected[0] > 0 then ...
    }

    const d = {
      sso_account: sso_account,
      label: label,
      token: token,
      objid: task_objid,
      result: result.rowsAffected[0] === 0
                ? `No matching task ${task_objid} found.`
                : result.rowsAffected[0] > 1
                  ? `Operation failed: More than one task was cancelled for ${task_objid}.`
                  : `The task ${task_objid} has been cancelled successfully.`,
    };

    // When using INFO_TABLE, the message will be converted with JSON.stringify.
    const d_str = JSON.stringify(d, null, 2)
    logger(LOG_LEVEL.INFO_TABLE, `${route} ${d_str}}`, operation_memo({
      route: route,
      token: token,
      sso_account: sso_account,
      ip_address: ip_address,
      query_time: '' + query_time_in_ms.toFixed(3),
      ref: task_objid
    }));

    // TODO: if result.rowsAffected[0] > 0 then ...
    // return res
    // 

    // Remove the uploaded file and transcribed files
    const audio_file_path = path.join(cfg.paths.uploaded_files_path, cancelled_filename);
    const audiolc_file_path = path.join(cfg.paths.uploaded_files_lc_path, cancelled_filename);
    const transcribe_txt_path = path.join(cfg.paths.transcribe_txt_path, `${cancelled_file_basename}.txt`);
    const transcribe_srt_path = path.join(cfg.paths.transcribe_srt_path, `${cancelled_file_basename}.srt`);
    const transcribe_vtt_path = path.join(cfg.paths.transcribe_vtt_path, `${cancelled_file_basename}.vtt`);
    const transcribe_tsv_path = path.join(cfg.paths.transcribe_tsv_path, `${cancelled_file_basename}.tsv`);
    const transcribe_json_path = path.join(cfg.paths.transcribe_json_path, `${cancelled_file_basename}.json`);
    fs.unlink(audio_file_path, (err) => {
      if (err) {
        logger(LOG_LEVEL.ERROR, `Failed to remove file ${audio_file_path}: ${err}`, memo);
      } else {
        logger(LOG_LEVEL.INFO, `File ${audio_file_path} removed successfully`, memo);
      }
    });
    fs.unlink(audiolc_file_path, (err) => {
      if (err) {
        logger(LOG_LEVEL.ERROR, `Failed to remove file ${audiolc_file_path}: ${err}`, memo);
      } else {
        logger(LOG_LEVEL.INFO, `File ${audiolc_file_path} removed successfully`, memo);
      }
    });
    fs.unlink(transcribe_txt_path, (err) => {
      if (err) {
        logger(LOG_LEVEL.ERROR, `Failed to remove file ${transcribe_txt_path}: ${err}`, memo);
      } else {
        logger(LOG_LEVEL.INFO, `File ${transcribe_txt_path} removed successfully`, memo);
      }
    });
    fs.unlink(transcribe_srt_path, (err) => {
      if (err) {
        logger(LOG_LEVEL.ERROR, `Failed to remove file ${transcribe_srt_path}: ${err}`, memo);
      } else {
        logger(LOG_LEVEL.INFO, `File ${transcribe_srt_path} removed successfully`, memo);
      }
    });
    fs.unlink(transcribe_vtt_path, (err) => {
      if (err) {
        logger(LOG_LEVEL.ERROR, `Failed to remove file ${transcribe_vtt_path}: ${err}`, memo);
      } else {
        logger(LOG_LEVEL.INFO, `File ${transcribe_vtt_path} removed successfully`, memo);
      }
    });
    fs.unlink(transcribe_tsv_path, (err) => {
      if (err) {
        logger(LOG_LEVEL.ERROR, `Failed to remove file ${transcribe_tsv_path}: ${err}`, memo);
      } else {
        logger(LOG_LEVEL.INFO, `File ${transcribe_tsv_path} removed successfully`, memo);
      }
    });
    fs.unlink(transcribe_json_path, (err) => {
      if (err) {
        logger(LOG_LEVEL.ERROR, `Failed to remove file ${transcribe_json_path}: ${err}`, memo);
      } else {
        logger(LOG_LEVEL.INFO, `File ${transcribe_json_path} removed successfully`, memo);
      }
    });

    // Send response
    res.status(200).json({
      message: d.result,
      task_objid,
      status: NOTIFY_STATUS.CANCEL
    });
  } catch (err) {
    logger(LOG_LEVEL.ERROR, `${route}: ${err}`, memo);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    //sql.close();
  }
}


/**
 * @brief List all tasks filtered by status
 *
 * @param req [in] Express request object containing:
 *   - body.label       Task label filter
 *   - body.sso_account User account
 *   - body.token      Authorization token
 *   - body.status     Task status filter (99 for all)
 * @param res [out] Express response object
 *
 * Operation Flow:
 * 1. Extract request parameters
 * 2. Query tasks from database
 * 3. Return task list as JSON
 *
 * @return JSON array of tasks with fields:
 *   - OBJID:      Task identifier
 *   - LABEL:      Task label
 *   - STATUS:     Current status
 *   - CREATE_DT:  Creation timestamp
 *   - UPDATE_DT:  Last update timestamp
 *
 * @note Default status filter is 99 (all tasks)
 * @note Includes query performance logging
 */
async function view_all_tasks_controller(req, res) {
  const route = '/api/v1/rest/ViewAllTask';
  const { label, sso_account, token } = req.body;
  const ip_address = translate_ipv4_to_ipv6(req.headers['x-forwarded-for'] || req.connection.remoteAddress);
  const status = req.body.status || 99; // Default status if not provided, means all status

  const memo = operation_memo({
    route: route,
    token: token,
    sso_account: sso_account,
    ip_address: ip_address,
    ref: null
  });
  try {
    const start_time = process.hrtime();
    
    // Fetch tasks from database
    const tasks = await view_all_tasks({
      sso_account: sso_account,
      label: label,
      status: status
    });      
    const query_time = process.hrtime(start_time);
    const query_time_in_ms = (query_time[0] * 1e9 + query_time[1]) /1e6;

    // Send tasks as response     
    res.status(200).json(tasks.recordset);

    // Construct a single object for the table output
    const d = {
      sso_account: sso_account,
      label: label,
      token: token,
      status: status,
      tasks: (tasks ? tasks.recordset.length : 0)
    };
    // Log successful operation
    const d_str = JSON.stringify(d, null, 2);
    logger(LOG_LEVEL.INFO, 
      `${route}: Query completed in ${query_time_in_ms.toFixed(3)} ms: ${d_str}.`,
      {
        route: route,
        token: token,
        sso_account: sso_account,
        ip_address: ip_address,
        query_time: '' + query_time_in_ms.toFixed(3) + ' ms',
        process_id: '' + process.pid,
        ref: null,
      }
    );
    logger(LOG_LEVEL.INFO_TABLE, d); 
  } catch (err) {
    logger(LOG_LEVEL.ERROR, `${route}: ${err}`, memo);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    //sql.close();
  }
}

/**
 * @brief Handle download requests for transcription output files
 *
 * @param req [in] Express request object containing:
 *   - params.filename  Base filename without extension
 *   - query.sso_account User account for authorization
 *   - query.task_objid Task identifier for tracing
 *   - query.token     Authorization token
 * @param res [out] Express response object
 * @param file_type [in] Output format (TXT/SRT/VTT/TSV/JSON)
 *
 * Operation Flow:
 * 1. Validate user authorization
 * 2. Get file path from task service
 * 3. Stream file download to client
 *
 * @return File download or JSON error:
 *   Success: File download stream
 *   Error: {
 *     message: Error description
 *     status:  ERROR
 *   }
 *
 * @note Uses Express res.download() for file streaming
 * @note Includes access logging for security
 */
async function handle_file_download_controller(req, res, file_type) {
  const filename = req.params.filename;
  if (!is_safe_download_filename(filename)) {
    return res.status(400).json({
      message: 'Invalid filename format.',
      status: NOTIFY_STATUS.ERROR
    });
  }
  const { sso_account, task_objid, token } = req.query; // GET parameters
  const ip_address = translate_ipv4_to_ipv6(req.headers['x-forwarded-for'] || req.connection.remoteAddress);

  //const file_path = path.join(cfg.paths[download_paths[file_type]], `${filename}.${file_type.toLowerCase()}`);
  const route = `/api/v1/rest/RetrieveTranscribe/${file_type}/${filename}`;


  const memo = operation_memo({
    route: route,
    token: token,
    sso_account: sso_account,
    ip_address: ip_address,
    ref: task_objid
  });

  // Check if the file belongs to the SSO account
  const is_valid = await is_authorized_to_access_file({sso_account, filename});
  if (!is_valid) {
    logger(LOG_LEVEL.WARNING, `${route}: This file ${filename} does not belong to the sso account ${sso_account}, or ${filename} is duplicated.`, memo);
    return res.status(401).json({
      message: 'This file does not belong to the sso account, or filename is duplicated.',
      status: NOTIFY_STATUS.ERROR
    });
  }

  try {
    // Use res.download to send the file to the user for download
    const file_path = await get_task_result_path(filename, file_type);
    res.download(file_path, `${filename}.${file_type.toLowerCase()}`, async (err) => {
      if (err) {
        const err_msg = err.code === 'ENOENT' ? 'File not found.' : 'Error downloading file.';
        const err_code = err.code === 'ENOENT' ? '404' : '500';
        logger(LOG_LEVEL.ERROR, `${route} ${err_msg}`, memo);
      } else {
        // Log successful operation
        logger(LOG_LEVEL.INFO, `${route} downloaded successfully.`, memo);
      }
    });
  } catch (err) {
    logger(LOG_LEVEL.ERROR, `${route}: ${err}`, memo);
  }
}


module.exports = {
  create_transcribe_task_controller,
  cancel_task_controller,
  view_all_tasks_controller,
  handle_file_download_controller
};
