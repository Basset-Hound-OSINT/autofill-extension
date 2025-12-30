/**
 * E2E Setup Validation Tests
 *
 * These tests validate that the E2E testing infrastructure is properly configured
 * without requiring a display environment.
 */

const fs = require('fs');
const path = require('path');

describe('E2E Setup Validation', () => {
  describe('Dependencies', () => {
    test('should have puppeteer installed', () => {
      const packageJson = require('../../package.json');
      expect(packageJson.devDependencies).toHaveProperty('puppeteer');
    });

    test('should have chokidar-cli installed', () => {
      const packageJson = require('../../package.json');
      expect(packageJson.devDependencies).toHaveProperty('chokidar-cli');
    });

    test('should have nodemon installed', () => {
      const packageJson = require('../../package.json');
      expect(packageJson.devDependencies).toHaveProperty('nodemon');
    });
  });

  describe('Scripts', () => {
    test('should have test:e2e script', () => {
      const packageJson = require('../../package.json');
      expect(packageJson.scripts).toHaveProperty('test:e2e');
      expect(packageJson.scripts['test:e2e']).toContain('jest tests/e2e');
    });

    test('should have dev:watch script', () => {
      const packageJson = require('../../package.json');
      expect(packageJson.scripts).toHaveProperty('dev:watch');
      expect(packageJson.scripts['dev:watch']).toContain('chokidar');
    });

    test('should have dev:test:watch script', () => {
      const packageJson = require('../../package.json');
      expect(packageJson.scripts).toHaveProperty('dev:test:watch');
    });
  });

  describe('Files', () => {
    test('should have helpers.js', () => {
      const helpersPath = path.join(__dirname, 'helpers.js');
      expect(fs.existsSync(helpersPath)).toBe(true);
    });

    test('should have test-page.html', () => {
      const testPagePath = path.join(__dirname, 'test-page.html');
      expect(fs.existsSync(testPagePath)).toBe(true);
    });

    test('should have content-script.e2e.test.js', () => {
      const testFilePath = path.join(__dirname, 'content-script.e2e.test.js');
      expect(fs.existsSync(testFilePath)).toBe(true);
    });

    test('should have README.md', () => {
      const readmePath = path.join(__dirname, 'README.md');
      expect(fs.existsSync(readmePath)).toBe(true);
    });
  });

  describe('Helper Functions', () => {
    test('should export required helper functions', () => {
      const helpers = require('./helpers');

      expect(helpers).toHaveProperty('launchWithExtension');
      expect(helpers).toHaveProperty('waitForElement');
      expect(helpers).toHaveProperty('typeNaturally');
      expect(helpers).toHaveProperty('waitForPageLoad');
      expect(helpers).toHaveProperty('isElementVisible');
      expect(helpers).toHaveProperty('takeDebugScreenshot');
      expect(helpers).toHaveProperty('getExtensionBackgroundPage');
      expect(helpers).toHaveProperty('getExtensionId');
      expect(helpers).toHaveProperty('waitForExtensionReady');
      expect(helpers).toHaveProperty('getIframes');
    });

    test('helper functions should be callable', () => {
      const helpers = require('./helpers');

      expect(typeof helpers.launchWithExtension).toBe('function');
      expect(typeof helpers.waitForElement).toBe('function');
      expect(typeof helpers.typeNaturally).toBe('function');
      expect(typeof helpers.isElementVisible).toBe('function');
    });
  });

  describe('Extension Files', () => {
    test('should have manifest.json', () => {
      const manifestPath = path.join(__dirname, '../../manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);
    });

    test('manifest.json should be valid', () => {
      const manifestPath = path.join(__dirname, '../../manifest.json');
      const manifestContent = fs.readFileSync(manifestPath, 'utf8');

      expect(() => JSON.parse(manifestContent)).not.toThrow();

      const manifest = JSON.parse(manifestContent);
      expect(manifest).toHaveProperty('manifest_version');
      expect(manifest).toHaveProperty('name');
      expect(manifest).toHaveProperty('version');
    });

    test('should have background.js', () => {
      const backgroundPath = path.join(__dirname, '../../background.js');
      expect(fs.existsSync(backgroundPath)).toBe(true);
    });

    test('should have content.js', () => {
      const contentPath = path.join(__dirname, '../../content.js');
      expect(fs.existsSync(contentPath)).toBe(true);
    });
  });

  describe('Test Page', () => {
    test('test page should have required elements', () => {
      const testPagePath = path.join(__dirname, 'test-page.html');
      const html = fs.readFileSync(testPagePath, 'utf8');

      // Check for form elements
      expect(html).toContain('id="testForm"');
      expect(html).toContain('id="name"');
      expect(html).toContain('id="email"');
      expect(html).toContain('id="age"');
      expect(html).toContain('id="country"');
      expect(html).toContain('id="subscribe"');
      expect(html).toContain('id="terms"');
      expect(html).toContain('id="comments"');

      // Check for test elements
      expect(html).toContain('id="clickTest"');
      expect(html).toContain('id="hiddenElement"');
      expect(html).toContain('id="visibleElement"');
      expect(html).toContain('id="dynamicContent"');
    });
  });

  describe('Documentation', () => {
    test('should have E2E README', () => {
      const readmePath = path.join(__dirname, 'README.md');
      const readme = fs.readFileSync(readmePath, 'utf8');

      expect(readme).toContain('End-to-End');
      expect(readme).toContain('Puppeteer');
      expect(readme).toContain('npm run test:e2e');
    });

    test('should have development workflow guide', () => {
      const workflowPath = path.join(__dirname, '../../docs/DEVELOPMENT_WORKFLOW.md');
      expect(fs.existsSync(workflowPath)).toBe(true);
    });

    test('should have E2E testing setup docs', () => {
      const setupPath = path.join(__dirname, '../../docs/findings/E2E_TESTING_SETUP.md');
      expect(fs.existsSync(setupPath)).toBe(true);
    });
  });
});

// Note: This test validates the E2E infrastructure is set up correctly
// Actual E2E tests (content-script.e2e.test.js) require a display environment
// and should be run with: npm run test:e2e
