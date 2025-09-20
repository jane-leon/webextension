
// This script runs on Netflix pages and detects when users open movie details
// It creates a sidebar that shows movie information when in the "About" section


let movieInfoSidebar = null;          // Will hold our sidebar element
let currentMovieElement = null;       // Tracks which movie modal we're viewing
// let detectionDelayTimer = null;       // Timer to prevent too many API calls

function startExtension() {
  buildMovieInfoSidebar();
  setupModalDetection();
}


function buildMovieInfoSidebar() {
  if (movieInfoSidebar) return;

  movieInfoSidebar = document.createElement('div');
  movieInfoSidebar.id = 'movie-info-sidebar';
  movieInfoSidebar.className = 'movie-info-sidebar hidden'; // Start hidden
  
  //HTML structure for our sidebar
  movieInfoSidebar.innerHTML = `
    <div class="sidebar-header">
      <h3>🎬 Movie Info 🎬</h3>
      <button class="close-btn" title="Close">&times;</button>
    </div>
    <div class="sidebar-content">
      <div class="loading">
        <p>Click "More Info" on a movie and scroll to the About section!</p>
      </div>
    </div>
  `;
  
  // Add the sidebar to the page
  document.body.appendChild(movieInfoSidebar);
  
  // Make the close button work
  const closeButton = movieInfoSidebar.querySelector('.close-btn');
  closeButton.addEventListener('click', hideSidebar);
}

// Listen for when users open Netflix movie about page
function setupModalDetection() {  
  document.addEventListener('mouseover', handleMouseEnterElement);
  document.addEventListener('mouseout', handleMouseLeaveElement);
}

// When mouse enters an element, check if it's a Netflix movie modal
function handleMouseEnterElement(event) {
  const hoveredElement = event.target;
  
  // Check if this element is part of a Netflix movie modal/preview
  const modalElement = findNetflixModalElement(hoveredElement);
  
  if (modalElement && modalElement !== currentMovieElement) {
    currentMovieElement = modalElement;

    loadMovieInformation(modalElement); 
    // // Don't fetch data immediately - wait a bit to see if user is still in modal
    // clearTimeout(detectionDelayTimer);
    // detectionDelayTimer = setTimeout(() => {
    //   loadMovieInformation(modalElement);
    // }, 800); // Wait 800ms before loading info
  }
}

// When mouse leaves an element, clear the detection timer
function handleMouseLeaveElement(event) {
  const leftElement = event.target;
  
  // Check if we're no longer in any movie modal
  const modalElement = findNetflixModalElement(leftElement);
  
  if (!modalElement) {
    currentMovieElement = null;
    // // Clear the timer since we're not in a movie modal anymore
    // clearTimeout(detectionDelayTimer);
    // currentMovieElement = null;
  }
}


/* Find movie modal elements ("About" section) */

function findNetflixModalElement(startingElement) {
  // Netflix uses these CSS classes for movie preview modals and about sections
  // These appear when users click "More Info" on a movie
  
  const netflixModalSelectors = [
    '.previewModal',                  // Main preview modal container
    '[class*="previewModal"]',        // Any preview modal variant
    '.about-wrapper',                 // About sections in modals
    '.about-header',                  // About section headers
    '[data-uia*="preview"]',          // Any preview-related elements
    '.title-card',                    // Some title cards (backup)
    '.slider-item',                   // Movies in horizontal sliders (backup)
    '.titleCard',                     // Alternative title card class (backup)
    '[data-uia="title-card"]',        // Cards with data attributes (backup)
    '.bob-card'                       // "Bigger" card format (backup)
  ];
  
  // Check selectors to see if element matches
  for (let selector of netflixModalSelectors) {
    // Look at the element and all its parent elements
    const foundElement = startingElement.closest(selector);
  }
  
  // No modal element found
  return null;
}

/* Title extraction: Get movie name from Netflix's modal "About" section */

function extractMovieTitle(modalElement) {
  let movieTitle = null;
  
  // Users click "More Info" and see the "About" section
  const modalTitle = modalElement.querySelector('.previewModal--section-header strong');
  if (modalTitle) {
    movieTitle = modalTitle.textContent.trim();
  }
  
  // Clean up the title and return it
  return cleanupMovieTitle(movieTitle);
}

// // Helper function to check if text looks like UI text rather than a movie title
// function isUIText(text) {
//   const uiTexts = ['Play', 'Add to List', 'More Info', 'Watch Now', 'New', 'Popular', 'Trending'];
//   return uiTexts.some(uiText => text.toLowerCase().includes(uiText.toLowerCase()));
// }

// Helper function to clean up extracted movie titles
function cleanupMovieTitle(title) {
  if (!title) {
    return null;
  }
  
  // Remove common Netflix UI text
  title = title.replace(/^(Play|Add to List|More Info|Watch Now)/i, '');
  
  // Clean up extra spaces
  title = title.replace(/\s+/g, ' ').trim();
  
  // Title can't be too short
  if (title.length < 2) {
    return null;
  }
  
  return title;
}

/* Get movie data and display it */

async function loadMovieInformation(modalElement) {
  
  // Extract the movie title from the modal HTML element
  const movieTitle = extractMovieTitle(modalElement);
  
  if (!movieTitle) {
    return;
  }
  
  // Show the sidebar with a loading message
  showSidebar();
  showLoadingMessage(movieTitle);
  
  try {
    // Send a message to the background script to fetch movie data
    
    const response = await chrome.runtime.sendMessage({
      action: 'getMovieInfo',    // Tell background script what we want
      title: movieTitle          // Send the movie title
    });
    
    // Check if we got data successfully
    if (response.success) {
      displayMovieInformation(response.data);
    } else {
      showErrorMessage(response.error || 'Movie not found');
    }
    
  } catch (error) {
    showErrorMessage('Failed to fetch movie information');
  }
}

/* Extension sidebar: show/hide extension and content */

function showSidebar() {
  if (movieInfoSidebar) {
    movieInfoSidebar.classList.remove('hidden');
  }
}

function hideSidebar() {
  if (movieInfoSidebar) {
    movieInfoSidebar.classList.add('hidden');
  }
  currentMovieElement = null;
}

function showLoadingMessage(movieTitle) {
  const contentArea = movieInfoSidebar.querySelector('.sidebar-content');
  contentArea.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading information for:<br><strong>"${movieTitle}"</strong></p>
    </div>
  `;
}

function showErrorMessage(errorText) {
  const contentArea = movieInfoSidebar.querySelector('.sidebar-content');
  contentArea.innerHTML = `
    <div class="error">
      <p>⚠️ ${errorText}</p>
      <p>Try hovering over a different movie.</p>
    </div>
  `;
}

// =============================================================================
// MOVIE DATA DISPLAY - Format and show the movie information
// =============================================================================

function displayMovieInformation(movieData) {
  console.log('🎨 Displaying movie information:', movieData);
  
  const contentArea = movieInfoSidebar.querySelector('.sidebar-content');
  
  // Build the HTML for movie information
  contentArea.innerHTML = `
    <div class="movie-info">
      ${buildMoviePosterSection(movieData)}
      ${buildMovieDetailsSection(movieData)}
      ${buildRatingsSection(movieData)}
      ${buildAwardsSection(movieData)}
      ${buildBoxOfficeSection(movieData)}
      ${buildPlotSection(movieData)}
      ${buildCastSection(movieData)}
      ${buildReviewsSection(movieData)}
    </div>
  `;
}

// Helper functions to build different sections of the movie display

function buildMoviePosterSection(movieData) {
  const posterUrl = movieData.Poster !== 'N/A' ? movieData.Poster : 'https://via.placeholder.com/150x225?text=No+Image';
  
  return `
    <div class="movie-poster">
      <img src="${posterUrl}" alt="${movieData.Title}" 
           onerror="this.src='https://via.placeholder.com/150x225?text=No+Image'">
    </div>
  `;
}

function buildMovieDetailsSection(movieData) {
  return `
    <div class="movie-details">
      <h4 class="movie-title">${movieData.Title}</h4>
      <div class="movie-year">${movieData.Year}</div>
      <div class="movie-genre">
        <strong>Genre:</strong> ${movieData.Genre || 'N/A'}
      </div>
    </div>
  `;
}

function buildRatingsSection(movieData) {
  let ratingsHTML = '<div class="ratings">';
  
  // IMDb Rating
  if (movieData.imdbRating !== 'N/A') {
    ratingsHTML += `
      <div class="rating">
        <span class="rating-label">IMDb</span>
        <span class="rating-value">${movieData.imdbRating}/10</span>
      </div>
    `;
  }
  
  // Rotten Tomatoes Rating
  if (movieData.Ratings) {
    const rtRating = movieData.Ratings.find(r => r.Source === 'Rotten Tomatoes');
    if (rtRating) {
      ratingsHTML += `
        <div class="rating">
          <span class="rating-label">RT</span>
          <span class="rating-value">${rtRating.Value}</span>
        </div>
      `;
    }
  }
  
  ratingsHTML += '</div>';
  return ratingsHTML;
}

function buildAwardsSection(movieData) {
  if (!movieData.Awards || movieData.Awards === 'N/A') {
    return '';
  }
  
  return `
    <div class="movie-awards">
      <h5>🏆 Awards & Recognition</h5>
      <p>${movieData.Awards}</p>
    </div>
  `;
}

function buildBoxOfficeSection(movieData) {
  if (!movieData.detailedInfo || !movieData.detailedInfo.boxOffice) {
    return '';
  }
  
  return `
    <div class="box-office">
      <h5>💰 Box Office</h5>
      <div class="box-office-amount">${movieData.detailedInfo.boxOffice.formatted}</div>
    </div>
  `;
}

function buildPlotSection(movieData) {
  return `
    <div class="movie-plot">
      <strong>Plot:</strong> ${movieData.Plot || 'No plot available'}
    </div>
  `;
}

function buildCastSection(movieData) {
  return `
    <div class="movie-director">
      <strong>Director:</strong> ${movieData.Director || 'N/A'}
    </div>
    <div class="movie-actors">
      <strong>Cast:</strong> ${movieData.Actors || 'N/A'}
    </div>
  `;
}

function buildReviewsSection(movieData) {
  if (!movieData.userReviews || movieData.userReviews.length === 0) {
    return '';
  }
  
  let reviewsHTML = `
    <div class="movie-reviews">
      <h5>👥 User Reviews</h5>
  `;
  
  movieData.userReviews.forEach(review => {
    reviewsHTML += `
      <div class="review-item">
        <div class="review-header">
          <span class="review-author">${review.author}</span>
          ${review.rating !== 'N/A' ? `<span class="review-rating">⭐ ${review.rating}/10</span>` : ''}
        </div>
        <div class="review-content">${review.content}</div>
        <div class="review-date">${review.created_at}</div>
      </div>
    `;
  });
  
  reviewsHTML += '</div>';
  return reviewsHTML;
}

// =============================================================================
// PAGE NAVIGATION HANDLING - Restart extension when Netflix navigates
// =============================================================================

// Netflix is a Single Page Application (SPA), so we need to detect when
// the user navigates to a new page and restart our extension

let currentPageUrl = location.href;

// Watch for changes to the page content
const pageObserver = new MutationObserver(() => {
  const newUrl = location.href;
  if (newUrl !== currentPageUrl) {
    currentPageUrl = newUrl;
    console.log('🔄 Netflix page changed, restarting extension...');
    
    // Wait a bit for Netflix to load the new content, then restart
    setTimeout(startExtension, 1500);
  }
});

// Start watching for page changes
pageObserver.observe(document, { 
  subtree: true,      // Watch all descendant elements
  childList: true     // Watch for elements being added/removed
});

// =============================================================================
// EXTENSION STARTUP - Initialize everything when the page is ready
// =============================================================================

if (document.readyState === 'loading') {
  // Page is still loading, wait for it to finish
  document.addEventListener('DOMContentLoaded', startExtension);
} else {
  // Page is already loaded, start immediately
  startExtension();
}