chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'autopopulate' && msg.config.fields) {
    for (const selector in msg.config.fields) {
      const element = document.querySelector(selector);
      if (element) {
        element.value = msg.config.fields[selector];
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }
});