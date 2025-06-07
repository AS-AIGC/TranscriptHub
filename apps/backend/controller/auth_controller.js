/**
 * @file auth_controller.js
 * @brief Authorization controller for file and task access
 *
 * Provides functions to verify user authorization:
 * - File access verification by SSO account and filename
 * - Task access verification by SSO account and task ID
 *
 * Database Operations:
 * - Queries TASK table for access validation
 * - Uses SQL Server connection pool
 *
 * @requires mssql
 * @requires ../db.js
 * @requires ../logger.js
 * @requires ../constants.js
 * @requires ../query_constants.js
 *
 * @exports is_authorized_to_access_file
 * @exports is_authorized_to_access_task
 *
 * @note All functions are async and return boolean
 * @note Errors are logged but not propagated
 */
const sql = require('mssql');
const { logger } = require('../logger.js');
const { LOG_LEVEL } = require('../constants.js');
const { TASK_QUERIES } = require('../query_constants.js');

const { pool_promise, get_pool } = require('../db.js');

async function is_authorized_to_access_file(data) {
  const query = TASK_QUERIES.AUTH_CONTROLLER.IS_AUTHORIZED_TO_ACCESS_FILE;
  try {
    //const pool = await pool_promise;
    const pool = await get_pool();
    const result = await pool.request()
      .input('sso_account', sql.NVarChar, data.sso_account)
      .input('filename', sql.NVarChar, data.filename)
      .query(query);

    return result.recordset.length === 1;  // true or false
  } catch (err) {
    logger(LOG_LEVEL.ERROR, `is_authorized_to_access_file query failed ${err}.`);
  }
}

async function is_authorized_to_access_task(data) {
  const query = TASK_QUERIES.AUTH_CONTROLLER.IS_AUTHORIZED_TO_ACCESS_TASK;
  try {
    const pool = await pool_promise;
    const result = await pool.request()
      .input('task_objid', sql.BigInt, data.task_objid)
      .input('sso_account', sql.NVarChar, data.sso_account)
      .query(query);

    return result.recordset.length ===1;  // true or false
  } catch (err) {
    logger(LOG_LEVEL.ERROR, `is_authorized_to_access_task query failed ${err}.`);
  }
}

module.exports = {
  is_authorized_to_access_file,
  is_authorized_to_access_task
};
