async function getCurrentTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return new URL(tab.url).origin.replace(/^https?:\/\//, '');
}

async function loadConfig() {
  const origin = await getCurrentTabUrl();
  const res = await fetch(`http://localhost:5000/config?origin=${origin}`);
  const config = await res.json();
  const list = document.getElementById('fieldList');
  list.innerHTML = '';

  for (const type in config.fields) {
    const sectionHeader = document.createElement('h4');
    sectionHeader.textContent = type.toUpperCase();
    list.appendChild(sectionHeader);

    const fields = config.fields[type];
    for (const selector in fields) {
      const value = fields[selector];
      const div = document.createElement('div');
      div.className = 'field' + (!value ? ' empty' : '');
      div.textContent = `${selector} => ${value || '(empty)'}`;
      list.appendChild(div);
    }
  }

  document.getElementById('autopopulate').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'autopopulate', config });
  });
}

loadConfig();
