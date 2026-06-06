async function injectIntoExistingTabs() {
  const tabs = await chrome.tabs.query({ url: ['https://*/*', 'http://*/*'] });
  for (const tab of tabs) {
    if (!tab.id) continue;
    // sizing.js must go first — content.js calls pickSize/buildCaveats defined there
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['sizing.js', 'content.js']
    }).catch(() => {});
    chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['injected.css']
    }).catch(() => {});
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }
  // Inject into tabs already open so the user doesn't need to manually refresh
  injectIntoExistingTabs();
});

// Re-inject when Chrome restarts (tabs survive but content scripts don't)
chrome.runtime.onStartup.addListener(injectIntoExistingTabs);
