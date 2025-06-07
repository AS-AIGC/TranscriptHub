const sql = require('mssql');
const { exec } = require('child_process');
const fs = require('fs')
const path = require('path');

const cfg = require('../config.js');
const { logger } = require('../logger.js');
const { pool_promise, get_pool } = require('../db.js');

const { 
  get_worker_pids, 
  set_worker_pids, 
  add_worker_pid, 
  remove_worker_pid,
  operation_memo
} = require('../shared.js');

const { LOG_LEVEL, NOTIFY_STATUS, TASK_STATUS } = require('../constants.js');
const { TASK_QUERIES } = require('../query_constants.js');

const { __MSSQL_TEST__ } = require('../env.js');

/**
 * @brief Create new transcription task in database
 *
 * @param data [in] Task creation parameters:
 *   - label:            Task label/name
 *   - original_filename Original uploaded filename
 *   - new_filename     System assigned filename
 *   - status          Initial task status
 *   - route           API endpoint route
 *   - pid            Process ID handling task
 *   - sso_account    User account
 *   - file_size      File size in bytes
 *   - diarize        Speaker diarization flag
 *   - duration       Media duration in seconds
 *
 * @return Task OBJID if successful
 * @throws Error if creation fails or no record found
 *
 * Operation Flow:
 * 1. Insert task record
 * 2. Query inserted record by filename
 * 3. Log creation with task details
 *
 * @note Creates ISO string timestamp for logging
 * @note Throws error if inserted record not found
 */
async function create_task(data) {
  const query_insert_task = TASK_QUERIES.CREATE_TASK.INSERT_TASK;
  const query_get_task_by_filename = TASK_QUERIES.CREATE_TASK.GET_TASK_BY_FILENAME;
  try {
    //const pool = await pool_promise;
    const pool = await get_pool();
    await pool.request()
      .input('label', sql.NVarChar, data.label)
      .input('original_filename',sql.NVarChar, data.original_filename)
      .input('new_filename', sql.NVarChar, data.new_filename)
      .input('status', sql.INT, data.status)
      .input('route', sql.NVarChar, data.route)
      .input('pid', sql.INT, data.pid)
      .input('sso_account', sql.NVarChar, data.sso_account)
      .input('file_size', sql.INT, data.file_size)
      .input('diarize', sql.INT, data.diarize)
      .input('duration', sql.FLOAT, data.duration)
      .query(query_insert_task);

    // Get created task
    const result = await pool.request()
      .input('filename', sql.NVarChar, data.new_filename)
      .query(query_get_task_by_filename);
      // .query(`SELECT * FROM TASK WHERE FILENAME=@filename`);

      // Validate query result
      if (!result || !result.recordset) {
        throw new Error('Invalid query result structure');
      }

      if (result.recordset.length === 0) {
        throw new Error('No record found after insert');
      }
      
      if (result.recordset.length > 1) {
        throw new Error(`Duplicate records found for filename ${data.new_filename}`);
      }
  
      // Log success and return task ID
      const task = result.recordset[0];
      task.CREATE_AT = new Date(task.CREATE_AT).toISOString();
      
      logger(LOG_LEVEL.INFO, `Task ${task.OBJID} created successfully`);
      logger(LOG_LEVEL.INFO_TABLE, task);
      
      return task.OBJID;  
  } catch (err) {
    logger(LOG_LEVEL.ERROR, `create_task failed ${err}.`);
    throw err;
  }
}

/**
 * @brief Select next available task for processing
 * 
 * @return Task record or null if no task available
 * 
 * Selection Logic:
 * 1. No running tasks (STATUS=1) in system
 * 2. Task status is NEW(0) or RETRY(-2,-3)
 * 3. Task not finished and has content
 * 4. Prioritize NEW tasks over RETRY
 * 
 * @note Ensures single task execution across processes
 */
async function select_task() {
  const query_select_task = TASK_QUERIES.SELECT_TASK;
  // IMPORTANT!!!!  The NOT EXISTS line ensures that even if there are multiple processes, 
  // only one process is executing at any given time, meaning if a task is in status=1, 
  // other processes will not proceed to process other tasks with status=0.  
  // SQL statment:
  // WITH T AS (
  //   SELECT * 
  //     FROM TASK
  //    WHERE (STATUS=0 AND PID = ${process.pid})
  //       OR STATUS=-2
  //       OR STATUS=-3
  // )
  // SELECT TOP 1 *
  //   FROM T
  //  WHERE NOT EXISTS (SELECT 1 FROM TASK WHERE STATUS=1)
  //    AND FINISH_AT IS NULL
  //    AND FILE_SIZE > 0
  //    AND IS_DELETE IS NULL
  //  ORDER BY 
  //   CASE WHEN STATUS=0 THEN 0 ELSE 1 END,
  //   CASE WHEN STATUS=0 THEN CREATE_AT END,
  //   CASE WHEN STATUS=-2 OR STATUS=-3 THEN RETRY END;
  // 

  try {
    // const pool = await pool_promise;
    const pool = await get_pool();
    const result = await pool.request()
      .input('pid', sql.Int, process.pid)
      .query(query_select_task);

    // Currently no unexecuted tasks
    if (!result.recordset.length) {
      return null;
    }

    const task = result.recordset[0];
    const memo = operation_memo({ ref: task.OBJID });
    
    task.CREATE_AT = new Date(task.CREATE_AT).toISOString();
    
    logger(LOG_LEVEL.INFO, `Task ${task.OBJID} selected for execution`, memo);
    logger(LOG_LEVEL.INFO_TABLE, task);

    return task;
  } catch (err) {
    logger(LOG_LEVEL.ERROR, `select_task ${err}.`, operation_memo({}));

    // No need to throw err, just return null or an empty array if preferred
    return null; 
  }
}    

/**
 * @brief Cancel a transcription task by ID
 *
 * @param data [in] Task cancellation parameters:
 *   - objid [BigInt] Task identifier to cancel
 *
 * @return SQL result object containing:
 *   - rowsAffected: Number of tasks cancelled
 *   - recordset: Updated task record
 *
 * @throws Error if cancellation fails
 * 
 * Operation Flow:
 * 1. Update task status to cancelled
 * 2. Set finish time to current timestamp
 * 3. Clear assigned PID
 *
 * @note Task files are not automatically deleted
 * @note Only cancels tasks that aren't completed
 */
async function cancel_task(data) {
  const query_cancel_task = TASK_QUERIES.CANCEL_TASK;
  try {
    // const pool = await pool_promise;
    const pool = await get_pool();
    const result = await pool.request()
      .input('objid', sql.BigInt, data.objid)
      .query(query_cancel_task);

    return result
  } catch (err) {
    logger(LOG_LEVEL.ERROR, `cancel_task ${err}.`);
    throw err;
  }
}

/**
 * @brief Clean up abandoned or stale tasks in the system
 * 
 * @note No input parameters - uses global worker PIDs
 * @return void - Logs results or errors
 * 
 * Operation Flow:
 * 1. Get active worker PIDs
 * 2. Build SQL query with PID filter
 * 3. Clean tasks that are:
 *    - Not finished (FINISH_AT IS NULL)
 *    - Not owned by active workers
 *    - In status NEW(0), RUNNING(1), or RETRY(-3)
 * 
 * SQL Table Parameter:
 * - In test mode: Uses table-valued parameter for PIDs
 * - In prod mode: Uses comma-separated PID list
 * 
 * @note Requires worker PIDs to be initialized
 * @note Different behavior in test vs production mode
 * @note Logs cleanup count on success
 */
async function cleanup_task() {
  let query_cleanup_task = TASK_QUERIES.CLEANUP_TASK;
  let pids_for_query = get_worker_pids().join(',');

  if (__MSSQL_TEST__) {
    pids_for_query = get_worker_pids()
      .join(',')
      .split(',')
      .map(id => parseInt(id, 10))
      .filter(Number.isFinite);
    logger(LOG_LEVEL.INFO, 'pids_for_query: ' + pids_for_query);

    // TODO: self-defined table is SQL Server CREATE TYPE IntList AS TABLE (value INT);
    const table = new sql.Table();
    table.columns.add('value', sql.Int);
    pids_for_query.forEach(pid => table.rows.add(pid));
  }

  const memo = operation_memo({});
  if (pids_for_query.length > 0) {
    if (__MSSQL_TEST__) {
      query_cleanup_task += 'AND (PID IS NULL OR PID NOT IN (SELECT value FROM @pids))';
    } else {
      query_cleanup_task += `AND (PID IS NULL OR PID NOT IN (${pids_for_query}))`;
    }
  } else {
    return logger(LOG_LEVEL.ERROR, `cleanup_task pids_for_query ${pids_for_query} is empty.`, memo);
  }

  //const memo = operation_memo({});
  try {
    //const pool = await pool_promise;
    const pool = await get_pool();
    const request = pool.request();
    if (__MSSQL_TEST__) {
      request
      .input('pid', sql.Int, process.pid)
      .input('pids', table);
    } else {
      request
      .input('pid', sql.Int, process.pid);
    }
    const result = await request.query(query_cleanup_task);
      
    if (result.rowsAffected[0] > 0) {
      logger(LOG_LEVEL.INFO, `cleanup_task clean up ${result.rowsAffected[0]} records.`, memo);
    } 
  } catch (err) {
    logger(LOG_LEVEL.ERROR, `cleanup_task ${err}.`, memo);
  }
}      

/**
 * @brief Query current status of a transcription task
 *
 * @param data [in] Task query parameters:
 *   - objid [BigInt] Task identifier to check
 *
 * @return SQL result object containing:
 *   - recordset: Task record with current status
 *   - rowsAffected: Number of records found
 * @throws Error if query fails
 *
 * @note Returns all task fields from database
 * @note Throws error instead of returning null
 */
async function check_task_status(data) {
  const query_task_status = TASK_QUERIES.CHECK_TASK_STATUS;
  try {
    //const pool = await pool_promise;
    const pool = await get_pool();
    const result = await pool.request()
      .input('objid', sql.BigInt, data.objid)
      .query(query_task_status);
      return result;
  } catch (err) {
    logger(LOG_LEVEL.ERROR, `check_task_status ${err}.`);
    throw err;
  }
}


/**
 * @brief List all transcription tasks with optional filters
 *
 * @param data [in] Query filter parameters:
 *   - label       [string] Task label filter or 'all'
 *   - sso_account [string] User account filter or 'all'
 *   - status      [number] Task status filter (-3 to 2) or undefined
 *
 * @return SQL result object containing:
 *   - recordset: Array of task records
 *   - rowsAffected: Number of tasks found
 * @return null if query fails
 *
 * Filters:
 * - Tasks created within configured days limit
 * - Optional label match
 * - Optional user account match
 * - Optional status match
 * 
 * @note Results ordered by CREATE_AT descending
 * @note Returns null instead of throwing errors
 */
async function view_all_tasks(data) {
  const { label, sso_account, status } = data;
  let query = TASK_QUERIES.VIEW_ALL_TASK;
  // Build dynamic WHERE clause
  const conditions = [];
  if (label !== 'all') conditions.push('LABEL = @LABEL');
  if (sso_account !== 'all') conditions.push('SSO_ACCOUNT = @SSO_ACCOUNT');
  if ([-3, -2, -1, 0, 1, 2].includes(status)) conditions.push('STATUS = @STATUS');
  conditions.push(`datediff(day, CREATE_AT, getdate()) < ${cfg.tasks.days_limit}`);  // Only show tasks created within the last 30 days
  conditions.push(`IS_DELETE IS NULL`);

  // Append WHERE clause if conditions exist
  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY CREATE_AT desc';

  try {
    // Get pool connection from pool_promise
    //const pool = await pool_promise;
    const pool = await get_pool();
    const request = pool.request();

    // Conditionally bind parameters
    if (label !== 'all') request.input('LABEL', sql.NVarChar, label);
    if (sso_account !== 'all') request.input('SSO_ACCOUNT', sql.NVarChar, sso_account);
    if ([-3, -2, -1, 0, 1, 2].includes(status)) request.input('STATUS', sql.Int, status);

    // Execute the query and return results
    return await request.query(query);
  } catch (err) {
    logger(LOG_LEVEL.ERROR, `view_all_tasks: ${err}`);
    return null;  // No need to throw, just return null or an empty array if preferred
  }
}

 
async function cleanup_task_() {
  //const worker_pids_array = Array.from(worker_pids);  // convert Set to Array
  
  //const pids_for_query = process_sync_worker_pids.join(','); 
  const pids_for_query = get_worker_pids().join(','); // note
  //logger(LOG_LEVEL.INFO, `PIDs: ${process_sync_worker_pids}`);


  let where_pid_clause = '';

  if (pids_for_query.length > 0) {
    where_pid_clause = `AND (PID IS NULL OR PID NOT IN (${pids_for_query}))`;
  } else {
    // where_pid_clause = `AND PID IS NULL`;
    return logger(LOG_LEVEL.ERROR, `cleanup_task pids_for_query is empty.`, memo);
  }

  // set status = UPDATE_STATUS.TERMINATED
  const query = `
    UPDATE TASK
        SET STATUS = -2,
            PID = ${process.pid},
            RETRY = RETRY - 1
      WHERE STATUS IN (0, 1, -3)
        AND FINISH_AT IS NULL
        ${where_pid_clause};
    `;
    // AND (PID IS NULL OR PID NOT IN (${pids_for_query}));
  const memo = operation_memo({});
  try {
    //const pool = await pool_promise;
    const pool = await get_pool();
    const result = await pool.request().query(query);
      
    if (result.rowsAffected[0] > 0) {
      logger(LOG_LEVEL.INFO, `cleanup_task clean up ${result.rowsAffected[0]} records.`, memo);
    } 
  } catch (err) {
    logger(LOG_LEVEL.ERROR, `cleanup_task ${err}.`, memo);
  }
}      

/**
 * @brief Update transcription task status and details
 *
 * @param data [in] Task update parameters:
 *   - objid          [BigInt] Task identifier
 *   - status         [Int] New task status (IN_PROGRESS/COMPLETED/TERMINATED/FILE_IO_ERROR)
 *   - transcribe     [Int] Transcription result flag
 *   - content_length [Int] Content size in bytes
 *   - pid           [Int] Process ID handling task
 *
 * @return void - Logs update result
 *
 * Status Updates:
 * - IN_PROGRESS:  Task being processed
 * - COMPLETED:    Task finished successfully
 * - TERMINATED:   Task cancelled or failed
 * - FILE_IO_ERROR: File operation failed
 *
 * @note Uses different SQL queries based on status
 * @note Logs status change with task ID
 */
 async function update_task(data) {
  var query = ``;
  if (data.status == TASK_STATUS.IN_PROGRESS)
    query = TASK_QUERIES.UPDATE_TASK_STATUS.IN_PROGRESS;

  if (data.status == TASK_STATUS.COMPLETED)
    query = TASK_QUERIES.UPDATE_TASK_STATUS.COMPLETED;

  if (data.status == TASK_STATUS.TERMINATED)
    query = TASK_QUERIES.UPDATE_TASK_STATUS.TERMINATED;

  if (data.status == TASK_STATUS.FILE_IO_ERROR)
    query = TASK_QUERIES.UPDATE_TASK_STATUS.FILE_IO_ERROR;
    
  try {
    //const pool = await pool_promise;
    const pool = await get_pool();

    await pool.request()
      .input('objid',sql.BigInt, data.objid)
      .input('transcribe', sql.INT, data.transcribe)
      .input('content_length', sql.INT, data.content_length)
      .input('pid', sql.INT, data.pid)
      .query(query);

    const status_name = Object.keys(TASK_STATUS).find(key => TASK_STATUS[key] == data.status);
    return logger(LOG_LEVEL.INFO, `Update the status of task ${data.objid} to ${status_name}.`);
  } catch (err) {
    logger(LOG_LEVEL.ERROR, `update_task ${err}.`);
  }
}     

/**
 * @brief Get file path for task transcription result
 *
 * @param filename  [in] Base filename without extension
 * @param file_type [in] Output format (TXT/SRT/VTT/TSV/JSON)
 * @return Full path to result file
 * @throws Error if file does not exist
 *
 * Supported Types:
 * - TXT: Plain text transcript
 * - SRT: SubRip subtitle format
 * - VTT: WebVTT subtitle format
 * - TSV: Tab-separated values
 * - JSON: Structured data format
 *
 * @note Uses paths defined in config.js
 * @note Extensions are forced to lowercase
 */
async function get_task_result_path(filename, file_type) {
  // Define paths for each file type in the configuration
  const download_paths = {
    TXT: 'transcribe_txt_path',
    SRT: 'transcribe_srt_path',
    VTT: 'transcribe_vtt_path',
    TSV: 'transcribe_tsv_path',
    JSON: 'transcribe_json_path'
  };

  const file_path = path.join(cfg.paths[download_paths[file_type]], `${filename}.${file_type.toLowerCase()}`);

  if (!fs.existsSync(file_path)) {
    throw new Error(`The file ${file_path} does not exist.`);
  }

  return file_path;
}

module.exports = {
  create_task,
  select_task,
  cancel_task,
  view_all_tasks,
  cleanup_task,
  check_task_status,
  update_task,
  get_task_result_path
};
