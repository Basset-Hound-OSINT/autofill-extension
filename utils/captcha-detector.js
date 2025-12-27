/**
 * Basset Hound Browser Automation - CAPTCHA Detector
 *
 * Comprehensive CAPTCHA detection utility that identifies:
 * - reCAPTCHA v2 (checkbox and invisible)
 * - reCAPTCHA v3 (invisible/score-based)
 * - hCaptcha
 * - Cloudflare Turnstile
 * - FunCaptcha/Arkose Labs
 * - Image-based CAPTCHAs
 * - Text-based CAPTCHAs
 * - Math CAPTCHAs
 * - Audio CAPTCHAs
 * - Slider/Puzzle CAPTCHAs
 *
 * Features:
 * - Detection of CAPTCHA type and provider
 * - State detection (solved, unsolved, expired, challenge)
 * - Element location and bounding box
 * - Site key extraction where applicable
 * - Challenge frame detection
 */

// =============================================================================
// CAPTCHA Type Definitions
// =============================================================================

const CaptchaTypes = {
  RECAPTCHA_V2_CHECKBOX: 'recaptcha_v2_checkbox',
  RECAPTCHA_V2_INVISIBLE: 'recaptcha_v2_invisible',
  RECAPTCHA_V3: 'recaptcha_v3',
  HCAPTCHA: 'hcaptcha',
  CLOUDFLARE_TURNSTILE: 'cloudflare_turnstile',
  FUNCAPTCHA: 'funcaptcha',
  IMAGE_CAPTCHA: 'image_captcha',
  TEXT_CAPTCHA: 'text_captcha',
  MATH_CAPTCHA: 'math_captcha',
  AUDIO_CAPTCHA: 'audio_captcha',
  SLIDER_CAPTCHA: 'slider_captcha',
  PUZZLE_CAPTCHA: 'puzzle_captcha',
  GEETEST: 'geetest',
  KEYCAPTCHA: 'keycaptcha',
  CAPY: 'capy',
  UNKNOWN: 'unknown'
};

const CaptchaStates = {
  UNSOLVED: 'unsolved',
  SOLVED: 'solved',
  EXPIRED: 'expired',
  CHALLENGE_VISIBLE: 'challenge_visible',
  LOADING: 'loading',
  ERROR: 'error',
  INVISIBLE: 'invisible',
  UNKNOWN: 'unknown'
};

// =============================================================================
// CaptchaDetector Class
// =============================================================================

class CaptchaDetector {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.includeScreenshots = options.includeScreenshots || false;
  }

  /**
   * Detect all CAPTCHAs on the page
   * @returns {Array} Array of detected CAPTCHA objects
   */
  detectAll() {
    const captchas = [];

    // Detect each CAPTCHA type
    const detectors = [
      this.detectRecaptchaV2.bind(this),
      this.detectRecaptchaV3.bind(this),
      this.detectHCaptcha.bind(this),
      this.detectCloudflare.bind(this),
      this.detectFunCaptcha.bind(this),
      this.detectGeetest.bind(this),
      this.detectKeyCaptcha.bind(this),
      this.detectCapy.bind(this),
      this.detectSliderCaptcha.bind(this),
      this.detectImageCaptcha.bind(this),
      this.detectTextCaptcha.bind(this),
      this.detectMathCaptcha.bind(this),
      this.detectAudioCaptcha.bind(this)
    ];

    for (const detector of detectors) {
      try {
        const results = detector();
        if (results) {
          if (Array.isArray(results)) {
            captchas.push(...results);
          } else {
            captchas.push(results);
          }
        }
      } catch (error) {
        this.logger.error?.('CAPTCHA detection error:', error) ||
          console.error('CAPTCHA detection error:', error);
      }
    }

    return captchas;
  }

  /**
   * Detect reCAPTCHA v2 (checkbox and invisible)
   * @returns {Object|Array|null} Detected CAPTCHA info
   */
  detectRecaptchaV2() {
    const results = [];

    // Check for reCAPTCHA v2 widget elements
    const recaptchaElements = document.querySelectorAll(
      '.g-recaptcha, [data-sitekey], .recaptcha, #g-recaptcha'
    );

    for (const element of recaptchaElements) {
      const siteKey = element.getAttribute('data-sitekey');
      const isInvisible = element.getAttribute('data-size') === 'invisible' ||
                          element.getAttribute('data-badge') !== null;

      // Get the iframe if rendered
      const iframe = element.querySelector('iframe[src*="recaptcha"]') ||
                     element.querySelector('iframe[title*="reCAPTCHA"]');

      // Determine state
      let state = CaptchaStates.UNSOLVED;

      // Check for response token (solved state)
      const responseInput = document.querySelector('[name="g-recaptcha-response"]') ||
                           element.querySelector('textarea[name="g-recaptcha-response"]');
      if (responseInput && responseInput.value && responseInput.value.length > 0) {
        state = CaptchaStates.SOLVED;
      }

      // Check for visible challenge
      const challengeFrame = document.querySelector(
        'iframe[src*="recaptcha/api2/bframe"], iframe[title*="challenge"]'
      );
      if (challengeFrame && this.isElementVisible(challengeFrame)) {
        state = CaptchaStates.CHALLENGE_VISIBLE;
      }

      // Check for expiration
      const expiredMessage = element.querySelector('.rc-anchor-expired-warning');
      if (expiredMessage && this.isElementVisible(expiredMessage)) {
        state = CaptchaStates.EXPIRED;
      }

      // Check for checkbox state
      const checkbox = element.querySelector('.recaptcha-checkbox');
      if (checkbox) {
        const checkboxChecked = checkbox.getAttribute('aria-checked') === 'true';
        if (checkboxChecked) {
          state = CaptchaStates.SOLVED;
        }
      }

      results.push({
        type: isInvisible ? CaptchaTypes.RECAPTCHA_V2_INVISIBLE : CaptchaTypes.RECAPTCHA_V2_CHECKBOX,
        provider: 'google',
        siteKey,
        state,
        element: this.getElementInfo(element),
        iframe: iframe ? this.getElementInfo(iframe) : null,
        challengeVisible: state === CaptchaStates.CHALLENGE_VISIBLE,
        hasResponseToken: state === CaptchaStates.SOLVED,
        selector: this.generateSelector(element),
        boundingBox: this.getBoundingBox(element),
        visible: this.isElementVisible(element)
      });
    }

    // Also check for standalone reCAPTCHA iframes
    const standaloneIframes = document.querySelectorAll(
      'iframe[src*="google.com/recaptcha"], iframe[src*="recaptcha.net"]'
    );

    for (const iframe of standaloneIframes) {
      // Skip if already captured via parent element
      if (iframe.closest('.g-recaptcha, [data-sitekey]')) continue;

      const src = iframe.src || '';
      const siteKeyMatch = src.match(/[?&]k=([^&]+)/);
      const siteKey = siteKeyMatch ? siteKeyMatch[1] : null;

      results.push({
        type: CaptchaTypes.RECAPTCHA_V2_CHECKBOX,
        provider: 'google',
        siteKey,
        state: CaptchaStates.UNSOLVED,
        element: this.getElementInfo(iframe),
        iframe: this.getElementInfo(iframe),
        selector: this.generateSelector(iframe),
        boundingBox: this.getBoundingBox(iframe),
        visible: this.isElementVisible(iframe)
      });
    }

    return results.length > 0 ? results : null;
  }

  /**
   * Detect reCAPTCHA v3 (invisible/score-based)
   * @returns {Object|null} Detected CAPTCHA info
   */
  detectRecaptchaV3() {
    // Check for v3 script
    const v3Script = document.querySelector(
      'script[src*="recaptcha/api.js?render="], script[src*="recaptcha/enterprise.js?render="]'
    );

    if (v3Script) {
      const src = v3Script.src;
      const siteKeyMatch = src.match(/render=([^&]+)/);
      const siteKey = siteKeyMatch ? siteKeyMatch[1] : null;

      // v3 is always invisible
      return {
        type: CaptchaTypes.RECAPTCHA_V3,
        provider: 'google',
        siteKey,
        state: CaptchaStates.INVISIBLE,
        element: null,
        iframe: null,
        visible: false,
        isEnterprise: src.includes('enterprise.js'),
        scriptSrc: src
      };
    }

    // Check for grecaptcha.execute calls via global object
    if (typeof window.grecaptcha !== 'undefined' && window.grecaptcha.execute) {
      return {
        type: CaptchaTypes.RECAPTCHA_V3,
        provider: 'google',
        siteKey: null, // Cannot extract without DOM element
        state: CaptchaStates.INVISIBLE,
        element: null,
        visible: false
      };
    }

    return null;
  }

  /**
   * Detect hCaptcha
   * @returns {Object|Array|null} Detected CAPTCHA info
   */
  detectHCaptcha() {
    const results = [];

    // Check for hCaptcha elements
    const hcaptchaElements = document.querySelectorAll(
      '.h-captcha, [data-hcaptcha-sitekey], [data-sitekey][class*="hcaptcha"]'
    );

    for (const element of hcaptchaElements) {
      const siteKey = element.getAttribute('data-sitekey') ||
                      element.getAttribute('data-hcaptcha-sitekey');

      // Check for response token
      const responseInput = element.querySelector('textarea[name="h-captcha-response"]') ||
                           document.querySelector('textarea[name="h-captcha-response"]');

      let state = CaptchaStates.UNSOLVED;
      if (responseInput && responseInput.value && responseInput.value.length > 0) {
        state = CaptchaStates.SOLVED;
      }

      // Check for visible challenge
      const challengeFrame = document.querySelector(
        'iframe[src*="hcaptcha.com/captcha"]'
      );
      if (challengeFrame && this.isElementVisible(challengeFrame)) {
        state = CaptchaStates.CHALLENGE_VISIBLE;
      }

      // Get the checkbox iframe
      const checkboxIframe = element.querySelector('iframe[src*="hcaptcha"]') ||
                             element.querySelector('iframe[data-hcaptcha-widget-id]');

      results.push({
        type: CaptchaTypes.HCAPTCHA,
        provider: 'hcaptcha',
        siteKey,
        state,
        element: this.getElementInfo(element),
        iframe: checkboxIframe ? this.getElementInfo(checkboxIframe) : null,
        challengeVisible: state === CaptchaStates.CHALLENGE_VISIBLE,
        hasResponseToken: state === CaptchaStates.SOLVED,
        selector: this.generateSelector(element),
        boundingBox: this.getBoundingBox(element),
        visible: this.isElementVisible(element)
      });
    }

    // Check for hCaptcha script presence
    const hcaptchaScript = document.querySelector('script[src*="hcaptcha.com/1/api.js"]');
    if (hcaptchaScript && results.length === 0) {
      // Script loaded but no widget found - might be invisible mode
      return {
        type: CaptchaTypes.HCAPTCHA,
        provider: 'hcaptcha',
        siteKey: null,
        state: CaptchaStates.INVISIBLE,
        visible: false,
        scriptPresent: true
      };
    }

    return results.length > 0 ? results : null;
  }

  /**
   * Detect Cloudflare Turnstile
   * @returns {Object|Array|null} Detected CAPTCHA info
   */
  detectCloudflare() {
    const results = [];

    // Check for Turnstile elements
    const turnstileElements = document.querySelectorAll(
      '.cf-turnstile, [data-turnstile-sitekey], [data-sitekey][class*="turnstile"]'
    );

    for (const element of turnstileElements) {
      const siteKey = element.getAttribute('data-sitekey');

      // Check for response token
      const responseInput = element.querySelector('input[name="cf-turnstile-response"]') ||
                           document.querySelector('input[name="cf-turnstile-response"]');

      let state = CaptchaStates.UNSOLVED;
      if (responseInput && responseInput.value && responseInput.value.length > 0) {
        state = CaptchaStates.SOLVED;
      }

      // Get the iframe
      const iframe = element.querySelector('iframe[src*="challenges.cloudflare.com"]');

      // Check if in challenge mode
      if (iframe && this.isElementVisible(iframe)) {
        const iframeSrc = iframe.src || '';
        if (iframeSrc.includes('turnstile')) {
          // Widget is visible and active
        }
      }

      results.push({
        type: CaptchaTypes.CLOUDFLARE_TURNSTILE,
        provider: 'cloudflare',
        siteKey,
        state,
        element: this.getElementInfo(element),
        iframe: iframe ? this.getElementInfo(iframe) : null,
        hasResponseToken: state === CaptchaStates.SOLVED,
        selector: this.generateSelector(element),
        boundingBox: this.getBoundingBox(element),
        visible: this.isElementVisible(element)
      });
    }

    // Check for Cloudflare challenge page
    const cfChallenge = document.querySelector('#challenge-form, .cf-browser-verification');
    if (cfChallenge) {
      results.push({
        type: CaptchaTypes.CLOUDFLARE_TURNSTILE,
        provider: 'cloudflare',
        siteKey: null,
        state: CaptchaStates.CHALLENGE_VISIBLE,
        element: this.getElementInfo(cfChallenge),
        isChallengePage: true,
        selector: this.generateSelector(cfChallenge),
        boundingBox: this.getBoundingBox(cfChallenge),
        visible: true
      });
    }

    return results.length > 0 ? results : null;
  }

  /**
   * Detect FunCaptcha/Arkose Labs
   * @returns {Object|Array|null} Detected CAPTCHA info
   */
  detectFunCaptcha() {
    const results = [];

    // Check for FunCaptcha elements
    const funcaptchaElements = document.querySelectorAll(
      '#funcaptcha, [data-pkey], [data-public-key], .funcaptcha, ' +
      '#arkose-container, [id*="arkose"], [class*="arkose"]'
    );

    for (const element of funcaptchaElements) {
      const publicKey = element.getAttribute('data-pkey') ||
                        element.getAttribute('data-public-key');

      // Check for response token
      const responseInput = element.querySelector('input[name="fc-token"]') ||
                           document.querySelector('input[name="fc-token"]');

      let state = CaptchaStates.UNSOLVED;
      if (responseInput && responseInput.value && responseInput.value.length > 0) {
        state = CaptchaStates.SOLVED;
      }

      // Check for challenge iframe
      const challengeIframe = document.querySelector(
        'iframe[src*="funcaptcha.com"], iframe[src*="arkoselabs.com"], iframe[src*="client-api"]'
      );
      if (challengeIframe && this.isElementVisible(challengeIframe)) {
        state = CaptchaStates.CHALLENGE_VISIBLE;
      }

      results.push({
        type: CaptchaTypes.FUNCAPTCHA,
        provider: 'arkose',
        publicKey,
        state,
        element: this.getElementInfo(element),
        challengeVisible: state === CaptchaStates.CHALLENGE_VISIBLE,
        hasResponseToken: state === CaptchaStates.SOLVED,
        selector: this.generateSelector(element),
        boundingBox: this.getBoundingBox(element),
        visible: this.isElementVisible(element)
      });
    }

    return results.length > 0 ? results : null;
  }

  /**
   * Detect Geetest CAPTCHA
   * @returns {Object|null} Detected CAPTCHA info
   */
  detectGeetest() {
    // Check for Geetest elements
    const geetestElement = document.querySelector(
      '.geetest_holder, .geetest_panel, .geetest-holder, [id*="geetest"], [class*="geetest"]'
    );

    if (geetestElement) {
      // Check for validation token
      const validateInput = document.querySelector(
        'input[name*="geetest_validate"], input[name*="geetest_seccode"]'
      );

      let state = CaptchaStates.UNSOLVED;
      if (validateInput && validateInput.value) {
        state = CaptchaStates.SOLVED;
      }

      // Check for visible challenge
      const panel = document.querySelector('.geetest_panel_show, .geetest_popup');
      if (panel && this.isElementVisible(panel)) {
        state = CaptchaStates.CHALLENGE_VISIBLE;
      }

      return {
        type: CaptchaTypes.GEETEST,
        provider: 'geetest',
        state,
        element: this.getElementInfo(geetestElement),
        challengeVisible: state === CaptchaStates.CHALLENGE_VISIBLE,
        selector: this.generateSelector(geetestElement),
        boundingBox: this.getBoundingBox(geetestElement),
        visible: this.isElementVisible(geetestElement)
      };
    }

    return null;
  }

  /**
   * Detect KeyCaptcha
   * @returns {Object|null} Detected CAPTCHA info
   */
  detectKeyCaptcha() {
    const keycaptchaElement = document.querySelector(
      '#keycaptcha_container, [id*="keycaptcha"], .keycaptcha'
    );

    if (keycaptchaElement) {
      return {
        type: CaptchaTypes.KEYCAPTCHA,
        provider: 'keycaptcha',
        state: CaptchaStates.UNSOLVED,
        element: this.getElementInfo(keycaptchaElement),
        selector: this.generateSelector(keycaptchaElement),
        boundingBox: this.getBoundingBox(keycaptchaElement),
        visible: this.isElementVisible(keycaptchaElement)
      };
    }

    return null;
  }

  /**
   * Detect Capy CAPTCHA
   * @returns {Object|null} Detected CAPTCHA info
   */
  detectCapy() {
    const capyElement = document.querySelector(
      '.capy_captcha, #capy-captcha, [class*="capy"], [id*="capy"]'
    );

    if (capyElement) {
      return {
        type: CaptchaTypes.CAPY,
        provider: 'capy',
        state: CaptchaStates.UNSOLVED,
        element: this.getElementInfo(capyElement),
        selector: this.generateSelector(capyElement),
        boundingBox: this.getBoundingBox(capyElement),
        visible: this.isElementVisible(capyElement)
      };
    }

    return null;
  }

  /**
   * Detect slider/puzzle CAPTCHAs
   * @returns {Object|Array|null} Detected CAPTCHA info
   */
  detectSliderCaptcha() {
    const results = [];

    // Common slider CAPTCHA selectors
    const sliderSelectors = [
      '.slider-captcha',
      '.slide-verify',
      '.nc-container',           // Alibaba NC
      '.nc_wrapper',
      '[class*="slider-captcha"]',
      '[class*="slide-verify"]',
      '[class*="drag-verify"]',
      '.captcha-slider',
      '#slide-verify',
      '.verify-wrap'
    ];

    const sliderElements = document.querySelectorAll(sliderSelectors.join(', '));

    for (const element of sliderElements) {
      // Check if slider has been completed
      const completed = element.classList.contains('success') ||
                       element.classList.contains('verified') ||
                       element.querySelector('.success, .verified');

      results.push({
        type: CaptchaTypes.SLIDER_CAPTCHA,
        provider: 'slider',
        state: completed ? CaptchaStates.SOLVED : CaptchaStates.UNSOLVED,
        element: this.getElementInfo(element),
        selector: this.generateSelector(element),
        boundingBox: this.getBoundingBox(element),
        visible: this.isElementVisible(element)
      });
    }

    return results.length > 0 ? results : null;
  }

  /**
   * Detect image-based CAPTCHAs
   * @returns {Object|Array|null} Detected CAPTCHA info
   */
  detectImageCaptcha() {
    const results = [];

    // Look for CAPTCHA images
    const captchaImages = document.querySelectorAll(
      'img[src*="captcha"], img[alt*="captcha" i], img[id*="captcha" i], ' +
      'img[class*="captcha" i], img[src*="verify"], img[src*="security"]'
    );

    for (const img of captchaImages) {
      // Look for associated input field
      const container = img.closest('form, .captcha-container, [class*="captcha"], div');
      let inputField = null;

      if (container) {
        inputField = container.querySelector(
          'input[name*="captcha" i], input[id*="captcha" i], ' +
          'input[placeholder*="captcha" i], input[type="text"]'
        );
      }

      // Check if already solved
      const state = (inputField && inputField.value.length > 0)
        ? CaptchaStates.SOLVED
        : CaptchaStates.UNSOLVED;

      results.push({
        type: CaptchaTypes.IMAGE_CAPTCHA,
        provider: 'custom',
        state,
        imageElement: this.getElementInfo(img),
        imageSrc: img.src,
        inputElement: inputField ? this.getElementInfo(inputField) : null,
        inputSelector: inputField ? this.generateSelector(inputField) : null,
        selector: this.generateSelector(img),
        boundingBox: this.getBoundingBox(img),
        visible: this.isElementVisible(img)
      });
    }

    return results.length > 0 ? results : null;
  }

  /**
   * Detect text-based CAPTCHAs (challenge questions)
   * @returns {Object|Array|null} Detected CAPTCHA info
   */
  detectTextCaptcha() {
    const results = [];

    // Look for text CAPTCHA containers
    const textCaptchaSelectors = [
      '[class*="captcha"][class*="text"]',
      '.text-captcha',
      '.captcha-question',
      'label[for*="captcha"]'
    ];

    const containers = document.querySelectorAll(textCaptchaSelectors.join(', '));

    for (const container of containers) {
      // Look for question text
      const questionText = container.textContent || '';

      // Skip if too long (probably not a simple CAPTCHA)
      if (questionText.length > 200) continue;

      // Look for associated input
      const parent = container.closest('form, div');
      const inputField = parent?.querySelector(
        'input[type="text"], input[name*="captcha"]'
      );

      if (inputField) {
        const state = inputField.value.length > 0
          ? CaptchaStates.SOLVED
          : CaptchaStates.UNSOLVED;

        results.push({
          type: CaptchaTypes.TEXT_CAPTCHA,
          provider: 'custom',
          state,
          question: questionText.trim().substring(0, 200),
          inputElement: this.getElementInfo(inputField),
          selector: this.generateSelector(container),
          boundingBox: this.getBoundingBox(container),
          visible: this.isElementVisible(container)
        });
      }
    }

    return results.length > 0 ? results : null;
  }

  /**
   * Detect math-based CAPTCHAs
   * @returns {Object|Array|null} Detected CAPTCHA info
   */
  detectMathCaptcha() {
    const results = [];

    // Look for math CAPTCHA patterns
    const allElements = document.querySelectorAll(
      '[class*="captcha"], [id*="captcha"], label'
    );

    for (const element of allElements) {
      const text = element.textContent || '';

      // Match patterns like "3 + 5 = ?", "What is 2 + 2?", "7 - 3 = "
      const mathPatterns = [
        /(\d+)\s*[\+\-\*x]\s*(\d+)\s*=\s*\?/,
        /what\s+is\s+(\d+)\s*[\+\-\*x]\s*(\d+)/i,
        /solve[:\s]+(\d+)\s*[\+\-\*x]\s*(\d+)/i,
        /(\d+)\s*[\+\-\*x]\s*(\d+)\s*=\s*$/
      ];

      for (const pattern of mathPatterns) {
        if (pattern.test(text)) {
          // Found a math CAPTCHA
          const parent = element.closest('form, div, .captcha-container');
          const inputField = parent?.querySelector(
            'input[type="text"], input[type="number"], input[name*="captcha"]'
          );

          if (inputField) {
            const state = inputField.value.length > 0
              ? CaptchaStates.SOLVED
              : CaptchaStates.UNSOLVED;

            // Extract the math expression
            const match = text.match(/(\d+)\s*([\+\-\*x])\s*(\d+)/);
            let expression = null;
            let expectedAnswer = null;

            if (match) {
              const num1 = parseInt(match[1], 10);
              const operator = match[2];
              const num2 = parseInt(match[3], 10);
              expression = `${num1} ${operator} ${num2}`;

              // Calculate expected answer
              switch (operator) {
                case '+': expectedAnswer = num1 + num2; break;
                case '-': expectedAnswer = num1 - num2; break;
                case '*':
                case 'x': expectedAnswer = num1 * num2; break;
              }
            }

            results.push({
              type: CaptchaTypes.MATH_CAPTCHA,
              provider: 'custom',
              state,
              question: text.trim().substring(0, 100),
              expression,
              expectedAnswer,
              inputElement: this.getElementInfo(inputField),
              inputSelector: this.generateSelector(inputField),
              selector: this.generateSelector(element),
              boundingBox: this.getBoundingBox(element),
              visible: this.isElementVisible(element)
            });
            break;
          }
        }
      }
    }

    return results.length > 0 ? results : null;
  }

  /**
   * Detect audio CAPTCHAs
   * @returns {Object|Array|null} Detected CAPTCHA info
   */
  detectAudioCaptcha() {
    const results = [];

    // Look for audio CAPTCHA elements
    const audioElements = document.querySelectorAll(
      'audio[src*="captcha"], [class*="audio-captcha"], ' +
      'button[class*="audio"][class*="captcha"], a[href*="audio"][href*="captcha"]'
    );

    for (const element of audioElements) {
      const audioSrc = element.src || element.querySelector('source')?.src || null;

      results.push({
        type: CaptchaTypes.AUDIO_CAPTCHA,
        provider: 'custom',
        state: CaptchaStates.UNSOLVED,
        audioSrc,
        element: this.getElementInfo(element),
        selector: this.generateSelector(element),
        boundingBox: this.getBoundingBox(element),
        visible: this.isElementVisible(element)
      });
    }

    return results.length > 0 ? results : null;
  }

  /**
   * Detect CAPTCHA within a specific container (e.g., a form)
   * @param {HTMLElement} container - Container element to search within
   * @returns {Object|null} Detected CAPTCHA info
   */
  detectInContainer(container) {
    if (!container) return null;

    // Check for each CAPTCHA type within the container

    // reCAPTCHA v2
    const recaptcha = container.querySelector('.g-recaptcha, [data-sitekey]');
    if (recaptcha) {
      const siteKey = recaptcha.getAttribute('data-sitekey');
      const responseInput = container.querySelector('[name="g-recaptcha-response"]');
      const state = (responseInput && responseInput.value)
        ? CaptchaStates.SOLVED
        : CaptchaStates.UNSOLVED;

      return {
        type: CaptchaTypes.RECAPTCHA_V2_CHECKBOX,
        provider: 'google',
        siteKey,
        state,
        selector: this.generateSelector(recaptcha),
        boundingBox: this.getBoundingBox(recaptcha),
        visible: this.isElementVisible(recaptcha)
      };
    }

    // hCaptcha
    const hcaptcha = container.querySelector('.h-captcha, [data-hcaptcha-sitekey]');
    if (hcaptcha) {
      const siteKey = hcaptcha.getAttribute('data-sitekey') ||
                      hcaptcha.getAttribute('data-hcaptcha-sitekey');
      const responseInput = container.querySelector('[name="h-captcha-response"]');
      const state = (responseInput && responseInput.value)
        ? CaptchaStates.SOLVED
        : CaptchaStates.UNSOLVED;

      return {
        type: CaptchaTypes.HCAPTCHA,
        provider: 'hcaptcha',
        siteKey,
        state,
        selector: this.generateSelector(hcaptcha),
        boundingBox: this.getBoundingBox(hcaptcha),
        visible: this.isElementVisible(hcaptcha)
      };
    }

    // Cloudflare Turnstile
    const turnstile = container.querySelector('.cf-turnstile, [data-turnstile-sitekey]');
    if (turnstile) {
      const siteKey = turnstile.getAttribute('data-sitekey');
      const responseInput = container.querySelector('[name="cf-turnstile-response"]');
      const state = (responseInput && responseInput.value)
        ? CaptchaStates.SOLVED
        : CaptchaStates.UNSOLVED;

      return {
        type: CaptchaTypes.CLOUDFLARE_TURNSTILE,
        provider: 'cloudflare',
        siteKey,
        state,
        selector: this.generateSelector(turnstile),
        boundingBox: this.getBoundingBox(turnstile),
        visible: this.isElementVisible(turnstile)
      };
    }

    // FunCaptcha
    const funcaptcha = container.querySelector('#funcaptcha, [data-pkey]');
    if (funcaptcha) {
      const publicKey = funcaptcha.getAttribute('data-pkey');
      return {
        type: CaptchaTypes.FUNCAPTCHA,
        provider: 'arkose',
        publicKey,
        state: CaptchaStates.UNSOLVED,
        selector: this.generateSelector(funcaptcha),
        boundingBox: this.getBoundingBox(funcaptcha),
        visible: this.isElementVisible(funcaptcha)
      };
    }

    // Image CAPTCHA
    const imageCaptcha = container.querySelector(
      'img[src*="captcha"], img[alt*="captcha" i], img[class*="captcha" i]'
    );
    if (imageCaptcha) {
      const inputField = container.querySelector(
        'input[name*="captcha" i], input[id*="captcha" i]'
      );
      const state = (inputField && inputField.value)
        ? CaptchaStates.SOLVED
        : CaptchaStates.UNSOLVED;

      return {
        type: CaptchaTypes.IMAGE_CAPTCHA,
        provider: 'custom',
        state,
        imageSrc: imageCaptcha.src,
        imageSelector: this.generateSelector(imageCaptcha),
        inputSelector: inputField ? this.generateSelector(inputField) : null,
        selector: this.generateSelector(imageCaptcha),
        boundingBox: this.getBoundingBox(imageCaptcha),
        visible: this.isElementVisible(imageCaptcha)
      };
    }

    // Generic CAPTCHA text/element
    const captchaElement = container.querySelector(
      '[class*="captcha"], [id*="captcha"]'
    );
    if (captchaElement && captchaElement.textContent.toLowerCase().includes('captcha')) {
      return {
        type: CaptchaTypes.UNKNOWN,
        provider: 'unknown',
        state: CaptchaStates.UNKNOWN,
        selector: this.generateSelector(captchaElement),
        boundingBox: this.getBoundingBox(captchaElement),
        visible: this.isElementVisible(captchaElement)
      };
    }

    return null;
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  /**
   * Get information about an element
   * @param {HTMLElement} element - Element
   * @returns {Object} Element info
   */
  getElementInfo(element) {
    if (!element) return null;

    return {
      tagName: element.tagName?.toLowerCase(),
      id: element.id || null,
      className: element.className || null,
      name: element.name || null,
      src: element.src || null,
      title: element.title || null
    };
  }

  /**
   * Generate a CSS selector for an element
   * @param {HTMLElement} element - Element
   * @returns {string} CSS selector
   */
  generateSelector(element) {
    if (!element) return '';

    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }

    if (element.name) {
      const selector = `[name="${CSS.escape(element.name)}"]`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }

    // Build path
    const path = [];
    let current = element;
    let depth = 0;

    while (current && current !== document.body && depth < 5) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        path.unshift(`#${CSS.escape(current.id)}`);
        break;
      }

      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          c => c.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }

      path.unshift(selector);
      current = parent;
      depth++;
    }

    return path.join(' > ');
  }

  /**
   * Check if an element is visible
   * @param {HTMLElement} element - Element
   * @returns {boolean} True if visible
   */
  isElementVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    if (style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0') {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Get bounding box of an element
   * @param {HTMLElement} element - Element
   * @returns {Object|null} Bounding box
   */
  getBoundingBox(element) {
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    return {
      x: Math.round(rect.x + window.scrollX),
      y: Math.round(rect.y + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      top: Math.round(rect.top + window.scrollY),
      left: Math.round(rect.left + window.scrollX),
      bottom: Math.round(rect.bottom + window.scrollY),
      right: Math.round(rect.right + window.scrollX),
      viewportTop: Math.round(rect.top),
      viewportLeft: Math.round(rect.left)
    };
  }

  /**
   * Get a summary of all detected CAPTCHAs
   * @returns {Object} Summary object
   */
  getSummary() {
    const captchas = this.detectAll();

    return {
      hasCaptcha: captchas.length > 0,
      count: captchas.length,
      types: [...new Set(captchas.map(c => c.type))],
      providers: [...new Set(captchas.map(c => c.provider))],
      anyUnsolved: captchas.some(c =>
        c.state === CaptchaStates.UNSOLVED ||
        c.state === CaptchaStates.CHALLENGE_VISIBLE
      ),
      allSolved: captchas.length > 0 && captchas.every(c =>
        c.state === CaptchaStates.SOLVED ||
        c.state === CaptchaStates.INVISIBLE
      ),
      captchas
    };
  }
}

// =============================================================================
// Export
// =============================================================================

if (typeof globalThis !== 'undefined') {
  globalThis.CaptchaDetector = CaptchaDetector;
  globalThis.CaptchaTypes = CaptchaTypes;
  globalThis.CaptchaStates = CaptchaStates;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CaptchaDetector, CaptchaTypes, CaptchaStates };
}
