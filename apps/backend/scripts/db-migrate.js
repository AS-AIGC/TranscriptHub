const sql = require("mssql");
const cfg = require("../config.js");

function qident(name) {
  return `[${String(name).replaceAll("]", "]]")}]`;
}

async function scalar(pool, query) {
  const result = await pool.request().query(query);
  if (!result.recordset?.length) return null;
  const firstRow = result.recordset[0];
  const firstKey = Object.keys(firstRow)[0];
  return firstRow[firstKey];
}

async function tableExists(pool, tableName) {
  const name = tableName.replace(/^dbo\./i, "");
  return !!(await scalar(
    pool,
    `SELECT 1
     FROM sys.tables t
     JOIN sys.schemas s ON s.schema_id=t.schema_id
     WHERE s.name='dbo' AND t.name='${name.replaceAll("'", "''")}'`
  ));
}

async function sequenceExists(pool, sequenceName) {
  const name = sequenceName.replace(/^dbo\./i, "");
  return !!(await scalar(
    pool,
    `SELECT 1
     FROM sys.sequences seq
     JOIN sys.schemas s ON s.schema_id=seq.schema_id
     WHERE s.name='dbo' AND seq.name='${name.replaceAll("'", "''")}'`
  ));
}

async function columnExists(pool, tableName, columnName) {
  const t = tableName.replace(/^dbo\./i, "");
  const c = columnName;
  return !!(await scalar(
    pool,
    `SELECT 1
     FROM sys.columns col
     JOIN sys.tables t ON t.object_id=col.object_id
     JOIN sys.schemas s ON s.schema_id=t.schema_id
     WHERE s.name='dbo' AND t.name='${t.replaceAll("'", "''")}'
       AND col.name='${c.replaceAll("'", "''")}'`
  ));
}

async function defaultExists(pool, tableName, columnName) {
  const t = tableName.replace(/^dbo\./i, "");
  const c = columnName;
  return !!(await scalar(
    pool,
    `SELECT 1
     FROM sys.default_constraints dc
     JOIN sys.columns col ON col.object_id=dc.parent_object_id AND col.column_id=dc.parent_column_id
     JOIN sys.tables t ON t.object_id=dc.parent_object_id
     JOIN sys.schemas s ON s.schema_id=t.schema_id
     WHERE s.name='dbo' AND t.name='${t.replaceAll("'", "''")}'
       AND col.name='${c.replaceAll("'", "''")}'`
  ));
}

async function ensureColumn(pool, tableName, spec) {
  if (await columnExists(pool, tableName, spec.name)) return;
  const nullSql = spec.nullable ? "NULL" : "NOT NULL";
  const defaultSql = spec.default ? ` CONSTRAINT ${qident(spec.defaultName || `DF_${tableName}_${spec.name}`)} DEFAULT ${spec.default}` : "";
  const query = `ALTER TABLE dbo.${qident(tableName)} ADD ${qident(spec.name)} ${spec.type} ${nullSql}${defaultSql};`;
  await pool.request().query(query);
  console.log(`Added column dbo.${tableName}.${spec.name}`);
}

async function ensureDefault(pool, tableName, columnName, defaultExpr) {
  if (await defaultExists(pool, tableName, columnName)) return;
  const dfName = `DF_${tableName}_${columnName}`;
  const query = `ALTER TABLE dbo.${qident(tableName)} ADD CONSTRAINT ${qident(dfName)} DEFAULT ${defaultExpr} FOR ${qident(columnName)};`;
  await pool.request().query(query);
  console.log(`Added default dbo.${tableName}.${columnName} = ${defaultExpr}`);
}

async function ensureTable(pool, tableName, createSql, columnsToEnsure = []) {
  if (!(await tableExists(pool, tableName))) {
    await pool.request().query(createSql);
    console.log(`Created table dbo.${tableName}`);
  }
  for (const col of columnsToEnsure) {
    await ensureColumn(pool, tableName, col);
  }
}

async function migrate() {
  const pool = await sql.connect(cfg.sql_config);
  try {
    const dbName = process.env.DB_NAME;
    if (!dbName) throw new Error("Missing DB_NAME in environment.");
    await pool.request().query(`USE ${qident(dbName)};`);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      // Sequence
      if (!(await sequenceExists(tx, "hibernate_sequence"))) {
        await tx.request().query(`
          CREATE SEQUENCE [dbo].[hibernate_sequence]
           AS [bigint]
           START WITH 10000000
           INCREMENT BY 1
           MINVALUE -9223372036854775808
           MAXVALUE 9223372036854775807
           CACHE;
        `);
        console.log("Created sequence dbo.hibernate_sequence");
      }

      // ACCESS_OPERATION
      await ensureTable(
        tx,
        "ACCESS_OPERATION",
        `
          CREATE TABLE [dbo].[ACCESS_OPERATION](
            [OBJID] [bigint] IDENTITY(1,1) NOT NULL,
            [CREATE_AT] [datetime2](7) NULL,
            [TOKEN] [nvarchar](256) NULL,
            [IP_ADDRESS] [nvarchar](64) NULL,
            [QUERY_TIME] [nvarchar](32) NULL,
            [PROCESS_ID] [int] NULL,
            [CODE] [nvarchar](20) NULL,
            [SSO_ACCOUNT] [nvarchar](64) NULL,
            [ROUTE] [nvarchar](100) NULL,
            [REF] [bigint] NULL,
            [LOG] [nvarchar](512) NULL
          ) ON [PRIMARY];
        `,
        [
          { name: "CREATE_AT", type: "[datetime2](7)", nullable: true },
          { name: "TOKEN", type: "[nvarchar](256)", nullable: true },
          { name: "IP_ADDRESS", type: "[nvarchar](64)", nullable: true },
          { name: "QUERY_TIME", type: "[nvarchar](32)", nullable: true },
          { name: "PROCESS_ID", type: "[int]", nullable: true },
          { name: "CODE", type: "[nvarchar](20)", nullable: true },
          { name: "SSO_ACCOUNT", type: "[nvarchar](64)", nullable: true },
          { name: "ROUTE", type: "[nvarchar](100)", nullable: true },
          { name: "REF", type: "[bigint]", nullable: true },
          { name: "LOG", type: "[nvarchar](512)", nullable: true }
        ]
      );

      // ACCESS_OPERATION_ERROR
      await ensureTable(
        tx,
        "ACCESS_OPERATION_ERROR",
        `
          CREATE TABLE [dbo].[ACCESS_OPERATION_ERROR](
            [OBJID] [bigint] IDENTITY(1,1) NOT NULL,
            [CREATE_AT] [datetime2](7) NULL,
            [TOKEN] [nvarchar](max) NULL,
            [IP_ADDRESS] [nvarchar](max) NULL,
            [QUERY_TIME] [nvarchar](max) NULL,
            [PROCESS_ID] [int] NULL,
            [CODE] [nvarchar](max) NULL,
            [SSO_ACCOUNT] [nvarchar](64) NULL,
            [ROUTE] [nvarchar](100) NULL,
            [REF] [bigint] NULL,
            [ERROR] [nvarchar](max) NULL
          ) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY];
        `,
        [
          { name: "CREATE_AT", type: "[datetime2](7)", nullable: true },
          { name: "TOKEN", type: "[nvarchar](max)", nullable: true },
          { name: "IP_ADDRESS", type: "[nvarchar](max)", nullable: true },
          { name: "QUERY_TIME", type: "[nvarchar](max)", nullable: true },
          { name: "PROCESS_ID", type: "[int]", nullable: true },
          { name: "CODE", type: "[nvarchar](max)", nullable: true },
          { name: "SSO_ACCOUNT", type: "[nvarchar](64)", nullable: true },
          { name: "ROUTE", type: "[nvarchar](100)", nullable: true },
          { name: "REF", type: "[bigint]", nullable: true },
          { name: "ERROR", type: "[nvarchar](max)", nullable: true }
        ]
      );

      // TASK
      await ensureTable(
        tx,
        "TASK",
        `
          CREATE TABLE [dbo].[TASK](
            [OBJID] [bigint] IDENTITY(1,1) NOT NULL,
            [CREATE_AT] [datetime2](7) NULL,
            [ORIGINAL_FILENAME] [nvarchar](64) NULL,
            [FILENAME] [nvarchar](64) NULL,
            [STATUS] [int] NULL,
            [ROUTE] [nvarchar](100) NULL,
            [REF] [bigint] NULL,
            [FINISH_AT] [datetime2](7) NULL,
            [EXEC_AT] [datetime2](7) NULL,
            [TRANSCRIBE] [int] NULL,
            [LABEL] [nvarchar](64) NULL,
            [PID] [int] NULL,
            [SSO_ACCOUNT] [nvarchar](64) NULL,
            [FILE_SIZE] [int] NULL,
            [CONTENT_LENGTH] [int] NULL,
            [DIARIZE] [int] NOT NULL,
            [RETRY] [int] NOT NULL,
            [DURATION] [float] NULL,
            [IS_DELETE] [int] NULL
          ) ON [PRIMARY];
        `,
        [
          { name: "CREATE_AT", type: "[datetime2](7)", nullable: true },
          { name: "ORIGINAL_FILENAME", type: "[nvarchar](64)", nullable: true },
          { name: "FILENAME", type: "[nvarchar](64)", nullable: true },
          { name: "STATUS", type: "[int]", nullable: true },
          { name: "ROUTE", type: "[nvarchar](100)", nullable: true },
          { name: "REF", type: "[bigint]", nullable: true },
          { name: "FINISH_AT", type: "[datetime2](7)", nullable: true },
          { name: "EXEC_AT", type: "[datetime2](7)", nullable: true },
          { name: "TRANSCRIBE", type: "[int]", nullable: true },
          { name: "LABEL", type: "[nvarchar](64)", nullable: true },
          { name: "PID", type: "[int]", nullable: true },
          { name: "SSO_ACCOUNT", type: "[nvarchar](64)", nullable: true },
          { name: "FILE_SIZE", type: "[int]", nullable: true },
          { name: "CONTENT_LENGTH", type: "[int]", nullable: true },
          { name: "DIARIZE", type: "[int]", nullable: false, default: "((0))" },
          { name: "RETRY", type: "[int]", nullable: false, default: "((0))" },
          { name: "DURATION", type: "[float]", nullable: true },
          { name: "IS_DELETE", type: "[int]", nullable: true }
        ]
      );

      await ensureDefault(tx, "TASK", "DIARIZE", "((0))");
      await ensureDefault(tx, "TASK", "RETRY", "((0))");

      await tx.commit();
    } catch (e) {
      try {
        await tx.rollback();
      } catch {}
      throw e;
    }

    console.log("DB migration completed.");
  } finally {
    await sql.close();
  }
}

migrate().catch((err) => {
  console.error("DB migration failed:", err);
  process.exitCode = 1;
});
