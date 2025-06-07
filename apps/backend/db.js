// db.js - Database connection module
const sql = require('mssql');
const cfg = require('./config.js');
const { LOG_LEVEL, TASK_STATUS, NOTIFY_STATUS } = require('./constants.js');
const { TASK_QUERIES } = require('./query_constants.js');


// Create and export the connection pool
const pool_promise = new sql.ConnectionPool(cfg.sql_config)
  .connect()
  .then(pool => {
    console.log('Database connected successfully');
    // logger(LOG_LEVEL.INFO, 'Database connected successfully');
    // console.log(generate_timestamp() + ` - INFO - [${process.pid}] Database connected successfully.`);
    return pool;
  })
  .catch(err => {
    console.error('Database connection failed:', err);
    // logger(LOG_LEVEL.ERROR, `Database connection failed: ${err}`);
    // console.error(generate_timestamp() + ` - ERROR - [${process.pid}] Database connection failed: ${err}`);
    throw err;
  });



async function retry(fn, retries = 3, delay = 1000) {
  while (retries > 0) {
    try {
      return await fn();
    } catch (err) {
      retries--;
      console.warn(`Retrying DB connection... (${retries} retries left)`);
      if (retries === 0) throw err;
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}

let pool_promise_rev = null;

async function get_pool() {
  if (!pool_promise_rev) {
    pool_promise_rev = await retry(() => new sql.ConnectionPool(cfg.sql_config).connect());
    console.log('Database connected and cached.');
  }
  return pool_promise_rev;
}

async function close_pool() {
  if (pool_promise_rev) {
    await pool_promise_rev.close();
    console.log('Database pool closed.');
    pool_promise_rev = null;
  }
}

sql.on('error', (err) => {
  console.error('MSSQL global error:', err);
});


async function log_operation_to_db(data) {
  /* Query syntax */
  const query_log_operation = TASK_QUERIES.ACCESS_OPERTION.LOG_OPERATION;
  const query_log_operation_error = TASK_QUERIES.ACCESS_OPERTION.LOG_OPERATION_ERROR;

  try {
    const pool = await pool_promise;
    await pool.request()
      .input('token', sql.NVarChar, data.token || '')
      .input('ip_address', sql.NVarChar, data.ip_address || '')
      .input('sso_account', sql.NVarChar, data.sso_account || '')
      .input('query_time', sql.NVarChar, data.query_time || '')
      .input('process_id', sql.NVarChar, data.process_id || '')
      .input('code', sql.NVarChar, data.code || '')
      .input('route', sql.NVarChar, data.route || '')
      .input('ref', sql.BigInt, data.ref)
      .input('log', sql.NVarChar, data.log || '')
      .query(query_log_operation);
  } catch (err) {
    const pool = await pool_promise;
    await pool.request()
      .input('token', sql.NVarChar, data.token || '')
      .input('ip_address', sql.NVarChar, data.ip_address || '')
      .input('sso_account', sql.NVarChar, data.sso_account || '')
      .input('query_time', sql.NVarChar, data.query_time || '')
      .input('process_id', sql.NVarChar, data.process_id || '')
      .input('code', sql.NVarChar, data.code || '-1')
      .input('route', sql.NVarChar, data.route || '')
      .input('ref', sql.BigInt, data.ref)
      .input('err', sql.NVarChar, err || '')
      .query(query_log_operation_error);
    console.error(`[${process.pid}] log_operation: data write failed ${err}.`);
  }
}

module.exports = {
  // sql_db,
  pool_promise,
  log_operation_to_db,
  get_pool,
  close_pool
};

