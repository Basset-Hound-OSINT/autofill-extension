/**
 * Basset Hound Browser Automation - Fingerprint Randomizer
 *
 * Browser fingerprint randomization for authorized security testing,
 * pentesting, and OSINT cybersecurity workflows.
 *
 * Provides protection against:
 * - Canvas fingerprinting
 * - WebGL fingerprinting
 * - AudioContext fingerprinting
 * - Navigator property fingerprinting
 */

// =============================================================================
// Configuration
// =============================================================================

const FingerprintConfig = {
  enabled: false,
  options: {
    canvas: true,
    webgl: true,
    audio: true,
    navigator: true,
    fonts: true,
    screen: true
  },
  noise: {
    canvas: 0.1,      // 0-1, amount of noise to add
    audio: 0.0001,    // Very small noise for audio
    screen: 50        // Pixels variance for screen dimensions
  }
};

// Store original values for reset
const OriginalValues = {
  canvas: {
    toDataURL: null,
    getImageData: null
  },
  webgl: {
    getParameter: null,
    getSupportedExtensions: null
  },
  audio: {
    createOscillator: null,
    createDynamicsCompressor: null
  },
  navigator: {}
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate a random number in range
 */
function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Generate consistent noise based on a seed
 */
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Add noise to a color value
 */
function addColorNoise(value, noise) {
  const delta = Math.floor(randomInRange(-noise * 255, noise * 255));
  return Math.max(0, Math.min(255, value + delta));
}

// =============================================================================
// Canvas Fingerprint Protection
// =============================================================================

/**
 * Randomize canvas fingerprinting by adding noise to toDataURL and getImageData
 */
function randomizeCanvasFingerprint() {
  if (OriginalValues.canvas.toDataURL) {
    return; // Already applied
  }

  // Store original methods
  OriginalValues.canvas.toDataURL = HTMLCanvasElement.prototype.toDataURL;
  OriginalValues.canvas.getImageData = CanvasRenderingContext2D.prototype.getImageData;

  // Override toDataURL
  HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
    const context = this.getContext('2d');
    if (context && FingerprintConfig.enabled && FingerprintConfig.options.canvas) {
      try {
        const imageData = context.getImageData(0, 0, this.width, this.height);
        const noise = FingerprintConfig.noise.canvas;

        // Add noise to random pixels
        for (let i = 0; i < imageData.data.length; i += 4) {
          if (Math.random() < 0.01) { // Only modify 1% of pixels
            imageData.data[i] = addColorNoise(imageData.data[i], noise);     // R
            imageData.data[i + 1] = addColorNoise(imageData.data[i + 1], noise); // G
            imageData.data[i + 2] = addColorNoise(imageData.data[i + 2], noise); // B
          }
        }
        context.putImageData(imageData, 0, 0);
      } catch (e) {
        // Canvas may be tainted, ignore
      }
    }
    return OriginalValues.canvas.toDataURL.call(this, type, quality);
  };

  // Override getImageData
  CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
    const imageData = OriginalValues.canvas.getImageData.call(this, sx, sy, sw, sh);

    if (FingerprintConfig.enabled && FingerprintConfig.options.canvas) {
      const noise = FingerprintConfig.noise.canvas;
      for (let i = 0; i < imageData.data.length; i += 4) {
        if (Math.random() < 0.01) {
          imageData.data[i] = addColorNoise(imageData.data[i], noise);
          imageData.data[i + 1] = addColorNoise(imageData.data[i + 1], noise);
          imageData.data[i + 2] = addColorNoise(imageData.data[i + 2], noise);
        }
      }
    }

    return imageData;
  };

  return true;
}

// =============================================================================
// WebGL Fingerprint Protection
// =============================================================================

// Common WebGL renderer/vendor pairs for randomization
const WebGLProfiles = [
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel Iris Xe Graphics Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Intel Inc.', renderer: 'Intel Iris Pro OpenGL Engine' },
  { vendor: 'Apple Inc.', renderer: 'Apple M1' },
  { vendor: 'Apple Inc.', renderer: 'Apple M2' }
];

let selectedWebGLProfile = null;

/**
 * Randomize WebGL fingerprinting
 */
function randomizeWebGLFingerprint() {
  if (OriginalValues.webgl.getParameter) {
    return; // Already applied
  }

  // Select a random profile
  selectedWebGLProfile = WebGLProfiles[Math.floor(Math.random() * WebGLProfiles.length)];

  // Store original methods for both WebGL contexts
  const contexts = [WebGLRenderingContext, WebGL2RenderingContext];

  contexts.forEach(Context => {
    if (!Context) return;

    const originalGetParameter = Context.prototype.getParameter;

    Context.prototype.getParameter = function(parameter) {
      if (!FingerprintConfig.enabled || !FingerprintConfig.options.webgl) {
        return originalGetParameter.call(this, parameter);
      }

      // UNMASKED_VENDOR_WEBGL
      if (parameter === 37445) {
        return selectedWebGLProfile.vendor;
      }
      // UNMASKED_RENDERER_WEBGL
      if (parameter === 37446) {
        return selectedWebGLProfile.renderer;
      }

      return originalGetParameter.call(this, parameter);
    };
  });

  OriginalValues.webgl.getParameter = WebGLRenderingContext.prototype.getParameter;

  return true;
}

// =============================================================================
// Audio Fingerprint Protection
// =============================================================================

/**
 * Randomize AudioContext fingerprinting
 */
function randomizeAudioFingerprint() {
  if (OriginalValues.audio.createOscillator) {
    return; // Already applied
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return false;

  // Store originals
  OriginalValues.audio.createOscillator = AudioContextClass.prototype.createOscillator;
  OriginalValues.audio.createDynamicsCompressor = AudioContextClass.prototype.createDynamicsCompressor;

  // Override createOscillator to add noise
  AudioContextClass.prototype.createOscillator = function() {
    const oscillator = OriginalValues.audio.createOscillator.call(this);

    if (FingerprintConfig.enabled && FingerprintConfig.options.audio) {
      const originalConnect = oscillator.connect.bind(oscillator);
      oscillator.connect = function(destination) {
        // Add a tiny gain variation
        if (destination instanceof AudioNode) {
          try {
            const gainNode = oscillator.context.createGain();
            const noise = FingerprintConfig.noise.audio;
            gainNode.gain.value = 1 + (Math.random() * noise * 2 - noise);
            originalConnect(gainNode);
            gainNode.connect(destination);
            return destination;
          } catch (e) {
            return originalConnect(destination);
          }
        }
        return originalConnect(destination);
      };
    }

    return oscillator;
  };

  // Override createDynamicsCompressor
  AudioContextClass.prototype.createDynamicsCompressor = function() {
    const compressor = OriginalValues.audio.createDynamicsCompressor.call(this);

    if (FingerprintConfig.enabled && FingerprintConfig.options.audio) {
      const noise = FingerprintConfig.noise.audio;
      // Add tiny variations to compressor parameters
      try {
        compressor.threshold.value += (Math.random() * noise * 2 - noise) * 10;
        compressor.knee.value += (Math.random() * noise * 2 - noise) * 5;
        compressor.ratio.value += (Math.random() * noise * 2 - noise);
      } catch (e) {
        // Ignore if read-only
      }
    }

    return compressor;
  };

  return true;
}

// =============================================================================
// Navigator Properties Protection
// =============================================================================

// Navigator property profiles
const NavigatorProfiles = [
  {
    platform: 'Win32',
    languages: ['en-US', 'en'],
    hardwareConcurrency: 8,
    deviceMemory: 8,
    maxTouchPoints: 0
  },
  {
    platform: 'Win32',
    languages: ['en-US', 'en', 'es'],
    hardwareConcurrency: 16,
    deviceMemory: 16,
    maxTouchPoints: 0
  },
  {
    platform: 'MacIntel',
    languages: ['en-US', 'en'],
    hardwareConcurrency: 8,
    deviceMemory: 8,
    maxTouchPoints: 0
  },
  {
    platform: 'MacIntel',
    languages: ['en-US'],
    hardwareConcurrency: 10,
    deviceMemory: 16,
    maxTouchPoints: 0
  },
  {
    platform: 'Linux x86_64',
    languages: ['en-US', 'en'],
    hardwareConcurrency: 4,
    deviceMemory: 8,
    maxTouchPoints: 0
  }
];

let selectedNavigatorProfile = null;

/**
 * Randomize navigator properties
 */
function randomizeNavigatorProperties() {
  // Select a random profile
  selectedNavigatorProfile = NavigatorProfiles[Math.floor(Math.random() * NavigatorProfiles.length)];

  // Store original values
  OriginalValues.navigator = {
    platform: navigator.platform,
    languages: navigator.languages,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory,
    maxTouchPoints: navigator.maxTouchPoints
  };

  // Override navigator properties
  const overrides = {
    get platform() {
      if (FingerprintConfig.enabled && FingerprintConfig.options.navigator) {
        return selectedNavigatorProfile.platform;
      }
      return OriginalValues.navigator.platform;
    },
    get languages() {
      if (FingerprintConfig.enabled && FingerprintConfig.options.navigator) {
        return selectedNavigatorProfile.languages;
      }
      return OriginalValues.navigator.languages;
    },
    get hardwareConcurrency() {
      if (FingerprintConfig.enabled && FingerprintConfig.options.navigator) {
        return selectedNavigatorProfile.hardwareConcurrency;
      }
      return OriginalValues.navigator.hardwareConcurrency;
    },
    get deviceMemory() {
      if (FingerprintConfig.enabled && FingerprintConfig.options.navigator) {
        return selectedNavigatorProfile.deviceMemory;
      }
      return OriginalValues.navigator.deviceMemory;
    },
    get maxTouchPoints() {
      if (FingerprintConfig.enabled && FingerprintConfig.options.navigator) {
        return selectedNavigatorProfile.maxTouchPoints;
      }
      return OriginalValues.navigator.maxTouchPoints;
    }
  };

  // Apply overrides
  try {
    Object.defineProperty(navigator, 'platform', { get: overrides.platform });
    Object.defineProperty(navigator, 'languages', { get: overrides.languages });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: overrides.hardwareConcurrency });
    if ('deviceMemory' in navigator) {
      Object.defineProperty(navigator, 'deviceMemory', { get: overrides.deviceMemory });
    }
    Object.defineProperty(navigator, 'maxTouchPoints', { get: overrides.maxTouchPoints });
  } catch (e) {
    console.warn('[FingerprintRandomizer] Could not override some navigator properties:', e);
  }

  return true;
}

// =============================================================================
// Screen Properties Protection
// =============================================================================

let originalScreen = null;

/**
 * Randomize screen properties
 */
function randomizeScreenProperties() {
  if (originalScreen) {
    return; // Already applied
  }

  originalScreen = {
    width: screen.width,
    height: screen.height,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    colorDepth: screen.colorDepth,
    pixelDepth: screen.pixelDepth
  };

  const noise = FingerprintConfig.noise.screen;
  const widthVariance = Math.floor(randomInRange(-noise, noise));
  const heightVariance = Math.floor(randomInRange(-noise, noise));

  try {
    Object.defineProperty(screen, 'width', {
      get: function() {
        if (FingerprintConfig.enabled && FingerprintConfig.options.screen) {
          return originalScreen.width + widthVariance;
        }
        return originalScreen.width;
      }
    });
    Object.defineProperty(screen, 'height', {
      get: function() {
        if (FingerprintConfig.enabled && FingerprintConfig.options.screen) {
          return originalScreen.height + heightVariance;
        }
        return originalScreen.height;
      }
    });
    Object.defineProperty(screen, 'availWidth', {
      get: function() {
        if (FingerprintConfig.enabled && FingerprintConfig.options.screen) {
          return originalScreen.availWidth + widthVariance;
        }
        return originalScreen.availWidth;
      }
    });
    Object.defineProperty(screen, 'availHeight', {
      get: function() {
        if (FingerprintConfig.enabled && FingerprintConfig.options.screen) {
          return originalScreen.availHeight + heightVariance;
        }
        return originalScreen.availHeight;
      }
    });
  } catch (e) {
    console.warn('[FingerprintRandomizer] Could not override screen properties:', e);
  }

  return true;
}

// =============================================================================
// Main API Functions
// =============================================================================

/**
 * Apply all fingerprint protection measures
 * @param {Object} options - Protection options
 * @returns {Object} Status of applied protections
 */
function applyFingerprintProtection(options = {}) {
  // Merge options with defaults
  FingerprintConfig.options = {
    ...FingerprintConfig.options,
    ...options
  };

  if (options.noise) {
    FingerprintConfig.noise = {
      ...FingerprintConfig.noise,
      ...options.noise
    };
  }

  const status = {
    canvas: false,
    webgl: false,
    audio: false,
    navigator: false,
    screen: false
  };

  try {
    if (FingerprintConfig.options.canvas) {
      status.canvas = randomizeCanvasFingerprint();
    }
    if (FingerprintConfig.options.webgl) {
      status.webgl = randomizeWebGLFingerprint();
    }
    if (FingerprintConfig.options.audio) {
      status.audio = randomizeAudioFingerprint();
    }
    if (FingerprintConfig.options.navigator) {
      status.navigator = randomizeNavigatorProperties();
    }
    if (FingerprintConfig.options.screen) {
      status.screen = randomizeScreenProperties();
    }

    FingerprintConfig.enabled = true;
  } catch (e) {
    console.error('[FingerprintRandomizer] Error applying protection:', e);
  }

  return {
    success: true,
    enabled: FingerprintConfig.enabled,
    protections: status,
    profiles: {
      webgl: selectedWebGLProfile,
      navigator: selectedNavigatorProfile
    }
  };
}

/**
 * Get current fingerprint protection status
 * @returns {Object} Current protection status
 */
function getFingerprintStatus() {
  return {
    enabled: FingerprintConfig.enabled,
    options: { ...FingerprintConfig.options },
    noise: { ...FingerprintConfig.noise },
    profiles: {
      webgl: selectedWebGLProfile,
      navigator: selectedNavigatorProfile
    },
    originalValues: {
      navigator: OriginalValues.navigator,
      screen: originalScreen
    }
  };
}

/**
 * Disable fingerprint protection (note: some changes cannot be fully reverted)
 * @returns {Object} Status
 */
function disableFingerprintProtection() {
  FingerprintConfig.enabled = false;

  return {
    success: true,
    enabled: false,
    note: 'Protection disabled. Some browser API overrides remain in place but will return original values.'
  };
}

/**
 * Reset fingerprint to original values where possible
 * @returns {Object} Status
 */
function resetFingerprint() {
  FingerprintConfig.enabled = false;

  // Note: We can't fully restore original prototypes without page reload
  // But we can disable the noise addition

  return {
    success: true,
    enabled: false,
    note: 'Fingerprint protection disabled. Full reset requires page reload.',
    originalValues: {
      navigator: OriginalValues.navigator,
      screen: originalScreen
    }
  };
}

/**
 * Regenerate fingerprint profiles (get new random values)
 * @returns {Object} New profiles
 */
function regenerateProfiles() {
  selectedWebGLProfile = WebGLProfiles[Math.floor(Math.random() * WebGLProfiles.length)];
  selectedNavigatorProfile = NavigatorProfiles[Math.floor(Math.random() * NavigatorProfiles.length)];

  return {
    success: true,
    profiles: {
      webgl: selectedWebGLProfile,
      navigator: selectedNavigatorProfile
    }
  };
}

// =============================================================================
// Message Handlers (for content.js integration)
// =============================================================================

/**
 * Handle enable fingerprint protection message
 */
function handleEnableFingerprintProtection(options = {}) {
  return applyFingerprintProtection(options);
}

/**
 * Handle disable fingerprint protection message
 */
function handleDisableFingerprintProtection() {
  return disableFingerprintProtection();
}

/**
 * Handle get fingerprint status message
 */
function handleGetFingerprintStatus() {
  return getFingerprintStatus();
}

/**
 * Handle regenerate profiles message
 */
function handleRegenerateProfiles() {
  return regenerateProfiles();
}

// Export for content script
if (typeof window !== 'undefined') {
  window.FingerprintRandomizer = {
    applyProtection: applyFingerprintProtection,
    getStatus: getFingerprintStatus,
    disable: disableFingerprintProtection,
    reset: resetFingerprint,
    regenerate: regenerateProfiles,
    config: FingerprintConfig
  };
}
