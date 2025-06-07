// graceful shutdown
const { close_pool } = require('./db.js');
const { logger } = require('./logger.js');
const { LOG_LEVEL } = require('./constants.js');


async function shutdown(signal) {
  logger(LOG_LEVEL.INFO, `\nCaught ${signal} signal. Shutting down gracefully...`);
  try {
    await close_pool(); 
  } catch (err) {
    logger(LOG_LEVEL.ERROR, `Error during shutdown: ${err}`);
  }
  process.exit(0);
}

module.exports = shutdown;
