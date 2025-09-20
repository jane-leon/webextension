// This script runs on Netflix pages and detects when users open movie details
// It creates a sidebar that shows movie information when in the "About" section
let movieInfoSidebar = null;          // Will hold our sidebar element
let currentMovieElement = null;       // Tracks which movie modal we're viewing
// let detectionDelayTimer = null;       // Timer to prevent too many API calls - COMMENTED OUT

function startExtension() {
  buildMovieInfoSidebar();
  setupModalDetection();
}

function buildMovieInfoSidebar() {
  // Don't create multiple sidebars
  if (movieInfoSidebar) return;
  movieInfoSidebar = document.createElement('div');
  movieInfoSidebar.id = 'movie-info-sidebar';
  movieInfoSidebar.className = 'movie-info-sidebar hidden'; // Start hidden

  movieInfoSidebar.innerHTML = `
    <div class="sidebar-header">
      <h3>🎬  Movie or TV Show Info  🎬</h3>
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

function handleMouseEnterElement(event) {
  const hoveredElement = event.target;
  const modalElement = findNetflixModalElement(hoveredElement);

  if (modalElement && modalElement !== currentMovieElement) {
    currentMovieElement = modalElement;

    loadMovieInformation(modalElement);

    // Timer-based approach:
    // Don't fetch data immediately - wait a bit to see if user is still in modal
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
    // Reset current element since we're not in a movie modal anymore
    currentMovieElement = null;
    // Clear the timer since we're not in a movie modal anymore
    // clearTimeout(detectionDelayTimer);
  }
}

// Find movie modal elements (About sections)
function findNetflixModalElement(startingElement) {

  const netflixModalSelectors = [
    '.previewModal',                 
    '[class*="previewModal"]',        
    '.about-wrapper',
    '.about-header',                  
    '[data-uia*="preview"]'         
  ];

  // Check each selector to see if our element matches
  for (let selector of netflixModalSelectors) {
    const foundElement = startingElement.closest(selector);
    if (foundElement) {
      return foundElement;
    }
  }
  return null;
}

// Title extraction, get movie name from Netflix's modal about section
function extractMovieTitle(modalElement) {
  let movieTitle = null;
  const modalTitle = modalElement.querySelector('.previewModal--section-header strong');
  if (modalTitle) {
    movieTitle = modalTitle.textContent.trim();
  }
  // Clean up the title and return it
  return cleanupMovieTitle(movieTitle);
}

// Helper function to clean up extracted movie titles
function cleanupMovieTitle(title) {
  if (!title) {
    return null;
  }
  title = title.replace(/\s+/g, ' ').trim();
  return title;
}

/* Get movie/show data and display it */
async function loadMovieInformation(modalElement) {
  const movieTitle = extractMovieTitle(modalElement);
  if (!movieTitle) {
    return;
  }
  showSidebar();
  showLoadingMessage(movieTitle);

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getMovieInfo',    // Tell background script what we want
      title: movieTitle          // Send the movie title
    });
    if (response.success) {
      displayMovieInformation(response.data);
    } else {
      showErrorMessage(response.error || 'Movie not found');
    }

  } catch (error) {
    console.error('Error fetching movie info:', error);
    showErrorMessage('Failed to fetch movie information');
  }
}

/* Extension sidebar: show/hide extension & content */
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
      <p>Sorry, something went wrong! ${errorText}</p>
      <p>Try selecting a different movie or TV show.</p>
    </div>
  `;
}

/* Format & show movie/show info */
function displayMovieInformation(movieData) {
  const contentArea = movieInfoSidebar.querySelector('.sidebar-content');
  // Building the HTML for movie information
  contentArea.innerHTML = `
    <div class="movie-info">
      ${buildMoviePosterSection(movieData)}
      ${buildMovieDetailsSection(movieData)}
      ${buildRatingsSection(movieData)}
      ${buildAwardsSection(movieData)}
      ${buildBoxOfficeSection(movieData)}
      ${buildReviewsSection(movieData)}
    </div>
  `;
}

// Helper functions to build info sections
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
    </div>
  `;
}

function buildRatingsSection(movieData) {
  let ratingsHTML = '<div class="ratings">';
  // IMDb rating
  if (movieData.imdbRating !== 'N/A') {
    ratingsHTML += `
      <div class="rating">
        <span class="rating-label">🎥 IMDb</span>
        <span class="rating-value">${movieData.imdbRating}/10</span>
      </div>
    `;
  }
  // Rotten Tomatoes rating
  if (movieData.Ratings) {
    const rtRating = movieData.Ratings.find(r => r.Source === 'Rotten Tomatoes');
    if (rtRating) {
      ratingsHTML += `
        <div class="rating">
          <span class="rating-label">🍅 RT</span>
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
      <h5>Awards 🏆</h5>
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
      <h5>Box Office 💸</h5>
      <div class="box-office-amount">${movieData.detailedInfo.boxOffice.formatted}</div>
    </div>
  `;
}

function buildReviewsSection(movieData) {
  if (!movieData.userReviews || movieData.userReviews.length === 0) {
    return '';
  }
  let reviewsHTML = `
    <div class="movie-reviews">
      <h5>Reviews from other watchers 👥</h5>
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

/* Restart extension when user scrolls on Netflix */
let currentPageUrl = location.href;
// Watch changes to page content
const pageObserver = new MutationObserver(() => {
  const newUrl = location.href;
  if (newUrl !== currentPageUrl) {
    currentPageUrl = newUrl;
    // Wait a bit for Netflix to load the new content, then restart
    setTimeout(startExtension, 1500);
  }
});

// Start watching for page changes
pageObserver.observe(document, {
  subtree: true,  
  childList: true     
});

/* Load extension */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startExtension);
} else {
  startExtension();
}