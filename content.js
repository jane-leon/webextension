// Netflix Movie Info Extension - Content Script
let sidebar = null;
let currentHoveredElement = null;
let hoverTimeout = null;

// Initialize the extension
function initExtension() {
  createSidebar();
  attachMovieListeners();
}

// Create the sidebar element
function createSidebar() {
  if (sidebar) return;
  
  sidebar = document.createElement('div');
  sidebar.id = 'movie-info-sidebar';
  sidebar.className = 'movie-info-sidebar hidden';
  
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <h3>Movie Info</h3>
      <button class="close-btn">&times;</button>
    </div>
    <div class="sidebar-content">
      <div class="loading">Hover over a movie to see details</div>
    </div>
  `;
  
  document.body.appendChild(sidebar);
  
  // Close button functionality
  sidebar.querySelector('.close-btn').addEventListener('click', hideSidebar);
}

// Attach event listeners to Netflix movie elements
function attachMovieListeners() {
  // Netflix uses these selectors for movie elements (updated based on real DOM)
  const movieSelectors = [
    '.title-card',
    '.slider-item',
    '.titleCard',
    '[data-uia="title-card"]',
    '.bob-card',
    '.previewModal',              // Preview modals like you showed
    '[class*="previewModal"]',    // Any preview modal class
    '.about-wrapper',             // About sections in modals
    '.about-header'               // About headers
  ];
  
  // Use event delegation for dynamic content
  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('mouseout', handleMouseOut);
}

function handleMouseOver(event) {
  const movieElement = findMovieElement(event.target);
  if (movieElement && movieElement !== currentHoveredElement) {
    currentHoveredElement = movieElement;
    
    // Debounce hover events
    clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => {
      const movieTitle = extractMovieTitle(movieElement);
      if (movieTitle) {
        showMovieInfo(movieTitle);
      }
    }, 500);
  }
}

function handleMouseOut(event) {
  const movieElement = findMovieElement(event.target);
  if (!movieElement) {
    clearTimeout(hoverTimeout);
    currentHoveredElement = null;
  }
}

// Find the movie element from the target
function findMovieElement(target) {
  const movieSelectors = [
    '.title-card',
    '.slider-item', 
    '.titleCard',
    '[data-uia="title-card"]',
    '.bob-card',
    '.previewModal',              // Netflix preview modals
    '[class*="previewModal"]',    // Any preview modal variant
    '.about-wrapper',             // About sections
    '.about-header',              // About headers
    '[data-uia*="preview"]'       // Any preview-related elements
  ];
  
  for (let selector of movieSelectors) {
    const element = target.closest(selector);
    if (element) return element;
  }
  return null;
}

// Extract movie title from the element
function extractMovieTitle(element) {
  // Try different methods to get the movie title
  let title = null;
  
  // Method 1: Look for the exact Netflix modal structure you found!
  const modalTitle = element.querySelector('.previewModal--section-header strong');
  if (modalTitle) {
    title = modalTitle.textContent.trim();
    console.log('Found title in modal header:', title);
  }
  
  // Method 2: Look for other preview modal variations
  if (!title) {
    const modalVariations = [
      '.previewModal--info strong',           // Any strong in preview modal
      '.about-header strong',                 // Strong in about header
      '.detail-modal-container strong',       // Strong in detail modal
      '[class*="previewModal"] strong',       // Any preview modal with strong
      'h3[class*="section-header"] strong'    // Section headers with strong
    ];
    
    for (let selector of modalVariations) {
      const titleElement = element.querySelector(selector);
      if (titleElement && titleElement.textContent.trim().length > 2) {
        title = titleElement.textContent.trim();
        console.log('Found title with selector:', selector, title);
        break;
      }
    }
  }
  
  // Method 3: Look for title in aria-label
  if (!title && element.getAttribute('aria-label')) {
    title = element.getAttribute('aria-label');
    console.log('Found title in aria-label:', title);
  }
  
  // Method 4: Look for Netflix's common title classes
  if (!title) {
    const titleSelectors = [
      '.fallback-text',           // Fallback text
      '.bob-title',               // Bob card titles
      '.video-title',             // Video titles
      '.title-text',              // Title text
      '[class*="title"]'          // Any element with "title" in class
    ];
    
    for (let selector of titleSelectors) {
      const titleElement = element.querySelector(selector);
      if (titleElement && titleElement.textContent.trim().length > 2) {
        title = titleElement.textContent.trim();
        console.log('Found title with fallback selector:', selector, title);
        break;
      }
    }
  }
  
  // Method 5: Look for img alt text
  if (!title) {
    const img = element.querySelector('img');
    if (img && img.alt && img.alt.length > 2) {
      title = img.alt;
      console.log('Found title in img alt:', title);
    }
  }
  
  // Method 6: Look for data attributes
  if (!title) {
    const dataAttributes = ['data-title', 'data-uia-title', 'data-video-title'];
    for (let attr of dataAttributes) {
      const value = element.getAttribute(attr);
      if (value && value.length > 2) {
        title = value;
        console.log('Found title in data attribute:', attr, title);
        break;
      }
    }
  }
  
  return cleanTitle(title);
}

// Clean the extracted title
function cleanTitle(title) {
  if (!title) return null;
  
  // Remove common Netflix UI text
  title = title.replace(/^(Play|Add to List|More Info|Watch Now)/i, '');
  title = title.replace(/\s+/g, ' ').trim();
  
  // Skip if it's too short or looks like UI text
  if (title.length < 2 || /^(New|Popular|Trending)$/i.test(title)) {
    return null;
  }
  
  return title;
}

// Show movie information in sidebar
async function showMovieInfo(movieTitle) {
  showSidebar();
  
  const contentDiv = sidebar.querySelector('.sidebar-content');
  contentDiv.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      Loading info for "${movieTitle}"...
    </div>
  `;
  
  try {
    // Request movie data from background script
    const response = await chrome.runtime.sendMessage({
      action: 'getMovieInfo',
      title: movieTitle
    });
    
    if (response.success) {
      displayMovieData(response.data);
    } else {
      displayError(response.error || 'Movie not found');
    }
  } catch (error) {
    displayError('Failed to fetch movie information');
  }
}

// Display movie data in sidebar
function displayMovieData(data) {
  const contentDiv = sidebar.querySelector('.sidebar-content');
  
  // Prepare awards section
  let awardsHtml = '';
  const awards = parseAwards(data.Awards);
  if (awards && awards.length > 0) {
    awardsHtml = `
      <div class="movie-awards">
        <h5>🏆 Awards & Recognition</h5>
        <div class="awards-list">
          ${awards.map(award => `
            <span class="award-badge">${award.display}</span>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  // Prepare box office section
  let boxOfficeHtml = '';
  if (data.detailedInfo && data.detailedInfo.boxOffice) {
    boxOfficeHtml = `
      <div class="box-office">
        <h5>💰 Box Office</h5>
        <div class="box-office-amount">${data.detailedInfo.boxOffice.formatted}</div>
      </div>
    `;
  }
  
  // Prepare reviews section
  let reviewsHtml = '';
  if (data.userReviews && data.userReviews.length > 0) {
    reviewsHtml = `
      <div class="movie-reviews">
        <h5>👥 Top User Reviews</h5>
        ${data.userReviews.map(review => `
          <div class="review-item">
            <div class="review-header">
              <span class="review-author">${review.author}</span>
              ${review.rating !== 'N/A' ? `<span class="review-rating">⭐ ${review.rating}/10</span>` : ''}
            </div>
            <div class="review-content">${review.content}</div>
            <div class="review-date">${review.created_at}</div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  contentDiv.innerHTML = `
    <div class="movie-info">
      <div class="movie-poster">
        <img src="${data.Poster !== 'N/A' ? data.Poster : 'https://via.placeholder.com/150x225?text=No+Image'}" 
             alt="${data.Title}" onerror="this.src='https://via.placeholder.com/150x225?text=No+Image'">
      </div>
      
      <div class="movie-details">
        <h4 class="movie-title">${data.Title}</h4>
        <div class="movie-year">${data.Year}</div>
        
        <div class="ratings">
          ${data.imdbRating !== 'N/A' ? `
            <div class="rating">
              <span class="rating-label">IMDb:</span>
              <span class="rating-value">${data.imdbRating}/10</span>
            </div>
          ` : ''}
          
          ${data.Ratings && data.Ratings.find(r => r.Source === 'Rotten Tomatoes') ? `
            <div class="rating">
              <span class="rating-label">RT:</span>
              <span class="rating-value">${data.Ratings.find(r => r.Source === 'Rotten Tomatoes').Value}</span>
            </div>
          ` : ''}
        </div>
        
        ${awardsHtml}
        ${boxOfficeHtml}
        
        <div class="movie-genre">
          <strong>Genre:</strong> ${data.Genre || 'N/A'}
        </div>
        
        <div class="movie-plot">
          <strong>Plot:</strong> ${data.Plot || 'No plot available'}
        </div>
        
        <div class="movie-director">
          <strong>Director:</strong> ${data.Director || 'N/A'}
        </div>
        
        <div class="movie-actors">
          <strong>Cast:</strong> ${data.Actors || 'N/A'}
        </div>
        
        ${reviewsHtml}
      </div>
    </div>
  `;
}

// Helper function to parse awards (same as in background script)
function parseAwards(awardsString) {
  if (!awardsString || awardsString === 'N/A') {
    return null;
  }
  
  const awards = [];
  
  // Parse Oscar wins
  const oscarWins = awardsString.match(/Won (\d+) Oscar/i);
  if (oscarWins) {
    awards.push({
      type: 'Oscar',
      status: 'Won',
      count: parseInt(oscarWins[1]),
      display: `${oscarWins[1]} Oscar${oscarWins[1] > 1 ? 's' : ''}`
    });
  }
  
  // Parse Oscar nominations
  const oscarNoms = awardsString.match(/Nominated for (\d+) Oscar/i);
  if (oscarNoms && !oscarWins) {
    awards.push({
      type: 'Oscar',
      status: 'Nominated',
      count: parseInt(oscarNoms[1]),
      display: `${oscarNoms[1]} Oscar nomination${oscarNoms[1] > 1 ? 's' : ''}`
    });
  }
  
  // Parse Golden Globe wins
  const ggWins = awardsString.match(/Won (\d+) Golden Globe/i);
  if (ggWins) {
    awards.push({
      type: 'Golden Globe',
      status: 'Won',
      count: parseInt(ggWins[1]),
      display: `${ggWins[1]} Golden Globe${ggWins[1] > 1 ? 's' : ''}`
    });
  }
  
  // Parse BAFTA wins
  const baftaWins = awardsString.match(/Won (\d+) BAFTA/i);
  if (baftaWins) {
    awards.push({
      type: 'BAFTA',
      status: 'Won',
      count: parseInt(baftaWins[1]),
      display: `${baftaWins[1]} BAFTA${baftaWins[1] > 1 ? 's' : ''}`
    });
  }
  
  // Catch-all for other wins
  const otherWins = awardsString.match(/Won (\d+) wins?/i);
  if (otherWins && awards.length === 0) {
    awards.push({
      type: 'Various',
      status: 'Won',
      count: parseInt(otherWins[1]),
      display: `${otherWins[1]} award${otherWins[1] > 1 ? 's' : ''}`
    });
  }
  
  return awards.length > 0 ? awards : null;
}

// Display error message
function displayError(message) {
  const contentDiv = sidebar.querySelector('.sidebar-content');
  contentDiv.innerHTML = `
    <div class="error">
      <p>⚠️ ${message}</p>
      <p>Try hovering over a different movie.</p>
    </div>
  `;
}

// Show sidebar
function showSidebar() {
  if (sidebar) {
    sidebar.classList.remove('hidden');
  }
}

// Hide sidebar
function hideSidebar() {
  if (sidebar) {
    sidebar.classList.add('hidden');
  }
  currentHoveredElement = null;
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initExtension);
} else {
  initExtension();
}

// Reinitialize when Netflix navigates (SPA)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(initExtension, 1000); // Delay for Netflix to load content
  }
}).observe(document, { subtree: true, childList: true });