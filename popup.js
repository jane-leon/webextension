// Simple popup script - no API key management needed!

document.addEventListener('DOMContentLoaded', () => {
  console.log('Netflix Movie Info Extension popup loaded');

  // Check if we're on Netflix and show appropriate message
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab && currentTab.url) {
      const isNetflix = currentTab.url.includes('netflix.com');

      if (isNetflix) {
        // Add success message for Netflix pages
        const content = document.querySelector('.content');
        const successMsg = document.createElement('div');
        successMsg.style.cssText = `
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
            padding: 10px;
            border-radius: 6px;
            margin-top: 16px;
            text-align: center;
            font-size: 13px;
          `;
        successMsg.innerHTML = '🎯 <strong>Perfect!</strong> You\'re on Netflix. Start hovering over movies!';
        content.appendChild(successMsg);
      } else {
        // Add hint for non-Netflix pages
        const content = document.querySelector('.content');
        const hint = document.createElement('div');
        hint.style.cssText = `
            background: #fff3cd;
            color: #856404;
            border: 1px solid #ffeaa7;
            padding: 10px;
            border-radius: 6px;
            margin-top: 16px;
            text-align: center;
            font-size: 13px;
          `;
        hint.innerHTML = '💡 <strong>Tip:</strong> Navigate to Netflix.com to use this extension!';
        content.appendChild(hint);
      }
    }
  });
});