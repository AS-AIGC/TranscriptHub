/**
 * @file query_constants.js
 * @brief SQL query templates for task operations
 * @module TASK_QUERIES
 */

const TASK_QUERIES = {
  CREATE_TASK: {
      INSERT_TASK: `
          SET IDENTITY_INSERT TASK ON;
          INSERT INTO TASK (
              [OBJID], [CREATE_AT], [ORIGINAL_FILENAME],
              [FILENAME], [STATUS], [ROUTE], [LABEL],
              [PID], [SSO_ACCOUNT], [FILE_SIZE], [DIARIZE],
              [DURATION]
          )
          VALUES (
              next value for hibernate_sequence+power(2,28),
              getdate(), @original_filename, @new_filename,
              @status, @route, @label, @pid,
              @sso_account, @file_size, @diarize, @duration
          );
          SET IDENTITY_INSERT TASK OFF;
      `,
      GET_TASK_BY_FILENAME: `
        SELECT * FROM TASK WHERE FILENAME=@filename
      `
  },

  SELECT_TASK: `
      WITH T AS (
          SELECT * 
          FROM TASK
          WHERE (STATUS=0 AND PID=@pid)
              OR STATUS=-2
              OR STATUS=-3
      )
      SELECT TOP 1 *
      FROM T
      WHERE NOT EXISTS (SELECT 1 FROM TASK WHERE STATUS=1)
          AND FINISH_AT IS NULL
          AND FILE_SIZE > 0
          AND IS_DELETE IS NULL
      ORDER BY 
          CASE WHEN STATUS=0 THEN 0 ELSE 1 END,
          CASE WHEN STATUS=0 THEN CREATE_AT END,
          CASE WHEN STATUS=-2 OR STATUS=-3 THEN RETRY END;
  `,

  CANCEL_TASK: `
      UPDATE TASK 
      SET IS_DELETE = 1 
      OUTPUT INSERTED.FILENAME
      WHERE OBJID = @objid
  `,

  CLEANUP_TASK: `
      UPDATE TASK
      SET STATUS = -2,
          PID = @pid,
          RETRY = RETRY - 1
      WHERE STATUS IN (0, 1, -3)
          AND FINISH_AT IS NULL
  `,

  VIEW_ALL_TASK: `
      SELECT OBJID
      ,LABEL
      ,SSO_ACCOUNT
      ,STATUS
      ,CREATE_AT
      ,EXEC_AT
      ,FINISH_AT
      ,ORIGINAL_FILENAME
      ,FILENAME
      ,FILE_SIZE
      ,TRANSCRIBE
      ,CONTENT_LENGTH
      ,DURZATION
    FROM TASK
  `,

  CHECK_TASK_STATUS: `
      SELECT STATUS
      FROM TASK
      WHERE OBJID=@objid
  `,

  UPDATE_TASK_STATUS: {
      IN_PROGRESS: `
          UPDATE TASK 
          SET STATUS=1,
              EXEC_AT=GETDATE(),
              PID=@pid
          WHERE OBJID=@objid;
      `,
      COMPLETED: `
          UPDATE TASK 
          SET STATUS=2,
              FINISH_AT=GETDATE(),
              TRANSCRIBE=@transcribe,
              CONTENT_LENGTH=@content_length
          WHERE OBJID=@objid;
      `,
      TERMINATED: `
          UPDATE TASK
          SET STATUS=-2
          WHERE OBJID=@objid;
      `,
      FILE_IO_ERROR: `
          UPDATE TASK
          SET STATUS=-3
          WHERE OBJID=@objid;
      `
  },

  ACCESS_OPERTION: {
      LOG_OPERATION: `
          SET IDENTITY_INSERT ACCESS_OPERATION ON;
          INSERT INTO ACCESS_OPERATION (
              [OBJID], [CREATE_AT], [TOKEN], [IP_ADDRESS], 
              [SSO_ACCOUNT], [QUERY_TIME], [PROCESS_ID],
              [CODE], [ROUTE], [REF], [LOG]
          )
          VALUES (
              next value for hibernate_sequence+power(2,28), 
              getdate(), @token, @ip_address, @sso_account,
              @query_time, @process_id, @code, @route,
              @ref, @log);
          SET IDENTITY_INSERT ACCESS_OPERATION OFF;
      `,
      LOG_OPERATION_ERROR: `
          SET IDENTITY_INSERT ACCESS_OPERATION_ERROR ON;
          INSERT INTO ACCESS_OPERATION_ERROR (
              [OBJID], [CREATE_AT], [TOKEN], [IP_ADDRESS], 
              [SSO_ACCOUNT], [QUERY_TIME], [PROCESS_ID],
              [CODE], [ROUTE], [REF], [ERROR]
          )
          VALUES (
              next value for hibernate_sequence+power(2,28), 
              getdate(), @token, @ip_address, @sso_account,
              @query_time, @process_id, @code, @route,
              @ref, @err);
          SET IDENTITY_INSERT ACCESS_OPERATION_ERROR OFF;
      `
  },

  AUTH_CONTROLLER: {
      IS_AUTHORIZED_TO_ACCESS_FILE: `    
          SELECT TOP 1 * 
          FROM TASK
          WHERE LEFT(SSO_ACCOUNT, CHARINDEX('@', SSO_ACCOUNT + '@') - 1) =
              LEFT(@sso_account, CHARINDEX('@', @sso_account + '@') - 1)
          AND LEFT(FILENAME, LEN(FILENAME) - CHARINDEX('.', REVERSE(FILENAME))) =
              LEFT(@filename, LEN(@filename) - CHARINDEX('.', REVERSE(@filename)))
      `,
      IS_AUTHORIZED_TO_ACCESS_TASK: `
          SELECT TOP 1 *
          FROM TASK
          WHERE OBJID=@task_objid
          AND SSO_ACCOUNT=@sso_account
      `
  }
};

module.exports = {
  TASK_QUERIES
};