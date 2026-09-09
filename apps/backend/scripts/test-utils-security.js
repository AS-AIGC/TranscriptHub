const assert = require('assert');
const path = require('path');

const { _private } = require('../utils.js');
const cfg = require('../config.js');

const uploadRoot = path.resolve(cfg.paths.uploaded_files_path);
const uploadLcRoot = path.resolve(cfg.paths.uploaded_files_lc_path);

assert.strictEqual(
  _private.normalize_allowed_media_path(path.join(uploadRoot, 'audiofile-123.mp3')),
  path.join(uploadRoot, 'audiofile-123.mp3')
);

assert.strictEqual(
  _private.normalize_allowed_media_path(path.join(uploadLcRoot, 'audiofile-123.wav')),
  path.join(uploadLcRoot, 'audiofile-123.wav')
);

assert.strictEqual(
  _private.normalize_allowed_media_path(path.join(uploadRoot, '..', 'secret.mp3')),
  null
);

assert.strictEqual(
  _private.normalize_allowed_media_path('/tmp/audiofile-123.mp3'),
  null
);

assert.strictEqual(
  _private.normalize_allowed_media_path(path.join(uploadRoot, 'bad/name.mp3')),
  null
);

assert.strictEqual(
  _private.normalize_allowed_media_path(path.join(uploadRoot, 'bad\r\nname.mp3')),
  null
);

console.log('utils path validation tests passed');
