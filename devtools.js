/**
 * Basset Hound Browser Automation - DevTools Entry Point
 *
 * This script runs in the DevTools page context and creates the panel.
 * It acts as the bridge between Chrome DevTools and our custom panel.
 */

console.log('[Basset Hound DevTools] Initializing DevTools integration...');

// Create the Basset Hound panel in Chrome DevTools
chrome.devtools.panels.create(
  'Basset Hound',                    // Panel title
  'icons/icon48.svg',                // Icon path
  'devtools-panel.html',             // Panel HTML page
  (panel) => {
    console.log('[Basset Hound DevTools] Panel created successfully');

    // Panel lifecycle events
    panel.onShown.addListener((panelWindow) => {
      console.log('[Basset Hound DevTools] Panel shown');
      // The panel is now visible
      if (panelWindow && panelWindow.onPanelShown) {
        panelWindow.onPanelShown();
      }
    });

    panel.onHidden.addListener(() => {
      console.log('[Basset Hound DevTools] Panel hidden');
    });
  }
);

// Listen for network requests (can be forwarded to panel)
chrome.devtools.network.onRequestFinished.addListener((request) => {
  // Forward network requests to the panel if it's open
  chrome.runtime.sendMessage({
    type: 'devtools_network_request',
    request: {
      url: request.request.url,
      method: request.request.method,
      status: request.response.status,
      statusText: request.response.statusText,
      time: request.time,
      initiator: request.initiator
    }
  });
});

// Listen for navigation events
chrome.devtools.network.onNavigated.addListener((url) => {
  console.log('[Basset Hound DevTools] Navigation detected:', url);
  chrome.runtime.sendMessage({
    type: 'devtools_navigation',
    url: url
  });
});

console.log('[Basset Hound DevTools] DevTools script loaded');
