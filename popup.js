document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab && currentTab.url) {
      if (currentTab.url.includes('netflix.com')) {
        const content = document.querySelector('.content');
        const successMsg = document.createElement('div');
        successMsg.style.cssText = `
            background: white;
            color: #764ba2;
            border: 1px solid #d0b9ea;
            padding: 10px;
            border-radius: 6px;
            margin-top: 16px;
            text-align: center;
            font-size: 13px;
          `;
        successMsg.innerHTML = '`<strong>Waiting to detect media</strong> Select a movie or TV show to get started!';
        content.appendChild(successMsg);
      } else {
        // Add hint for non-Netflix pages
        const content = document.querySelector('.content');
        const hint = document.createElement('div');
        hint.style.cssText = `
            background: white;
            color: #764ba2;
            border: 1px solid #d0b9ea;
            padding: 10px;
            border-radius: 6px;
            margin-top: 16px;
            text-align: center;
            font-size: 13px;
          `;
        hint.innerHTML = '<strong>Are you on Netflix?</strong> Go to Netflix.com to use this extension!';
        content.appendChild(hint);
      }
    }
  });
});