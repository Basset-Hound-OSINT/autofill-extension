chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'autopopulate' && msg.config.fields) {
    const allFields = msg.config.fields;

    for (const type in allFields) {
      const fieldsByType = allFields[type];
      for (const selector in fieldsByType) {
        const element = document.querySelector(selector);
        if (element) {
          element.value = fieldsByType[selector];
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }
  }
});
