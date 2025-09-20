/* Loads web extension. If user is on Netflix (the correct website), popup will prompt user to select a movie or TV show to 
use the extension. If the user is not on Netflix, popup will prompt user to go to Netflix to use the extension :) */
document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab && currentTab.url) {
      if (currentTab.url.includes('netflix.com')) {
        const content = document.querySelector('.content');
        //TODO: TRY TO CHANGE SUCCESSMSG.STYLE TO GO IN POPUP.CSS AND TEST
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
        const content = document.querySelector('.content');
        //TODO: TRY TO CHANGE HINT.STYLE TO GO IN POPUP.CSS AND TEST
        const hintMsg = document.createElement('div');
        hintMsg.style.cssText = `
            background: white;
            color: #764ba2;
            border: 1px solid #d0b9ea;
            padding: 10px;
            border-radius: 6px;
            margin-top: 16px;
            text-align: center;
            font-size: 13px;
          `;
        hintMsg.innerHTML = '<strong>Are you on Netflix?</strong> Go to Netflix.com to use this extension!';
        content.appendChild(hintMsg);
      }
    }
  });
});