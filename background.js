// This script runs in the background and handles API calls to movie databases
// It fetches movie information when requested by the content script

const OMDB_API_KEY = 'cb486c88'; 
const OMDB_API_URL = 'https://www.omdbapi.com/';

const TMDB_API_KEY = '3126e89bfccb852840b00afa13857781'; 
const TMDB_API_URL = 'https://api.themoviedb.org/3';

// Create a cache to store movie data (like a dictionary/map)
const movieDataCache = new Map();
const CACHE_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_CACHE_SIZE = 100; // Maximum number of movies to cache

// This is how content script and background script communicate
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  // Check if the content script is asking for movie information
  if (message.action === 'getMovieInfo') {
    fetchCompleteMovieInfo(message.title)
      .then(movieData => {
        sendResponse({ success: true, data: movieData });
      })
      .catch(error => {
        console.error('Error fetching movie data:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

//fetching movie info!!
async function fetchCompleteMovieInfo(movieTitle) {
  
  try {
    // Step 1: Check if we already have this movie in our cache
    const cachedData = getMovieFromCache(movieTitle);
    if (cachedData) {
      return cachedData;
    }
    
    // Step 2: Clean up the movie title for better API results
    const cleanTitle = cleanMovieTitle(movieTitle);
    
    const dataPromises = [
      fetchBasicMovieData(cleanTitle),    // Basic info from OMDb
      fetchMovieReviews(cleanTitle),      // User reviews from TMDB
      fetchDetailedMovieData(cleanTitle)  // Additional details from TMDB
    ];
    
    // Wait for all API calls to complete (or fail)
    const results = await Promise.allSettled(dataPromises);
    
    // Step 4: Process the results
    const basicData = results[0].status === 'fulfilled' ? results[0].value : null;
    const reviews = results[1].status === 'fulfilled' ? results[1].value : [];
    const detailedData = results[2].status === 'fulfilled' ? results[2].value : {};
    
    // Step 5: If primary API failed, try backup API
    let finalMovieData = basicData;
    if (!finalMovieData) {
      finalMovieData = await fetchMovieDataFromTMDB(cleanTitle);
    }
    
    // Step 6: Combine all the data
    if (finalMovieData) {
      finalMovieData.userReviews = reviews;
      finalMovieData.detailedInfo = detailedData;
      
      // Step 7: Save to cache for future use
      saveMovieToCache(movieTitle, finalMovieData);
      
      return finalMovieData;
    } else {
      throw new Error('Movie not found in any database');
    }
    
  } catch (error) {
    console.error('Error in fetchCompleteMovieInfo:', error);
    throw error;
  }
}

function cleanMovieTitle(title) {
  let cleanedTitle = title.replace(/\s+/g, ' ').trim();
  return cleanedTitle;
}

async function fetchBasicMovieData(title) {
  try {
    // Build the API URL
    const apiUrl = `${OMDB_API_URL}?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}&plot=short`;
    
    // Make the API call
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    // Check if the API call was successful
    if (data.Response === 'False') {
      
      // Try searching instead of exact match
      return await searchMovieInOMDb(title);
    }
    return data;
  } catch (error) {
    console.error('Error fetching from OMDb:', error);
    throw new Error(`OMDb API error: ${error.message}`);
  }
}

// Helper function to search for movies when exact match fails
async function searchMovieInOMDb(title) {
  
  try {
    // Search for movies with similar titles
    const searchUrl = `${OMDB_API_URL}?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(title)}`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    // Check if we found any results
    if (searchData.Response === 'True' && searchData.Search && searchData.Search.length > 0) {
      // Get detailed info for the first (most relevant) result
      const firstResult = searchData.Search[0];
      const detailUrl = `${OMDB_API_URL}?apikey=${OMDB_API_KEY}&i=${firstResult.imdbID}&plot=short`;
      const detailResponse = await fetch(detailUrl);
      const detailData = await detailResponse.json();
      if (detailData.Response === 'True') {
        return detailData;
      }
    }
    
    throw new Error('No matching movies found in OMDb');
    
  } catch (error) {
    console.error('Error in OMDb search:', error);
    throw error;
  }
}


async function fetchMovieReviews(title) {
  try {
    //Search for the movie to get its TMDB ID
    const movieId = await findMovieIdInTMDB(title);
    if (!movieId) {
      return [];
    }
    //Get reviews using the movie ID
    const reviewsUrl = `${TMDB_API_URL}/movie/${movieId}/reviews?api_key=${TMDB_API_KEY}`;
    const response = await fetch(reviewsUrl);
    const data = await response.json();
    
    //Process and format the reviews
    if (!data.results || data.results.length === 0) {
      return [];
    }
    
    //Take the first 3 reviews and format them nicely
    const formattedReviews = data.results.slice(0, 3).map(review => ({
      author: review.author,
      content: shortenText(review.content, 300), // Limit review length
      rating: review.author_details.rating || 'N/A',
      url: review.url,
      created_at: formatDate(review.created_at)
    }));
    
    return formattedReviews;
    
  } catch (error) {
    console.error('💥 Error fetching reviews from TMDB:', error);
    return []; // Return empty array instead of failing completely
  }
}

async function fetchDetailedMovieData(title) {
  
  try {
    // Find the movie ID in TMDB
    const movieId = await findMovieIdInTMDB(title);
    if (!movieId) {
      return {};
    }
    // Get detailed movie information
    const detailUrl = `${TMDB_API_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}`;
    const response = await fetch(detailUrl);
    const data = await response.json();
    //Extract useful information
    const detailedInfo = {};
    // Box office information
    if (data.revenue && data.revenue > 0) {
      detailedInfo.boxOffice = {
        revenue: data.revenue,
        budget: data.budget || 0,
        formatted: formatBoxOfficeNumbers(data.revenue, data.budget)
      };
    }
    
    detailedInfo.popularity = data.popularity || 0;
    detailedInfo.voteAverage = data.vote_average || 0;
    detailedInfo.voteCount = data.vote_count || 0;
    
    return detailedInfo;

  } catch (error) {
    console.error('Error fetching detailed data from TMDB:', error);
    return {}; // Return empty object instead of failing completely
  }
}

// =============================================================================
// BACKUP API FUNCTION - Use TMDB when OMDb fails
// =============================================================================

async function fetchMovieDataFromTMDB(title) {
  
  try {
    // Search for the movie
    const movieId = await findMovieIdInTMDB(title);
    if (!movieId) {
      throw new Error('Movie not found in TMDB');
    }
    
    // Step 2: Get detailed movie info with credits
    const detailUrl = `${TMDB_API_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}`;
    const response = await fetch(detailUrl);
    const tmdbData = await response.json();
    
    
    // Step 3: Convert TMDB format to match OMDb format (for consistency)
    const convertedData = {
      Title: tmdbData.title,
      Year: tmdbData.release_date ? tmdbData.release_date.substring(0, 4) : 'N/A',
      Released: tmdbData.release_date || 'N/A',
      Poster: tmdbData.poster_path ? 
        `https://image.tmdb.org/t/p/w300${tmdbData.poster_path}` : 'N/A',
      Ratings: [
        {
          Source: 'TMDB',
          Value: tmdbData.vote_average ? `${tmdbData.vote_average}/10` : 'N/A'
        }
      ],
      imdbRating: tmdbData.vote_average ? tmdbData.vote_average.toFixed(1) : 'N/A',
      imdbVotes: tmdbData.vote_count ? tmdbData.vote_count.toLocaleString() : 'N/A',
      imdbID: tmdbData.imdb_id || 'N/A',
      BoxOffice: tmdbData.revenue ? formatSimpleBoxOffice(tmdbData.revenue) : 'N/A',
      Response: 'True'
    };
    
    return convertedData;
    
  } catch (error) {
    console.error('💥 Error using TMDB as backup:', error);
    throw error;
  }
}

// =============================================================================
// HELPER FUNCTIONS - Small utilities used throughout the script
// =============================================================================

// Find a movie's TMDB ID by searching for its title
async function findMovieIdInTMDB(title) {
  
  try {
    const searchUrl = `${TMDB_API_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const movieId = data.results[0].id;
      return movieId;
    }
    
    return null;
    
  } catch (error) {
    console.error('💥 Error searching TMDB:', error);
    return null;
  }
}

// Shorten long text to a specified length
function shortenText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

// Format dates into a readable format
function formatDate(dateString) {
  if (!dateString) return 'Unknown date';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch (error) {
    return 'Unknown date';
  }
}

// Format box office numbers into readable format
function formatBoxOfficeNumbers(revenue, budget = 0) {
  const formatMoney = (amount) => {
    if (amount >= 1000000000) {
      return `$${(amount / 1000000000).toFixed(1)}B`;
    } else if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(0)}M`;
    } else {
      return `$${amount.toLocaleString()}`;
    }
  };
  
  let result = `${formatMoney(revenue)} worldwide`;
  
  if (budget > 0) {
    const profitMultiplier = (revenue / budget).toFixed(1);
    result += ` (${profitMultiplier}x budget)`;
  }
  
  return result;
}

// Simple box office formatting for backup API
function formatSimpleBoxOffice(revenue) {
  if (revenue >= 1000000000) {
    return `$${(revenue / 1000000000).toFixed(1)} billion`;
  } else if (revenue >= 1000000) {
    return `$${(revenue / 1000000).toFixed(0)} million`;
  } else {
    return `$${revenue.toLocaleString()}`;
  }
}


// =============================================================================
// CACHE MANAGEMENT FUNCTIONS - Store and retrieve movie data
// =============================================================================

// Get movie data from cache if it exists and isn't expired
function getMovieFromCache(title) {
  const cacheKey = title.toLowerCase();
  const cachedItem = movieDataCache.get(cacheKey);
  
  if (!cachedItem) {
    return null;
  }
  
  // Check if cached data is still valid (not expired)
  const timeElapsed = Date.now() - cachedItem.timestamp;
  if (timeElapsed > CACHE_EXPIRY_TIME) {
    movieDataCache.delete(cacheKey);
    return null;
  }
  
  return cachedItem.data;
}

// Save movie data to cache
function saveMovieToCache(title, data) {
  const cacheKey = title.toLowerCase();
  
  movieDataCache.set(cacheKey, {
    data: data,
    timestamp: Date.now()
  });
  
  
  // Keep cache size under control
  if (movieDataCache.size > MAX_CACHE_SIZE) {
    // Remove the oldest item (first one added)
    const oldestKey = movieDataCache.keys().next().value;
    movieDataCache.delete(oldestKey);
  }
}

// =============================================================================
// EXTENSION INITIALIZATION - Set up the extension when it starts
// =============================================================================

// This runs when the extension is first installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
  } else if (details.reason === 'update') {
    //comennt
  }
  
  // Clear old cache on install/update
  movieDataCache.clear();
});