/**
 * Basset Hound Browser Automation - Streaming Response Handler
 *
 * Phase 6 palletAI Integration streaming for:
 * - Creating streaming responses from data generators
 * - Chunked data transmission
 * - Large response handling
 */

// =============================================================================
// Configuration
// =============================================================================

const StreamConfig = {
  DEFAULT_CHUNK_SIZE: 64 * 1024,  // 64KB default chunk size
  MAX_CHUNK_SIZE: 1024 * 1024,    // 1MB max chunk size
  MIN_CHUNK_SIZE: 1024,           // 1KB min chunk size
  STREAM_TIMEOUT: 300000,         // 5 minute stream timeout
  MAX_ACTIVE_STREAMS: 10          // Maximum concurrent streams
};

// =============================================================================
// Stream State Management
// =============================================================================

// Active streams storage
const activeStreams = new Map();
let streamIdCounter = 0;

// Stream states
const StreamState = {
  INITIALIZING: 'initializing',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ERROR: 'error',
  CANCELLED: 'cancelled'
};

// =============================================================================
// Stream Creation
// =============================================================================

/**
 * Create a streaming response from a data generator
 * @param {Function|AsyncFunction|Generator|AsyncGenerator} dataGenerator - Data source
 * @param {Object} options - Stream options
 * @param {number} options.chunkSize - Size of each chunk in bytes
 * @param {string} options.contentType - Content type of data
 * @param {Object} options.metadata - Additional metadata
 * @param {number} options.timeout - Stream timeout in ms
 * @returns {Object} - Stream object with ID and control methods
 */
function createStream(dataGenerator, options = {}) {
  const {
    chunkSize = StreamConfig.DEFAULT_CHUNK_SIZE,
    contentType = 'application/octet-stream',
    metadata = {},
    timeout = StreamConfig.STREAM_TIMEOUT
  } = options;

  // Validate chunk size
  const validChunkSize = Math.max(
    StreamConfig.MIN_CHUNK_SIZE,
    Math.min(StreamConfig.MAX_CHUNK_SIZE, chunkSize)
  );

  // Check max active streams
  if (activeStreams.size >= StreamConfig.MAX_ACTIVE_STREAMS) {
    throw new Error(`Maximum active streams (${StreamConfig.MAX_ACTIVE_STREAMS}) reached`);
  }

  // Generate stream ID
  const streamId = `stream_${Date.now()}_${++streamIdCounter}`;

  // Determine generator type
  const generatorType = getGeneratorType(dataGenerator);
  if (!generatorType) {
    throw new Error('dataGenerator must be a function, generator, or async generator');
  }

  // Create stream state
  const stream = {
    id: streamId,
    state: StreamState.INITIALIZING,
    contentType,
    chunkSize: validChunkSize,
    metadata,
    timeout,
    createdAt: Date.now(),
    startedAt: null,
    completedAt: null,
    generator: null,
    generatorType,
    dataGenerator,
    chunks: [],
    chunkIndex: 0,
    totalSize: 0,
    sentChunks: 0,
    error: null,
    timeoutId: null,
    onChunk: null,
    onComplete: null,
    onError: null
  };

  activeStreams.set(streamId, stream);

  // Return stream controller
  return {
    streamId,
    stream: getStreamInfo(stream),

    // Start streaming
    start: () => startStream(streamId),

    // Get next chunk
    getNextChunk: () => getNextChunk(streamId),

    // Pause streaming
    pause: () => pauseStream(streamId),

    // Resume streaming
    resume: () => resumeStream(streamId),

    // Cancel streaming
    cancel: (reason) => cancelStream(streamId, reason),

    // Event handlers
    onChunk: (callback) => { stream.onChunk = callback; },
    onComplete: (callback) => { stream.onComplete = callback; },
    onError: (callback) => { stream.onError = callback; }
  };
}

/**
 * Determine the type of generator/data source
 * @param {*} source - Data source
 * @returns {string|null} - Generator type or null if invalid
 */
function getGeneratorType(source) {
  if (!source) return null;

  if (typeof source === 'function') {
    // Check if it's a generator function
    const result = source.constructor.name;
    if (result === 'GeneratorFunction') return 'generator';
    if (result === 'AsyncGeneratorFunction') return 'asyncGenerator';
    return 'function';
  }

  if (source[Symbol.iterator]) return 'iterator';
  if (source[Symbol.asyncIterator]) return 'asyncIterator';

  return null;
}

/**
 * Get stream information
 * @param {Object} stream - Stream object
 * @returns {Object} - Public stream info
 */
function getStreamInfo(stream) {
  return {
    id: stream.id,
    state: stream.state,
    contentType: stream.contentType,
    chunkSize: stream.chunkSize,
    metadata: stream.metadata,
    createdAt: stream.createdAt,
    startedAt: stream.startedAt,
    completedAt: stream.completedAt,
    totalSize: stream.totalSize,
    sentChunks: stream.sentChunks,
    totalChunks: stream.chunks.length,
    error: stream.error
  };
}

// =============================================================================
// Stream Control
// =============================================================================

/**
 * Start streaming data
 * @param {string} streamId - Stream ID
 * @returns {Promise<Object>} - Stream start result
 */
async function startStream(streamId) {
  const stream = activeStreams.get(streamId);
  if (!stream) {
    throw new Error(`Stream not found: ${streamId}`);
  }

  if (stream.state !== StreamState.INITIALIZING) {
    throw new Error(`Stream cannot be started from state: ${stream.state}`);
  }

  stream.state = StreamState.ACTIVE;
  stream.startedAt = Date.now();

  // Set up timeout
  if (stream.timeout > 0) {
    stream.timeoutId = setTimeout(() => {
      if (stream.state === StreamState.ACTIVE || stream.state === StreamState.PAUSED) {
        stream.error = 'Stream timeout';
        stream.state = StreamState.ERROR;
        stream.completedAt = Date.now();

        if (stream.onError) {
          stream.onError({ streamId, error: stream.error });
        }
      }
    }, stream.timeout);
  }

  // Initialize generator
  try {
    switch (stream.generatorType) {
      case 'generator':
      case 'asyncGenerator':
        stream.generator = stream.dataGenerator();
        break;
      case 'function':
        // Execute function and wrap result as iterator
        const result = await stream.dataGenerator();
        stream.generator = wrapAsIterator(result);
        break;
      case 'iterator':
      case 'asyncIterator':
        stream.generator = stream.dataGenerator;
        break;
    }
  } catch (error) {
    stream.error = error.message;
    stream.state = StreamState.ERROR;
    stream.completedAt = Date.now();
    clearTimeout(stream.timeoutId);
    throw error;
  }

  return {
    streamId,
    state: stream.state,
    startedAt: stream.startedAt
  };
}

/**
 * Wrap a value as an iterator
 * @param {*} value - Value to wrap
 * @returns {Iterator} - Iterator
 */
function* wrapAsIterator(value) {
  if (typeof value === 'string' || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    yield value;
  } else if (Array.isArray(value)) {
    for (const item of value) {
      yield item;
    }
  } else if (value && typeof value === 'object') {
    yield JSON.stringify(value);
  } else {
    yield String(value);
  }
}

/**
 * Get the next chunk from a stream
 * @param {string} streamId - Stream ID
 * @returns {Promise<Object>} - Chunk data or end signal
 */
async function getNextChunk(streamId) {
  const stream = activeStreams.get(streamId);
  if (!stream) {
    throw new Error(`Stream not found: ${streamId}`);
  }

  if (stream.state === StreamState.COMPLETED) {
    return {
      streamId,
      done: true,
      totalChunks: stream.sentChunks,
      totalSize: stream.totalSize
    };
  }

  if (stream.state === StreamState.ERROR) {
    throw new Error(stream.error || 'Stream error');
  }

  if (stream.state === StreamState.CANCELLED) {
    throw new Error('Stream was cancelled');
  }

  if (stream.state === StreamState.PAUSED) {
    return {
      streamId,
      paused: true,
      chunkIndex: stream.sentChunks
    };
  }

  if (stream.state !== StreamState.ACTIVE) {
    throw new Error(`Stream is not active: ${stream.state}`);
  }

  try {
    // Get next value from generator
    const { value, done } = await getNextFromGenerator(stream.generator, stream.generatorType);

    if (done) {
      // Stream complete
      stream.state = StreamState.COMPLETED;
      stream.completedAt = Date.now();
      clearTimeout(stream.timeoutId);

      if (stream.onComplete) {
        stream.onComplete({
          streamId,
          totalChunks: stream.sentChunks,
          totalSize: stream.totalSize,
          duration: stream.completedAt - stream.startedAt
        });
      }

      return {
        streamId,
        done: true,
        totalChunks: stream.sentChunks,
        totalSize: stream.totalSize
      };
    }

    // Process the chunk
    const chunk = processChunk(value, stream.chunkSize);
    stream.sentChunks++;
    stream.totalSize += chunk.size;

    const chunkResult = {
      streamId,
      chunkIndex: stream.sentChunks - 1,
      data: chunk.data,
      size: chunk.size,
      encoding: chunk.encoding,
      done: false
    };

    if (stream.onChunk) {
      stream.onChunk(chunkResult);
    }

    return chunkResult;
  } catch (error) {
    stream.error = error.message;
    stream.state = StreamState.ERROR;
    stream.completedAt = Date.now();
    clearTimeout(stream.timeoutId);

    if (stream.onError) {
      stream.onError({ streamId, error: error.message });
    }

    throw error;
  }
}

/**
 * Get next value from generator (handles async and sync)
 * @param {Generator|AsyncGenerator} generator - Generator
 * @param {string} type - Generator type
 * @returns {Promise<Object>} - Iterator result
 */
async function getNextFromGenerator(generator, type) {
  if (type === 'asyncGenerator' || type === 'asyncIterator') {
    return await generator.next();
  }
  return generator.next();
}

/**
 * Process a chunk value
 * @param {*} value - Chunk value
 * @param {number} maxSize - Maximum chunk size
 * @returns {Object} - Processed chunk
 */
function processChunk(value, maxSize) {
  let data, size, encoding = 'utf-8';

  if (typeof value === 'string') {
    data = value;
    size = new Blob([value]).size;
  } else if (value instanceof ArrayBuffer) {
    data = arrayBufferToBase64(value);
    size = value.byteLength;
    encoding = 'base64';
  } else if (ArrayBuffer.isView(value)) {
    data = arrayBufferToBase64(value.buffer);
    size = value.byteLength;
    encoding = 'base64';
  } else if (value instanceof Blob) {
    // Note: In actual use, would need to handle async blob reading
    data = '[Blob data]';
    size = value.size;
    encoding = 'blob';
  } else if (typeof value === 'object') {
    data = JSON.stringify(value);
    size = new Blob([data]).size;
    encoding = 'json';
  } else {
    data = String(value);
    size = new Blob([data]).size;
  }

  return { data, size, encoding };
}

/**
 * Convert ArrayBuffer to base64
 * @param {ArrayBuffer} buffer - Array buffer
 * @returns {string} - Base64 string
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Pause a stream
 * @param {string} streamId - Stream ID
 * @returns {Object} - Pause result
 */
function pauseStream(streamId) {
  const stream = activeStreams.get(streamId);
  if (!stream) {
    throw new Error(`Stream not found: ${streamId}`);
  }

  if (stream.state !== StreamState.ACTIVE) {
    return {
      success: false,
      streamId,
      error: `Cannot pause stream in state: ${stream.state}`
    };
  }

  stream.state = StreamState.PAUSED;
  stream.pausedAt = Date.now();

  return {
    success: true,
    streamId,
    state: stream.state,
    sentChunks: stream.sentChunks
  };
}

/**
 * Resume a paused stream
 * @param {string} streamId - Stream ID
 * @returns {Object} - Resume result
 */
function resumeStream(streamId) {
  const stream = activeStreams.get(streamId);
  if (!stream) {
    throw new Error(`Stream not found: ${streamId}`);
  }

  if (stream.state !== StreamState.PAUSED) {
    return {
      success: false,
      streamId,
      error: `Cannot resume stream in state: ${stream.state}`
    };
  }

  stream.state = StreamState.ACTIVE;
  stream.resumedAt = Date.now();

  return {
    success: true,
    streamId,
    state: stream.state,
    pauseDuration: stream.resumedAt - stream.pausedAt
  };
}

/**
 * Cancel a stream
 * @param {string} streamId - Stream ID
 * @param {string} reason - Cancellation reason
 * @returns {Object} - Cancel result
 */
function cancelStream(streamId, reason = 'Cancelled by user') {
  const stream = activeStreams.get(streamId);
  if (!stream) {
    return {
      success: false,
      streamId,
      error: 'Stream not found'
    };
  }

  if (stream.state === StreamState.COMPLETED || stream.state === StreamState.CANCELLED) {
    return {
      success: false,
      streamId,
      error: `Stream already ${stream.state}`
    };
  }

  stream.state = StreamState.CANCELLED;
  stream.error = reason;
  stream.completedAt = Date.now();
  clearTimeout(stream.timeoutId);

  return {
    success: true,
    streamId,
    reason,
    sentChunks: stream.sentChunks,
    totalSize: stream.totalSize
  };
}

// =============================================================================
// Chunk Management
// =============================================================================

/**
 * Send a specific chunk of data
 * @param {string} streamId - Stream ID
 * @param {*} chunk - Chunk data
 * @param {Object} options - Chunk options
 * @param {number} options.index - Explicit chunk index
 * @param {boolean} options.isLast - Whether this is the last chunk
 * @returns {Object} - Send result
 */
function sendChunk(streamId, chunk, options = {}) {
  const stream = activeStreams.get(streamId);
  if (!stream) {
    throw new Error(`Stream not found: ${streamId}`);
  }

  if (stream.state !== StreamState.ACTIVE) {
    throw new Error(`Cannot send chunk to stream in state: ${stream.state}`);
  }

  const { index, isLast = false } = options;
  const chunkIndex = index !== undefined ? index : stream.sentChunks;

  // Process the chunk
  const processedChunk = processChunk(chunk, stream.chunkSize);
  stream.sentChunks++;
  stream.totalSize += processedChunk.size;

  // Store chunk for potential re-transmission
  stream.chunks.push({
    index: chunkIndex,
    ...processedChunk,
    timestamp: Date.now()
  });

  const result = {
    streamId,
    chunkIndex,
    size: processedChunk.size,
    encoding: processedChunk.encoding,
    isLast,
    totalSent: stream.sentChunks,
    totalSize: stream.totalSize
  };

  if (stream.onChunk) {
    stream.onChunk({ ...result, data: processedChunk.data });
  }

  // If this is the last chunk, complete the stream
  if (isLast) {
    stream.state = StreamState.COMPLETED;
    stream.completedAt = Date.now();
    clearTimeout(stream.timeoutId);

    if (stream.onComplete) {
      stream.onComplete({
        streamId,
        totalChunks: stream.sentChunks,
        totalSize: stream.totalSize,
        duration: stream.completedAt - stream.startedAt
      });
    }
  }

  return result;
}

/**
 * End a stream
 * @param {string} streamId - Stream ID
 * @param {Object} options - End options
 * @param {boolean} options.success - Whether stream completed successfully
 * @param {string} options.error - Error message if failed
 * @returns {Object} - Stream end result
 */
function endStream(streamId, options = {}) {
  const { success = true, error = null } = options;

  const stream = activeStreams.get(streamId);
  if (!stream) {
    throw new Error(`Stream not found: ${streamId}`);
  }

  if (stream.state === StreamState.COMPLETED || stream.state === StreamState.CANCELLED) {
    return {
      success: false,
      streamId,
      error: `Stream already ${stream.state}`
    };
  }

  stream.state = success ? StreamState.COMPLETED : StreamState.ERROR;
  stream.error = error;
  stream.completedAt = Date.now();
  clearTimeout(stream.timeoutId);

  const result = {
    success: true,
    streamId,
    state: stream.state,
    totalChunks: stream.sentChunks,
    totalSize: stream.totalSize,
    duration: stream.completedAt - (stream.startedAt || stream.createdAt)
  };

  if (stream.onComplete && success) {
    stream.onComplete(result);
  } else if (stream.onError && !success) {
    stream.onError({ streamId, error });
  }

  return result;
}

// =============================================================================
// Large Response Handling
// =============================================================================

/**
 * Handle a large response by splitting into chunks
 * @param {*} data - Data to split
 * @param {number} chunkSize - Size of each chunk in bytes (or characters for strings)
 * @param {Object} options - Options
 * @param {string} options.contentType - Content type
 * @param {boolean} options.base64 - Encode as base64
 * @returns {Object} - Chunked response handler
 */
function handleLargeResponse(data, chunkSize = StreamConfig.DEFAULT_CHUNK_SIZE, options = {}) {
  const { contentType = 'application/octet-stream', base64 = false } = options;

  // Convert data to string or buffer
  let dataToChunk;
  let encoding = 'utf-8';
  let totalSize;

  if (typeof data === 'string') {
    dataToChunk = data;
    totalSize = new Blob([data]).size;
  } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    if (base64) {
      dataToChunk = arrayBufferToBase64(data instanceof ArrayBuffer ? data : data.buffer);
      encoding = 'base64';
    } else {
      dataToChunk = new TextDecoder().decode(data);
    }
    totalSize = data instanceof ArrayBuffer ? data.byteLength : data.byteLength;
  } else if (typeof data === 'object') {
    dataToChunk = JSON.stringify(data);
    encoding = 'json';
    totalSize = new Blob([dataToChunk]).size;
  } else {
    dataToChunk = String(data);
    totalSize = new Blob([dataToChunk]).size;
  }

  // Calculate chunks
  const chunks = [];
  let offset = 0;

  while (offset < dataToChunk.length) {
    const end = Math.min(offset + chunkSize, dataToChunk.length);
    chunks.push({
      index: chunks.length,
      data: dataToChunk.slice(offset, end),
      size: end - offset,
      offset
    });
    offset = end;
  }

  return {
    totalSize,
    totalChunks: chunks.length,
    chunkSize,
    contentType,
    encoding,
    chunks,

    // Get a specific chunk
    getChunk: (index) => {
      if (index < 0 || index >= chunks.length) {
        return null;
      }
      return {
        ...chunks[index],
        isFirst: index === 0,
        isLast: index === chunks.length - 1
      };
    },

    // Create an iterator for chunks
    *[Symbol.iterator]() {
      for (let i = 0; i < chunks.length; i++) {
        yield {
          ...chunks[i],
          isFirst: i === 0,
          isLast: i === chunks.length - 1
        };
      }
    },

    // Create a stream from this response
    toStream: () => createStream(function* () {
      for (const chunk of chunks) {
        yield chunk.data;
      }
    }, { chunkSize, contentType })
  };
}

/**
 * Reassemble chunks into original data
 * @param {Array<Object>} chunks - Array of chunks with data and index
 * @param {Object} options - Options
 * @param {string} options.encoding - Data encoding
 * @param {boolean} options.parseJson - Parse as JSON if encoding is json
 * @returns {*} - Reassembled data
 */
function reassembleChunks(chunks, options = {}) {
  const { encoding = 'utf-8', parseJson = true } = options;

  // Sort chunks by index
  const sortedChunks = [...chunks].sort((a, b) => a.index - b.index);

  // Verify no missing chunks
  for (let i = 0; i < sortedChunks.length; i++) {
    if (sortedChunks[i].index !== i) {
      throw new Error(`Missing chunk at index ${i}`);
    }
  }

  // Concatenate data
  const assembled = sortedChunks.map(c => c.data).join('');

  // Handle different encodings
  switch (encoding) {
    case 'json':
      return parseJson ? JSON.parse(assembled) : assembled;
    case 'base64':
      // Decode base64 to ArrayBuffer
      const binary = atob(assembled);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    default:
      return assembled;
  }
}

// =============================================================================
// Stream Management
// =============================================================================

/**
 * Get stream by ID
 * @param {string} streamId - Stream ID
 * @returns {Object|null} - Stream info or null
 */
function getStream(streamId) {
  const stream = activeStreams.get(streamId);
  if (!stream) {
    return null;
  }
  return getStreamInfo(stream);
}

/**
 * Get all active streams
 * @returns {Array<Object>} - Array of stream info
 */
function getActiveStreams() {
  const streams = [];
  for (const stream of activeStreams.values()) {
    streams.push(getStreamInfo(stream));
  }
  return streams;
}

/**
 * Clean up completed/errored streams
 * @param {number} maxAge - Maximum age in ms for completed streams (default: 5 minutes)
 * @returns {number} - Number of streams cleaned up
 */
function cleanupStreams(maxAge = 5 * 60 * 1000) {
  const cutoff = Date.now() - maxAge;
  let cleaned = 0;

  for (const [streamId, stream] of activeStreams.entries()) {
    if (
      (stream.state === StreamState.COMPLETED ||
       stream.state === StreamState.ERROR ||
       stream.state === StreamState.CANCELLED) &&
      stream.completedAt < cutoff
    ) {
      activeStreams.delete(streamId);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Get streaming statistics
 * @returns {Object} - Stream statistics
 */
function getStreamStats() {
  let active = 0;
  let completed = 0;
  let errored = 0;
  let cancelled = 0;
  let paused = 0;
  let totalSize = 0;
  let totalChunks = 0;

  for (const stream of activeStreams.values()) {
    switch (stream.state) {
      case StreamState.ACTIVE:
        active++;
        break;
      case StreamState.COMPLETED:
        completed++;
        break;
      case StreamState.ERROR:
        errored++;
        break;
      case StreamState.CANCELLED:
        cancelled++;
        break;
      case StreamState.PAUSED:
        paused++;
        break;
    }
    totalSize += stream.totalSize;
    totalChunks += stream.sentChunks;
  }

  return {
    total: activeStreams.size,
    active,
    completed,
    errored,
    cancelled,
    paused,
    totalSize,
    totalChunks,
    maxStreams: StreamConfig.MAX_ACTIVE_STREAMS
  };
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.StreamingHandler = {
    // Constants
    StreamConfig,
    StreamState,

    // Stream creation
    createStream,

    // Chunk management
    sendChunk,
    endStream,

    // Large response handling
    handleLargeResponse,
    reassembleChunks,

    // Stream control
    getStream,
    getActiveStreams,
    pauseStream,
    resumeStream,
    cancelStream,
    cleanupStreams,
    getStreamStats
  };
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    StreamConfig,
    StreamState,
    createStream,
    sendChunk,
    endStream,
    handleLargeResponse,
    reassembleChunks,
    getStream,
    getActiveStreams,
    pauseStream,
    resumeStream,
    cancelStream,
    cleanupStreams,
    getStreamStats
  };
}
