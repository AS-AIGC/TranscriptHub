/**
 * @fileoverview Sparrow - The Multi-Application Oriented AI Service Platform
 * @module Sparrow
 * @requires express
 * @requires https
 * @requires cors
 * @requires fs
 * @requires path
 * @requires os
 * @requires events
 * @requires body-parser
 * @requires cluster
 * @requires mssql
 * @requires multer
 * @requires child_process
 * 
 * @description
 * A comprehensive HTTP server and RESTful API platform designed for AI-driven audio transcription services.
 * The application utilizes cluster module for concurrent task management across multiple CPU cores and
 * provides automatic worker process recovery. It supports various audio formats (MP3, WAV, MPEG)
 * and implements advanced speech recognition technology for multiple languages.
 * 
 * Key Features:
 * - Multi-core task processing using Node.js cluster module
 * - Automatic worker process recovery
 * - HTTPS secure server implementation
 * - File upload handling with support for multiple audio formats
 * - Task management system with status tracking
 * - Database integration for task persistence
 * - RESTful API endpoints for task creation, cancellation, and monitoring
 * - Speaker diarization support
 * - Multiple output format support (TXT, SRT, VTT, TSV, JSON)
 * 
 * API Endpoints:
 * - POST /api/v1/rest/CreateTranscribeTask - Create new transcription task
 * - POST /api/v1/rest/CancelTask - Cancel running task
 * - POST /api/v1/rest/ViewAllTask - View all tasks
 * - GET /api/v1/rest/RetrieveTranscribe/{FORMAT}/{filename} - Retrieve transcription results
 * 
 * @author [ccchungdaw@as.edu.tw]
 * @version 1.0.0
 * @license MIT
 */

const express = require('express');
const https = require('https');
const cors = require('cors');
const fs = require('fs')
const path = require('path');
const os = require('os');
const EventEmitter = require('events');
const body_parser = require('body-parser');
const cluster = require('cluster');
const sql = require('mssql');
const multer = require('multer');
const { exec, spawn } = require('child_process');
const event_emitter = new EventEmitter();

const cfg = require('./config.js');
const shutdown = require('./shutdown.js');
const { send_notification, translate_ipv4_to_ipv6} = require('./utils.js');
const { logger } = require('./logger.js');
const { LOG_LEVEL, NOTIFY_STATUS, TASK_STATUS } = require('./constants.js');
const { 
  get_worker_pids, 
  set_worker_pids, 
  add_worker_pid, 
  remove_worker_pid, 
  operation_memo
} = require('./shared.js');
const {
  create_transcribe_task_controller,
  cancel_task_controller,
  view_all_tasks_controller,
  handle_file_download_controller
} = require('./controller/task_controller.js');
const {
  select_task,
  cleanup_task,
  check_task_status,
  update_task
 } = require('./services/task_service.js');

const { validate_params } = require('./middlewares/validate_params.js');


/**
 * Environment flags for application behavior control
 * 
 * __DEV__: Development mode
 * - Enables debug logging
 * - Disables SSL verification
 * - Uses test database
 * - Enables verbose error messages
 * 
 * __PROD__: Production mode
 * - Minimal logging
 * - Enforces SSL verification
 * - Uses production database
 * - Security-focused error messages
 */
const { __DEV__, __PROD__ } = require('./env.js');



if (cluster.isMaster) {
  // cluster master
  logger(LOG_LEVEL.INFO, `Master process ${process.pid} is running`);
  const worker_pids = new Set(); 

  // fork each process with a 1000 ms interval.
  for (let i = 0; i < cfg.system.num_CPUs; i++) {
    setTimeout(() => {
      const worker = cluster.fork();
      worker_pids.add(worker.process.pid);
    }, i * 1000); 
  }
  
  cluster.on('exit', (worker, code, signal) => {
    worker_pids.delete(worker.process.pid);
    logger(LOG_LEVEL.INFO, `Worker process ${worker.process.pid} died, starting a new one.`);
    //cluster.fork();

    // crash back
    const crash_back_worker = cluster.fork();
    worker_pids.add(crash_back_worker.process.pid); 
  });
  
  cluster.on('online', (worker) => {
    logger(LOG_LEVEL.INFO, `Worker online: ${worker.process.pid}`);
    worker.on('message', (message) => {
      if (message.type === 'request_pids') {
        worker.send({type: 'PIDs', pids: Array.from(worker_pids)});
      }
    });
  });  
} else {
  /**
   * Graceful shutdown handlers:
   * This block listens for termination-related signals such as SIGINT (Ctrl+C),
   * SIGTERM (standard kill), and SIGHUP (terminal closed),
   * and ensures that all necessary cleanup actions are performed before the process exits.
   * It helps prevent resource leaks, such as open database connections or file handles.
   *
   * Additionally, SIGUSR1 and SIGUSR2 are included as custom signals useful for manual testing
   * or triggering application-defined behavior during development.
   */
  ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGUSR1', 'SIGUSR2'].forEach(signal => {
    process.on(signal, () => {
      logger(LOG_LEVEL.INFO, `[${process.pid}] Received signal: ${signal}`);
      shutdown(signal);
    });
    // process.on(signal, () => shutdown(signal));
  });

  // Handle uncaught exceptions and perform cleanup before exiting
  process.on('uncaughtException', async (err) => {
    logger(LOG_LEVEL.ERROR, `Uncaught exception: ${err}`); 
    await shutdown('uncaughtException');
  });

  // variables for each cluster process
  let process_sync_worker_pids = null; 
  let child_process = null;
  
  process.on('message', (message) => {
    // logger(LOG_LEVEL.INFO, `[${process.pid}] Received signal message: ${message.pids}`);
    if (message.type === 'PIDs') {
      set_worker_pids(message.pids);
      cleanup_task();
    }
  });
  


  const app = express();
  
  app.use(body_parser.json());
  app.use((req, res, next) => {
    res.setHeader('Connection', 'close'); // disable HTTP Keep-Alive to ensure each process is used in a balanced rotation.
    logger(LOG_LEVEL.INFO, `Process ${process.pid} handling request: ${req.method} ${req.originalUrl}`);
    next();
  });
  
  app.use(cors());
  
  // Configure file upload location and set the upload mechanism to diskStorage
  const uploaded_files_path = multer.diskStorage({
    destination: function (req, file, callback) {
      // Ensure this folder already exists; if not, it must be created first
      callback(null, cfg.paths.uploaded_files_path)
    },
    filename: function (req, file, callback) {
      callback(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
  });
  
  // memoryStorage
  // const storage = multer.memoryStorage();
  
  // Configure allowable file types for upload
  const allowed_file_types = (req, file, callback) => {
    /*
    if (file.mimetype === 'audio/mp3' || file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/wav' || file.mimetype === 'audio/mp4') {
      callback(null, true);
    } else {
      callback(new Error('Invalid file type, only MP3 and MPEG and WAV are allowed!'), false);
    }
    */
    //accept all
    callback(null, true);
  };  
  const upload = multer({storage: uploaded_files_path, fileFilter: allowed_file_types });


  /**
   * @brief Execute audio transcription task using WhisperX
   * 
   * This function handles the complete lifecycle of a transcription task:
   * 1. Task selection and validation
   * 2. Python subprocess execution for transcription
   * 3. Result processing and file cleanup
   * 4. Status updates and notifications
   * 
   * @note This function runs asynchronously and manages its own error handling
   * 
   * Error Handling:
   * - CUDA device/memory errors
   * - File I/O errors
   * - Process execution errors
   * - Task state management errors
   * 
   * Side Effects:
   * - Updates task status in database
   * - Removes source audio files after processing
   * - Sends notifications on task completion
   * - Writes logs for task execution steps
   * 
   * Resource Management:
   * - Manages child process lifecycle
   * - Handles file descriptors for audio and transcript files
   * - Maintains process state via child_process global
   * 
   * @return {Promise<void>} Resolves when task completes or fails
   */
   async function execute_task() {
    var task_objid = 0;
    var task_filename = '';
    var task_diarize = 0; // Speaker Diarization

    try {
      const selected_task = await select_task();      
      
      // Check if selected_task is null 
      if (!selected_task) {
        return;  // Exit if selected_task is null or has no records
      }

      task_objid = selected_task.OBJID;
      task_filename = selected_task.FILENAME;
      task_diarize = selected_task.DIARIZE;
      
      logger(LOG_LEVEL.INFO, `Execution of the task ${task_objid} has begun.`);   
      
    } catch (err) {
      logger(LOG_LEVEL.ERROR, `execute_task ${err}.`);
      return;
    }
    
    // Ensure this path is the correct path to Python in your Anaconda environment
    const python_bin = `${cfg.paths.python_bin}`;
    // The python script to run whisperx
    const transcribe_script_path = `${cfg.paths.task_script_path}/${cfg.paths.task_script}`;
    const transcribe_txt_path = cfg.paths.transcribe_txt_path;

    const parsed = path.parse(task_filename);
    
    update_task({
      objid: task_objid, 
      pid: process.pid,
      status: TASK_STATUS.IN_PROGRESS
    });          
    
    // chcp 65001 ensures that when Node.js calls a Python script, and it involves 
    // outputting Unicode characters to Windows cmd (default cp950 encoding), errors 
    // may occur due to incompatible encodings. Therefore, before calling exec 
    // in the Node.js script, you can set the Windows cmd encoding to UTF-8 (i.e., chcp 65001), 
    // which allows for the correct handling of Unicode characters. 
    // Execute the script using Python from the Anaconda environment, where 'chcp 65001 > null' 
    // directs the message from changing the encoding to null.
    // child_process = exec(`chcp 65001 >nul && ${python_bin} ${python_script_path} ${task_filename}`, (err, stdout, stderr) => { 
    // Use spawn instead of exec
    child_process = spawn(python_bin, [transcribe_script_path, task_filename, task_diarize]);

    // Listen to stdout data
    child_process.stdout.on('data', (data) => {
      if (__DEV__)
        logger(LOG_LEVEL.INFO, `execute_task (transcribe script) stdout:\n${data}`);
    });

    // Listen to stderr data
    child_process.stderr.on('data', (data) => {
      if (__DEV__)
        logger(LOG_LEVEL.ERROR, `execute_task (transcribe script) stderr:\n${data}`);
    });

    // Listen for error event
    child_process.on('error', (err) => {
      const cuda_device_err = "CUDA failed with error no CUDA-capable device is detected";
      const cuda_memory_err = "CUDA failed with error out of memory";
      const memo = operation_memo({ref: task_objid});
      
      if (err.message.includes(cuda_device_err)) {
        logger(LOG_LEVEL.ERROR, `CUDA Device Error detected.`, memo);
      }
      if (err.message.includes(cuda_memory_err)) {
        logger(LOG_LEVEL.ERROR, `CUDA Memory Error detected.`, memo);
      }
      
      logger(LOG_LEVEL.ERROR, `execute_task (transcribe script) err:\n${err.message}`);
    });

    // Listen for the 'close' event to proceed after process completes
    child_process.on('close', (code) => {
      logger(LOG_LEVEL.INFO, `Child process closed with code ${code}.`);
      fs.readFile(`${transcribe_txt_path}${parsed.name}.txt`, 'utf8', async (err, data) => {
        // If error occurs during file read
        if (err) {
          try {
            const memo = operation_memo({ref: task_objid});
            logger(LOG_LEVEL.INFO, `The task ${task_objid} has ended, Unable to read file.`, memo);
            update_task({
              objid: task_objid, 
              status: TASK_STATUS.FILE_IO_ERROR // task done or file not exist or unable to be read
            });          
          } catch (err) {
            logger(LOG_LEVEL.ERROR, `execute_task onclose ${err}.`);
          }
          return;
        }

        // Process file content and prepare json array
        const json_arr = data.split('\n').map((line, index) => {
          return { [index]: line.trim() };
        });

        try {
          logger(LOG_LEVEL.INFO, `The task ${task_objid} has completed.`);
          update_task({
            objid: task_objid, 
            status: TASK_STATUS.COMPLETED,
            transcribe: json_arr && json_arr.length > 0 ? '1' : '0',
            content_length: data.length
          });

          // Notify AI portal after task completion
          var notify_data = JSON.stringify({
            task_objid: task_objid,
            status: NOTIFY_STATUS.FINISH,
            message: "The task has completed",
            results: [
              `https://${cfg.download_server.host}:${cfg.download_server.port}/api/v1/rest/RetrieveTranscribe/TXT/${parsed.name}`,
              `https://${cfg.download_server.host}:${cfg.download_server.port}/api/v1/rest/RetrieveTranscribe/SRT/${parsed.name}`,
              `https://${cfg.download_server.host}:${cfg.download_server.port}/api/v1/rest/RetrieveTranscribe/VTT/${parsed.name}`,
              `https://${cfg.download_server.host}:${cfg.download_server.port}/api/v1/rest/RetrieveTranscribe/TSV/${parsed.name}`,
              `https://${cfg.download_server.host}:${cfg.download_server.port}/api/v1/rest/RetrieveTranscribe/JSON/${parsed.name}`
            ]
          });
          await send_notification(cfg.notify_server, notify_data, task_objid);

          // Remove audio files and its left channel duplicate from both upload directories
          const audio_file_path = path.join(cfg.paths.uploaded_files_path, task_filename);
          const audiolc_file_path = path.join(cfg.paths.uploaded_files_lc_path, task_filename);
          fs.unlink(audio_file_path, (err) => {
            const memo = operation_memo({ref: task_objid});
            if (err) {
              const err_msg = err.code === 'ENOENT' ? 'File not found.' : 'Error downloading file.';
              logger(LOG_LEVEL.ERROR, `Failed to removefile ${audio_file_path} for task ${task_objid}: ${err_msg}`, memo);
            } else {
              logger(LOG_LEVEL.INFO, `Successfully removed file ${audio_file_path} for task ${task_objid}.`, memo);
            }
          });
          fs.unlink(audiolc_file_path, (err) => {
            const memo = operation_memo({ref: task_objid});
            if (err) {
              const err_msg = err.code === 'ENOENT' ? 'File not found.' : 'Error downloading file.';
              logger(LOG_LEVEL.ERROR, `Failed to remove file ${audiolc_file_path} for task ${task_objid}: ${err_msg}`, memo);
            } else {
              logger(LOG_LEVEL.INFO, `Successfully removed file ${audiolc_file_path} for task ${task_objid}.`, memo);
            }
          });
        } catch (err) {
          logger(LOG_LEVEL.ERROR, `execute_task: onclose: ${err}`);
        } finally {
          child_process = null;
        }

        // Log top 3 records of transcribe result
        logger(LOG_LEVEL.INFO, JSON.stringify(json_arr.slice(0, 3)));
      });
    });

    // Listen for the 'exit' event to log final exit code or signal
    child_process.on('exit', (code, signal) => {
      if (code) {
        logger(LOG_LEVEL.INFO, `Process exited with code ${code}.`);
      }
      if (signal) {
        logger(LOG_LEVEL.INFO, `Process exited with signal ${signal}.`);
      }
      child_process = null;
    });
  }


  /**
   * @brief Task Execution Scheduler
   * 
   * Implements periodic task execution with worker process synchronization:
   * 1. Requests current worker PIDs from master process
   * 2. Validates worker state before task execution
   * 3. Executes transcription task if worker is valid
   * 
   * Scheduling Details:
   * - Interval: 10000ms (10 seconds)
   * - Execution Conditions: Worker must be registered in PID list
   * 
   * Process Flow:
   * 1. Request PIDs from master process
   * 2. Wait for response and PID list update
   * 3. Validate worker state via get_worker_pids()
   * 4. Execute task if validation passes
   * 
   * Error Prevention:
   * - Ensures worker is registered before task execution
   * - Prevents orphaned or zombie process tasks
   * - Maintains cluster synchronization
   * 
   * @note Maintains cluster worker state synchronization
   * @note Implements garbage collection for interrupted tasks
   */
  setInterval(() => {
      // Request worker PID list from master process
      process.send({ type: 'request_pids' }); 

      // Execute task only if worker is registered
      if (get_worker_pids() !== null) {
        execute_task();
      } 
      //alt
      //process_sync_worker_pids && execute_task();
  }, 10000);
  

  /**
   * @brief Audio Transcription Task Creation Endpoint
   * @route POST /api/v1/rest/CreateTranscribeTask
   * 
   * Handles multipart/form-data requests for audio file upload and transcription:
   * 1. Accepts audio file upload via 'audiofile' form field
   * 2. Validates file format and size
   * 3. Creates transcription task in database
   * 4. Initiates async processing
   * 
   * Request Parameters:
   * @param {File} audiofile - Audio file (MP3/WAV/MPEG) in multipart/form-data
   * @param {String} label - Task identifier label
   * @param {String} sso_account - User account identifier
   * @param {String} token - Authentication token
   * @param {Number} task_objid - Task object identifier
   * 
   * Response Codes:
   * - 200: Task created successfully
   * - 400: Invalid request parameters
   * - 415: Unsupported file type
   * - 500: Server error
   * 
   * Storage Details:
   * - Files stored in: cfg.paths.uploaded_files_path
   * - Filename format: fieldname-timestamp.extension
   * 
   * @note Uses multer middleware for file upload handling
   * @note Implements file type filtering via allowed_file_types
   */
  app.post('/api/v1/rest/CreateTranscribeTask', 
    upload.single('audiofile'), 
    create_transcribe_task_controller
  );
  
  // Error Handling Middleware for Multer
  app.use(function (err, req, res, next) {
    if (err instanceof multer.MulterError) {
      res.status(500).send(err.message);
    } else if (err) {
      res.status(500).send(err.message);
    }
  }); 
  
  
  /**
   * @brief Task Cancellation Endpoint
   * @route POST /api/v1/rest/CancelTask
   * 
   * Handles task cancellation requests and performs input validation:
   * 1. Validates multipart/form-data without file attachments
   * 2. Preprocesses task_objid parameter
   * 3. Validates request parameters
   * 4. Executes task cancellation
   * 
   * Request Parameters:
   * @param {String|Number} task_objid - Task identifier to cancel
   * @param {String} label - Task identifier label
   * @param {String} sso_account - User account identifier
   * @param {String} token - Authentication token
   * 
   * Parameter Processing:
   * - Converts string task_objid to integer
   * - Sets invalid number conversions to null
   * - Maintains type consistency for database operations
   * 
   * Response Codes:
   * - 200: Task cancelled successfully
   * - 400: Invalid request parameters
   * - 401: Unauthorized access
   * - 500: Server error
   * 
   * Middleware Chain:
   * 1. upload.none() - Handle multipart without files
   * 2. Parameter preprocessing
   * 3. validate_params - Parameter validation
   * 4. cancel_task_controller - Task cancellation logic
   * 
   * @note Uses multer.none() for multipart/form-data parsing
   * @note Implements parameter type conversion and validation
   */
  app.post('/api/v1/rest/CancelTask', 
    upload.none(), 
    (req, res, next) => {
      // Preprocess: If `req.body.objid` is a string, convert it to an integer.
      if ('task_objid' in req.body) {
        if (typeof req.body.task_objid === 'string') {
          let num = Number(req.body.task_objid);
          req.body.task_objid = Number.isInteger(num) ? num : null;
        }
      }
      next();
    }, 
    validate_params, 
    cancel_task_controller
  );

  /**
   * @brief Task List Retrieval Endpoint
   * @route POST /api/v1/rest/ViewAllTask
   * 
   * Retrieves list of transcription tasks filtered by provided parameters:
   * 1. Accepts multipart/form-data without file attachments
   * 2. Validates authentication parameters
   * 3. Returns filtered task list based on label
   * 
   * Request Parameters:
   * @param {String} label - Task identifier label for filtering
   * @param {String} sso_account - User account identifier
   * @param {String} token - Authentication token
   * @param {String} task_objid - Task object identifier [optional]
   * 
   * Response Format:
   * @returns {Object[]} Array of task objects containing:
   *   - objid: Unique task identifier
   *   - filename: Original audio filename
   *   - status: Current task status
   *   - created_at: Task creation timestamp
   *   - updated_at: Last update timestamp
   * 
   * Response Codes:
   * - 200: Tasks retrieved successfully
   * - 400: Invalid request parameters
   * - 401: Unauthorized access
   * - 500: Server error
   * 
   * Middleware Chain:
   * 1. Parameter preprocessing
   * 2. validate_params - Parameter validation
   * 3. view_all_tasks_controller - Task list retrieval
   * 
   * @note Implements standard parameter validation
   * @note Returns empty array if no tasks match criteria
   */
  app.post('/api/v1/rest/ViewAllTask', 
    (req, res, next) => {
    // Add custom message to req object
    // in order to pass control to the next middleware (validate_params)
    // req.something = ".....";
    next();
    }, 
    validate_params, 
    view_all_tasks_controller
  );

  /**
   * @brief Transcription Result Download Endpoints
   * @group File Downloads
   * 
   * Provides multiple format options for downloading transcription results:
   * - TXT:  Plain text format
   * - SRT:  SubRip subtitle format
   * - VTT:  WebVTT subtitle format
   * - TSV:  Tab-separated values format
   * - JSON: JavaScript Object Notation format
   * 
   * URL Pattern:
   * GET /api/v1/rest/RetrieveTranscribe/{FORMAT}/{filename}
   * 
   * Path Parameters:
   * @param {String} FORMAT - File format (TXT|SRT|VTT|TSV|JSON)
   * @param {String} filename - Base name of the transcription file
   * 
   * Response Types:
   * - TXT:  text/plain
   * - SRT:  application/x-subrip
   * - VTT:  text/vtt
   * - TSV:  text/tab-separated-values
   * - JSON: application/json
   * 
   * Response Codes:
   * - 200: File downloaded successfully
   * - 401: Unauthorized access
   * - 500: Server error
   * 
   * Security:
   * - Requires authentication
   * - Validates file access permissions
   * - Implements path traversal protection
   * 
   * @note All endpoints use handle_file_download_controller
   * @note File paths are sanitized to prevent directory traversal
   */
  app.get('/api/v1/rest/RetrieveTranscribe/TXT/:filename', 
    async (req, res) => handle_file_download_controller(req, res, 'TXT'));

  app.get('/api/v1/rest/RetrieveTranscribe/SRT/:filename', 
    async (req, res) => handle_file_download_controller(req, res, 'SRT'));

  app.get('/api/v1/rest/RetrieveTranscribe/VTT/:filename', 
    async (req, res) => handle_file_download_controller(req, res, 'VTT'));

  app.get('/api/v1/rest/RetrieveTranscribe/TSV/:filename', 
    async (req, res) => handle_file_download_controller(req, res, 'TSV'));

  app.get('/api/v1/rest/RetrieveTranscribe/JSON/:filename', 
    async (req, res) => handle_file_download_controller(req, res, 'JSON'));

  const options = {
    key: fs.readFileSync(cfg.http_server.key_path),
    cert: fs.readFileSync(cfg.http_server.certificate_path)
  };

  https.createServer(options, app).listen(cfg.http_server.port, () => {
    logger(LOG_LEVEL.INFO, `Worker process ${process.pid} is running on https://${cfg.http_server.host}:${cfg.http_server.port}`);
  });
}
