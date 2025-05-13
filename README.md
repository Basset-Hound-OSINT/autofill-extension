# autofill-extension
A browser extension to help autofill data from basset-hound server.


## Install In Chrome

1. Go to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click on "Load unpacked"
4. Select the `extension` directory
5. The extension will be loaded and will be available for use in Chrome

## Install in Firefox


**Temporary Extension Installation in Firefox**

1. Go to about:debugging
2. Click on "This Firefox"
3. Click on "Load Temporary Add-on"
4. Select the `manifest.json` file from the extension directory
5. The extension will be loaded temporarily and will be available for use in Firefox

**Use MV3 + Enable Flags in Firefox**

> Firefox does not support MV3 extensions by default. You need to enable some flags to use MV3 extensions.

1. Go to about:config
2. Set:
   1. extensions.manifestV3.enabled = true
   2. extensions.backgroundServiceWorker.enabled = true