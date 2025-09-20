chrome.action.onClicked.addListener((tab) => {
  // When extension icon is clicked, inject content.js into active tab
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  });
});
