/* Loads web extension. If user is on Netflix (the correct website), popup will prompt user to select a movie or TV show to
use the extension. If the user is not on Netflix, popup will prompt user to go to Netflix to use the extension :) */
document.addEventListener('DOMContentLoaded', () => {
  console.log('Netflix Movie Info Extension popup loaded');
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab && currentTab.url) {
      const isNetflix = currentTab.url.includes('netflix.com'); // sees if website is right or not
      if (isNetflix) {
        const content = document.querySelector('.content');
        const successMsg = document.createElement('div');
        successMsg.style.cssText = `
          background: white;
          color: #764ba2ff;
          border: 1px solid #d0b9ea;
          padding: 10px;
          border-radius: 6px;
          margin-top: 16px;
          text-align: center;
          font-size: 13px;
        `;
        successMsg.innerHTML = 'ðŸŽ¯ <strong>Waiting to detect media...</strong> Select a movie or TV show to get started!';
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
        hint.innerHTML = 'ðŸ’¡ <strong>Are you on Netflix?</strong> Go to Netflix.com to use this extension!';
        content.appendChild(hint);
      }
    }
  });
});