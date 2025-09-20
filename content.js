// =============================================================================
// NETFLIX MOVIE INFO EXTENSION - CONTENT SCRIPT (Beginner-Friendly Version)
// =============================================================================
// This script runs on Netflix pages and detects when users hover over movies
// It creates a sidebar that shows movie information fetched from APIs

// =============================================================================
// GLOBAL VARIABLES - These store important information throughout the script
// =============================================================================

let movieInfoSidebar = null;          // Will hold our sidebar element
let currentMovieElement = null;       // Tracks which movie we're hovering over
let hoverDelayTimer = null;           // Timer to prevent too many API calls

// =============================================================================
// MAIN INITIALIZATION - This runs when the page loads
// =============================================================================

function startExtension() {
  console.log('🎬 Netflix Movie Info Extension is starting...');
  
  // Step 1: Create the sidebar (but keep it hidden)
  buildMovieInfoSidebar();
  
  // Step 2: Start listening for mouse movements over movies
  setupMovieDetection();
  
  console.log('✅ Extension is ready! Hover over movies to see info.');
}

// =============================================================================
// SIDEBAR CREATION - Build the info panel that will show movie details
// =============================================================================

function buildMovieInfoSidebar() {
  // Don't create multiple sidebars
  if (movieInfoSidebar) return;
  
  console.log('🔨 Building movie info sidebar...');
  
  // Create the main sidebar container
  movieInfoSidebar = document.createElement('div');
  movieInfoSidebar.id = 'movie-info-sidebar';
  movieInfoSidebar.className = 'movie-info-sidebar hidden'; // Start hidden
  
  // Build the HTML structure for our sidebar
  movieInfoSidebar.innerHTML = `
    <div class="sidebar-header">
      <h3>🎬 Movie Info</h3>
      <button class="close-btn" title="Close">&times;</button>
    </div>
    <div class="sidebar-content">
      <div class="loading">
        <p>Hover over a movie poster to see its details!</p>
      </div>
    </div>
  `;
  
  // Add the sidebar to the page
  document.body.appendChild(movieInfoSidebar);
  
  // Make the close button work
  const closeButton = movieInfoSidebar.querySelector('.close-btn');
  closeButton.addEventListener('click', hideSidebar);
  
  console.log('✅ Sidebar created successfully!');
}

// =============================================================================
// MOVIE DETECTION - Listen for mouse movements to detect movie hovers
// =============================================================================

function setupMovieDetection() {
  console.log('👀 Setting up movie detection...');
  
  // Listen for mouse entering elements (mouseover)
  document.addEventListener('mouseover', handleMouseEnterElement);
  
  // Listen for mouse leaving elements (mouseout)  
  document.addEventListener('mouseout', handleMouseLeaveElement);
}

// When mouse enters an element, check if it's a movie
function handleMouseEnterElement(event) {
  const hoveredElement = event.target;
  
  // Check if this element is part of a Netflix movie
  const movieElement = findNetflixMovieElement(hoveredElement);
  
  if (movieElement && movieElement !== currentMovieElement) {
    console.log('🎯 Found a movie element!', movieElement);
    currentMovieElement = movieElement;
    
    // Don't fetch data immediately - wait a bit to see if user is still hovering
    clearTimeout(hoverDelayTimer);
    hoverDelayTimer = setTimeout(() => {
      loadMovieInformation(movieElement);
    }, 800); // Wait 800ms before loading info
  }
}

// When mouse leaves an element, clear the hover timer
function handleMouseLeaveElement(event) {
  const leftElement = event.target;
  
  // Check if we're no longer hovering over any movie
  const movieElement = findNetflixMovieElement(leftElement);
  
  if (!movieElement) {
    // Clear the timer since we're not hovering over a movie anymore
    clearTimeout(hoverDelayTimer);
    currentMovieElement = null;
  }
}

// =============================================================================
// NETFLIX ELEMENT DETECTION - Find movie elements in Netflix's HTML structure
// =============================================================================

function findNetflixMovieElement(startingElement) {
  // Netflix uses different CSS classes for movies in different parts of the site
  // We'll check if the element (or its parents) match any of these patterns
  
  const netflixMovieSelectors = [
    '.title-card',                    // Regular movie cards
    '.slider-item',                   // Movies in horizontal sliders
    '.titleCard',                     // Alternative title card class
    '[data-uia="title-card"]',        // Cards with data attributes
    '.bob-card',                      // "Bigger" card format
    '.previewModal',                  // Movie preview modals
    '[class*="previewModal"]',        // Any preview modal variant
    '.about-wrapper',                 // About sections in modals
    '.about-header',                  // About section headers
    '[data-uia*="preview"]'           // Any preview-related elements
  ];
  
  // Check each selector to see if our element matches
  for (let selector of netflixMovieSelectors) {
    // .closest() looks at the element and all its parent elements
    const foundElement = startingElement.closest(selector);
    if (foundElement) {
      console.log(`📍 Found movie using selector: ${selector}`);
      return foundElement;
    }
  }
  
  // No movie element found
  return null;
}

// =============================================================================
// MOVIE TITLE EXTRACTION - Get the movie name from Netflix's HTML
// =============================================================================

function extractMovieTitle(movieElement) {
  console.log('🔍 Trying to extract movie title from element...');
  
  let movieTitle = null;
  
  // Method 1: Look for title in Netflix modal headers (most reliable)
  const modalTitle = movieElement.querySelector('.previewModal--section-header strong');
  if (modalTitle) {
    movieTitle = modalTitle.textContent.trim();
    console.log('✅ Found title in modal header:', movieTitle);
  }
  
  // Method 2: Look for other strong text elements that might contain titles
  if (!movieTitle) {
    const strongElements = movieElement.querySelectorAll('strong');
    for (let strongElement of strongElements) {
      const text = strongElement.textContent.trim();
      if (text.length > 2 && !isUIText(text)) {
        movieTitle = text;
        console.log('✅ Found title in strong element:', movieTitle);
        break;
      }
    }
  }
  
  // Method 3: Look for title in aria-label attribute
  if (!movieTitle && movieElement.getAttribute('aria-label')) {
    movieTitle = movieElement.getAttribute('aria-label');
    console.log('✅ Found title in aria-label:', movieTitle);
  }
  
  // Method 4: Look for title in image alt text
  if (!movieTitle) {
    const image = movieElement.querySelector('img');
    if (image && image.alt && image.alt.length > 2) {
      movieTitle = image.alt;
      console.log('✅ Found title in image alt text:', movieTitle);
    }
  }
  
  // Method 5: Look for data attributes that might contain the title
  if (!movieTitle) {
    const possibleDataAttributes = ['data-title', 'data-uia-title', 'data-video-title'];
    for (let attribute of possibleDataAttributes) {
      const value = movieElement.getAttribute(attribute);
      if (value && value.length > 2) {
        movieTitle = value;
        console.log(`✅ Found title in ${attribute}:`, movieTitle);
        break;
      }
    }
  }
  
  // Clean up the title and return it
  return cleanupMovieTitle(movieTitle);
}

// Helper function to check if text looks like UI text rather than a movie title
function isUIText(text) {
  const uiTexts = ['Play', 'Add to List', 'More Info', 'Watch Now', 'New', 'Popular', 'Trending'];
  return uiTexts.some(uiText => text.toLowerCase().includes(uiText.toLowerCase()));
}

// Helper function to clean up extracted movie titles
function cleanupMovieTitle(title) {
  if (!title) {
    console.log('❌ No title found');
    return null;
  }
  
  // Remove common Netflix UI text
  title = title.replace(/^(Play|Add to List|More Info|Watch Now)/i, '');
  
  // Clean up extra spaces
  title = title.replace(/\s+/g, ' ').trim();
  
  // Make sure it's long enough to be a real title
  if (title.length < 2) {
    console.log('❌ Title too short:', title);
    return null;
  }
  
  console.log('✅ Cleaned title:', title);
  return title;
}

// =============================================================================
// MOVIE INFORMATION LOADING - Get movie data and display it
// =============================================================================

async function loadMovieInformation(movieElement) {
  console.log('📡 Loading movie information...');
  
  // Extract the movie title from the HTML element
  const movieTitle = extractMovieTitle(movieElement);
  
  if (!movieTitle) {
    console.log('❌ Could not extract movie title');
    return;
  }
  
  // Show the sidebar with a loading message
  showSidebar();
  showLoadingMessage(movieTitle);
  
  try {
    // Send a message to the background script to fetch movie data
    console.log('📤 Sending message to background script for:', movieTitle);
    
    const response = await chrome.runtime.sendMessage({
      action: 'getMovieInfo',    // Tell background script what we want
      title: movieTitle          // Send the movie title
    });
    
    console.log('📥 Received response from background script:', response);
    
    // Check if we got data successfully
    if (response.success) {
      displayMovieInformation(response.data);
    } else {
      showErrorMessage(response.error || 'Movie not found');
    }
    
  } catch (error) {
    console.error('❌ Error fetching movie info:', error);
    showErrorMessage('Failed to fetch movie information');
  }
}

// =============================================================================
// SIDEBAR DISPLAY FUNCTIONS - Show/hide sidebar and display content
// =============================================================================

function showSidebar() {
  if (movieInfoSidebar) {
    movieInfoSidebar.classList.remove('hidden');
    console.log('👁️ Sidebar is now visible');
  }
}

function hideSidebar() {
  if (movieInfoSidebar) {
    movieInfoSidebar.classList.add('hidden');
    console.log('🙈 Sidebar is now hidden');
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