import ffmpeg
import whisperx
import gc 
import json
import sys  # for sys.argv & sys.exit()
import io
import os  # for path
import re
import subprocess
import logging
from datetime import datetime  # must import datetime
from opencc import OpenCC
# from deepmultilingualpunctuation import PunctuationModel
from whisperx.utils import get_writer
from dotenv import load_dotenv

from huggingface_hub.utils import _runtime
_runtime._is_google_colab = False

from whisperx.SubtitlesProcessor import SubtitlesProcessor
from ckip_transformers.nlp import CkipWordSegmenter

ws_driver = CkipWordSegmenter()

# Initialize Simplified to Traditional Chinese conversion
cc = OpenCC('s2twp')


# For Windows CMD environment (if needed)
# subprocess.run('chcp 65001', shell=True)

# Force all stdout and stderr outputs to be encoded in UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# ---------------------------
# Setup config and logging
# ---------------------------
try:
    # Read config.json
    config_path = os.path.join(os.path.dirname(__file__), "config.json")
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    
    as_dir_path = config["as_dir_path"]
    aslc_dir_path = config["aslc_dir_path"]
    tr_dir_path = config["tr_dir_path"]
    log_path = config["log_path"]
    
    # Ensure log directory exists
    os.makedirs(log_path, exist_ok=True)
    
    # Get all log files matching "sparrow-YYYY-MM-DD.log" format and sort in reverse order (latest first)
    log_files = sorted(
        [f for f in os.listdir(log_path) if re.match(r"sparrow-\d{4}-\d{2}-\d{2}\.plog$", f)],
        reverse=True
    )
    
    if log_files:
        latest_log_file = os.path.join(log_path, log_files[0])
    else:
        latest_log_file = os.path.join(log_path, f"sparrow-{datetime.now().strftime('%Y-%m-%d')}.plog")
except Exception as e:
    print(f"Error reading config or setting up log directory: {e}")
    logging.shutdown()
    raise

# Get the name of the executing Python script
script_name = os.path.basename(__file__)

# Create a logger instance
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
formatter = logging.Formatter(
    f"%(asctime)s - %(levelname)s - [{script_name}] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

# Setup file handler to write logs to the latest log file
file_handler = logging.FileHandler(latest_log_file, encoding="utf-8", mode="a")
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

# Setup stream handler to output logs to the terminal
stream_handler = logging.StreamHandler(sys.stdout)
stream_handler.setFormatter(formatter)
logger.addHandler(stream_handler)



# show env
#logger.info(f"Python environment variables:")
#for key, value in os.environ.items():
#    logger.info(f"{key}: {value}")

# read .env 
load_dotenv()

# ---------------------------
# Receive command-line parameters
# ---------------------------
try:
    as_filename = sys.argv[1]
    diarize_toggle = sys.argv[2]
    hf_token = os.getenv("HF_TOKEN")
except IndexError as e:
    logger.critical("Not enough command line arguments provided.", exc_info=True)
    logging.shutdown()
    raise

sys.stdout.flush()
logger.info(f"Received arguments: {as_filename} {diarize_toggle}")

# ---------------------------
# Setup output file paths and ensure directories exist
# ---------------------------
try:
    tr_txt_dir_path = os.path.join(tr_dir_path, "txt")
    tr_txt_filename = os.path.splitext(as_filename)[0] + '.txt'
    tr_txt_path = os.path.join(tr_txt_dir_path, tr_txt_filename)

    tr_srt_dir_path = os.path.join(tr_dir_path, "srt")
    tr_srt_filename = os.path.splitext(as_filename)[0] + '.srt'
    tr_srt_path = os.path.join(tr_srt_dir_path, tr_srt_filename)

    tr_vtt_dir_path = os.path.join(tr_dir_path, "vtt")
    tr_vtt_filename = os.path.splitext(as_filename)[0] + '.vtt'
    tr_vtt_path = os.path.join(tr_vtt_dir_path, tr_vtt_filename)

    tr_tsv_dir_path = os.path.join(tr_dir_path, "tsv")
    tr_tsv_filename = os.path.splitext(as_filename)[0] + '.tsv'
    tr_tsv_path = os.path.join(tr_tsv_dir_path, tr_tsv_filename)

    tr_json_dir_path = os.path.join(tr_dir_path, "json")
    tr_json_filename = os.path.splitext(as_filename)[0] + '.json'
    tr_json_path = os.path.join(tr_json_dir_path, tr_json_filename)
    
    # Create output directories if they do not exist
    for path in [tr_txt_dir_path, tr_srt_dir_path, tr_vtt_dir_path, tr_tsv_dir_path, tr_json_dir_path]:
        os.makedirs(path, exist_ok=True)
except Exception as e:
    logger.critical(f"Error setting up output directories: {e}", exc_info=True)
    logging.shutdown()
    raise

# ---------------------------
# Main parameters setup
# ---------------------------
try:
    # Define parameters before using them in logger.info
    AUDIO_FILE = os.path.join(as_dir_path, as_filename)
    AUDIOLC_FILE = os.path.join(aslc_dir_path, as_filename)

    DEVICE = config["device"] #"cuda"
    MODEL_SIZE = config["model_size"] #"large-v3"
    COMPUTE_TYPE = config["compute_type"] #"int8"
    BATCH_SIZE = config["batch_size"] # reduce if low on GPU memory
    CHUNK_SIZE = config["chunk_size"] 
    HF_TOKEN = hf_token #config["hf_token"] 
    PRINT_PROGRESS = config["print_progress"] #True
    RETURN_CHAR_ALIGNMENTS = config["return_char_alignments"] #False  # word level timestamp
    MIN_SPEAKER = config["min_speaker"] #1
    MAX_SPEAKER = config["max_speaker"] #10
    
    logger.info(f"Transcribe with parameters: DEVICE:{DEVICE} MODEL_SIZE:{MODEL_SIZE} COMPUTE_TYPE:{COMPUTE_TYPE}")
except Exception as e:
    logger.critical(f"Error setting main parameters: {e}", exc_info=True)
    logging.shutdown()
    raise

# ---------------------------
# Convert audio to mono (left channel)
# ---------------------------
try:
    logger.info(f"Convert the audio to mono (left channel) while keeping the original format: \n"
                f"{AUDIO_FILE}\n-> {AUDIOLC_FILE}")
    (
        ffmpeg
        .input(AUDIO_FILE)
        .output(AUDIOLC_FILE, ac=1, map="0:a:0")
        .run(overwrite_output=True)
    )
except Exception as e:
    logger.error(f"Error in audio conversion: {e}", exc_info=True)
    logging.shutdown()
    raise

# ---------------------------
# Load model and audio, then perform transcription
# ---------------------------
try:
    logger.info(f"Load model: {MODEL_SIZE} on {DEVICE} with {COMPUTE_TYPE}")
    model = whisperx.load_model(MODEL_SIZE, DEVICE, compute_type=COMPUTE_TYPE)
except Exception as e:
    logger.error(f"Error loading model: {e}", exc_info=True)
    logging.shutdown()
    raise

try:
    logger.info(f"Load audio from the source file: {AUDIOLC_FILE}")
    audio = whisperx.load_audio(AUDIOLC_FILE)
except Exception as e:
    logger.error(f"Error loading audio file: {e}", exc_info=True)
    logging.shutdown()
    raise

try:
    logger.info(f"Transcribe audio with batch size: {BATCH_SIZE}, chunk size: {CHUNK_SIZE}, print progress: {PRINT_PROGRESS}")
    result = model.transcribe(audio, batch_size=BATCH_SIZE, chunk_size=CHUNK_SIZE, print_progress=PRINT_PROGRESS)
    #result = model.transcribe(audio, batch_size=BATCH_SIZE, vad_filter=True, vad_parameters={"threshold": 0.5}, print_progress=PRINT_PROGRESS)
except Exception as e:
    logger.error(f"Error during transcription: {e}", exc_info=True)
    logging.shutdown()
    raise

# ---------------------------
# Align whisperx output with the alignment model
# ---------------------------
try:
    logger.info(f"Align whisperx output using language {result['language']} and model: WAV2VEC2_ASR_LARGE_LV60K_960H")
    model_a, metadata = whisperx.load_align_model(language_code=result["language"], device=DEVICE, model_name="WAV2VEC2_ASR_LARGE_LV60K_960H")
    align_result = whisperx.align(result["segments"], model_a, metadata, audio, DEVICE, return_char_alignments=RETURN_CHAR_ALIGNMENTS)
except Exception as e:
    logger.error(f"Error during alignment: {e}", exc_info=True)
    logging.shutdown()
    raise

# ---------------------------
# Speaker diarization (if enabled)
# ---------------------------
if diarize_toggle == "1":
    try:
        logger.info("Assign speaker labels using the diarization model")
        diarize_model = whisperx.DiarizationPipeline(use_auth_token=HF_TOKEN, device=DEVICE)
        diarize_segments = diarize_model(audio)
        align_result = whisperx.assign_word_speakers(diarize_segments, align_result)
    except Exception as e:
        logger.error(f"Error during speaker diarization: {e}", exc_info=True)
        logging.shutdown()
        raise

# Add language information to the result
align_result['language'] = result['language']
all_subtitles = []

# ---------------------------
# Convert transcription text to Traditional Chinese
# ---------------------------
try:
    logger.info("Convert transcription text to Traditional Chinese")
    # Handle the case where segment['words'] is empty by splitting segment['text'] and assigning linear timestamps to each word.

    for segment in align_result['segments']:
        if 'text' not in segment:
            continue
        # 一律先將整段文本轉成繁體
        segment['text'] = cc.convert(segment['text'])

        # 如果 words 已存在，就把每個 word 的內容轉成繁體
        if 'words' in segment and segment['words']:
            for word in segment['words']:
                if word.get('start', 0) == 0:
                    word['start'] = round(segment['start'], 3)
                if word.get('end', 0) == 0 or word['end'] < word['start']:
                    word['end'] = round(word['start'] + 0.0, 3)
                if 'word' in word:
                    word['word'] = cc.convert(word['word'])
        else:
            # 如果 words 是空的，就斷詞並補上時間資訊（線性分配）
            words = ws_driver([segment['text']])[0]  # 使用 CKIP 斷詞
            total = len(words)
            start = segment.get('start', 0)
            end = segment.get('end', start)
            duration = end - start
            interval = duration / total if total > 0 else 0

            segment['words'] = []
            for i, word in enumerate(words):
                word_info = {
                    'word': cc.convert(word),  # 確保每個詞也轉成繁體
                    'start': round(start + i * interval, 3),
                    'end': round(start + (i + 1) * interval, 3),
                    'score': 0.0,
                    'speaker': segment.get('speaker', None)
                }
                segment['words'].append(word_info)
        # 後續字幕處理
        processor = SubtitlesProcessor(
            [segment],
            lang=align_result['language'],
            max_line_length=25,
            min_char_length_splitter=24,
            is_vtt=False
        )
        subtitles = processor.process_segments(advanced_splitting=True)
        for sub in subtitles:
            print(f"- {sub['start']:.2f} ~ {sub['end']:.2f}: {sub['text']}")
        all_subtitles.extend(subtitles)

        #if 'text' in segment:
        #    segment['text'] = cc.convert(segment['text'])
except Exception as e:
    logger.error(f"Error in text conversion: {e}", exc_info=True)
    logging.shutdown()
    raise

# ---------------------------
# Save transcription results in various file formats
# ---------------------------

# Save as TXT file
try:
    logger.info(f"Save result as a TXT file: {tr_txt_path}")
    if diarize_toggle == "1":
        align_result_text = [
            f"{itr.get('speaker', 'Unknown Speaker')}: {itr['text']}"
            for itr in align_result["segments"]
            if 'text' in itr
        ]
    else:
        align_result_text = [itr['text'] for itr in align_result["segments"] if 'text' in itr]
    
    with open(tr_txt_path, 'w', encoding='utf-8') as txt_file:
        txt_file.writelines([line + '\n' for line in align_result_text])
except Exception as e:
    logger.error(f"Error saving TXT file: {e}", exc_info=True)
    logging.shutdown()
    raise

# Save as SRT file
def format_time(seconds):
    ms = int((seconds - int(seconds)) * 1000)
    s = int(seconds)
    hours = s // 3600
    minutes = (s % 3600) // 60
    seconds = s % 60
    return f"{hours:02}:{minutes:02}:{seconds:02},{ms:03}"

try:
    logger.info(f"Save result as an SRT file: {tr_srt_path}")
#    with open(tr_srt_path, "w", encoding="utf-8") as srt_file:
#        for idx, segment in enumerate(align_result['segments'], start=1):
#            start_time = format_time(segment['start'])
#            end_time = format_time(segment['end'])
#            speaker = segment.get('speaker', 'Unknown Speaker') if diarize_toggle == "1" else ""
#            text = segment['text']
#            srt_file.write(f"{idx}\n")
#            srt_file.write(f"{start_time} --> {end_time}\n")
#            srt_file.write(f"{speaker}: {text}\n\n" if speaker else f"{text}\n\n")
    with open(tr_srt_path, "w", encoding="utf-8") as srt_file:
        for idx, sub in enumerate(all_subtitles, start=1):
            start_time = format_time(sub['start'])
            end_time = format_time(sub['end'])
            text = sub['text']
            srt_file.write(f"{idx}\n")
            srt_file.write(f"{start_time} --> {end_time}\n")
            srt_file.write(f"{speaker}: {text}\n\n" if speaker else f"{text}\n\n")

except Exception as e:
    logger.error(f"Error saving SRT file: {e}", exc_info=True)
    logging.shutdown()
    raise

# Save as VTT file
def format_time_vtt(seconds):
    ms = int((seconds - int(seconds)) * 1000)
    s = int(seconds)
    hours = s // 3600
    minutes = (s % 3600) // 60
    seconds = s % 60
    return f"{hours:02}:{minutes:02}:{seconds:02}.{ms:03}"

try:
    logger.info(f"Save result as a VTT file: {tr_vtt_path}")
    with open(tr_vtt_path, "w", encoding="utf-8") as vtt_file:
        vtt_file.write("WEBVTT\n\n")
        for segment in align_result['segments']:
            start_time = format_time_vtt(segment['start'])
            end_time = format_time_vtt(segment['end'])
            speaker = segment.get('speaker', 'Unknown Speaker') if diarize_toggle == "1" else ""
            text = segment['text']
            vtt_file.write(f"{start_time} --> {end_time}\n")
            vtt_file.write(f"{speaker}: {text}\n\n" if speaker else f"{text}\n\n")
except Exception as e:
    logger.error(f"Error saving VTT file: {e}", exc_info=True)
    logging.shutdown()
    raise

# Save as TSV file
def format_time_tsv(seconds):
    ms = int((seconds - int(seconds)) * 1000)
    s = int(seconds)
    hours = s // 3600
    minutes = (s % 3600) // 60
    seconds = s % 60
    return f"{hours:02}:{minutes:02}:{seconds:02}.{ms:03}"

try:
    logger.info(f"Save result as a TSV file: {tr_tsv_path}")
    with open(tr_tsv_path, "w", encoding="utf-8") as tsv_file:
        tsv_file.write("Speaker\tStart\tEnd\tText\n")
        for segment in align_result['segments']:
            start_time = format_time_tsv(segment['start'])
            end_time = format_time_tsv(segment['end'])
            speaker = segment.get('speaker', 'Unknown Speaker') if diarize_toggle == "1" else ""
            text = segment['text']
            if speaker:
                tsv_file.write(f"{speaker}\t{start_time}\t{end_time}\t{text}\n")
            else:
                tsv_file.write(f"{start_time}\t{end_time}\t{text}\n")
except Exception as e:
    logger.error(f"Error saving TSV file: {e}", exc_info=True)
    logging.shutdown()
    raise

# Save as JSON file
try:
    logger.info(f"Save result as a JSON file: {tr_json_path}")
    with open(tr_json_path, "w", encoding="utf-8") as json_file:
        json.dump(align_result, json_file, ensure_ascii=False, indent=4)
except Exception as e:
    logger.error(f"Error saving JSON file: {e}", exc_info=True)
    logging.shutdown()
    raise

logger.info("Process completed successfully")
logging.shutdown()
sys.exit(0)
