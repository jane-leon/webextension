// =============================================================================
// NETFLIX MOVIE INFO EXTENSION - BACKGROUND SCRIPT (Beginner-Friendly Version)
// =============================================================================
// This script runs in the background and handles API calls to movie databases
// It fetches movie information when requested by the content script

// =============================================================================
// API CONFIGURATION - Keys and URLs for movie data services
// =============================================================================

// OMDb API (Open Movie Database) - Primary source for movie info
const OMDB_API_KEY = 'cb486c88'; // TODO: Replace with your own API key
const OMDB_API_URL = 'https://www.omdbapi.com/';

// TMDB API (The Movie Database) - Used for reviews and additional data
const TMDB_API_KEY = '3126e89bfccb852840b00afa13857781'; // TODO: Replace with your own API key  
const TMDB_API_URL = 'https://api.themoviedb.org/3';

// =============================================================================
// CACHING SYSTEM - Store movie data to avoid repeated API calls
// =============================================================================

// Create a cache to store movie data (like a dictionary/map)
const movieDataCache = new Map();

// Cache settings
const CACHE_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_CACHE_SIZE = 100; // Maximum number of movies to cache

// =============================================================================
// MESSAGE HANDLING - Listen for requests from the content script
// =============================================================================

// This is how content script and background script communicate
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Received message from content script:', message);
  
  // Check if the content script is asking for movie information
  if (message.action === 'getMovieInfo') {
    console.log('🎬 Request to get movie info for:', message.title);
    
    // Fetch the movie information (this is async, so we need to handle it properly)
    fetchCompleteMovieInfo(message.title)
      .then(movieData => {
        console.log('✅ Successfully fetched movie data');
        sendResponse({ success: true, data: movieData });
      })
      .catch(error => {
        console.error('❌ Error fetching movie data:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  }
});

// =============================================================================
// MAIN MOVIE FETCHING FUNCTION - Coordinates all data gathering
// =============================================================================

async function fetchCompleteMovieInfo(movieTitle) {
  console.log(`🔍 Starting to fetch complete info for: "${movieTitle}"`);
  
  try {
    // Step 1: Check if we already have this movie in our cache
    const cachedData = getMovieFromCache(movieTitle);
    if (cachedData) {
      console.log('⚡ Found movie in cache, returning cached data');
      return cachedData;
    }
    
    // Step 2: Clean up the movie title for better API results
    const cleanTitle = cleanMovieTitle(movieTitle);
    console.log(`🧹 Cleaned title: "${movieTitle}" → "${cleanTitle}"`);
    
    // Step 3: Fetch data from multiple sources simultaneously
    console.log('🚀 Fetching data from multiple sources...');
    
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
      console.log('⚠️ Primary API failed, trying backup API...');
      finalMovieData = await fetchMovieDataFromTMDB(cleanTitle);
    }
    
    // Step 6: Combine all the data
    if (finalMovieData) {
      finalMovieData.userReviews = reviews;
      finalMovieData.detailedInfo = detailedData;
      
      // Step 7: Save to cache for future use
      saveMovieToCache(movieTitle, finalMovieData);
      
      console.log('🎉 Successfully compiled complete movie data');
      return finalMovieData;
    } else {
      throw new Error('Movie not found in any database');
    }
    
  } catch (error) {
    console.error('💥 Error in fetchCompleteMovieInfo:', error);
    throw error;
  }
}

// =============================================================================
// TITLE CLEANING - Improve movie titles for better API search results
// =============================================================================

function cleanMovieTitle(title) {
  console.log(`🧽 Cleaning title: "${title}"`);
  
  let cleanedTitle = title
    // Remove content in parentheses: "Movie Title (2021)" → "Movie Title"
    .replace(/\([^)]*\)/g, '')
    
    // Remove content in square brackets: "Movie Title [HD]" → "Movie Title"
    .replace(/\[[^\]]*\]/g, '')
    
    // Remove season information: "Show: Season 1" → "Show"
    .replace(/:\s*Season\s*\d+/i, '')
    
    // Remove episode information: "Show: Episode 1" → "Show"
    .replace(/:\s*Episode\s*\d+/i, '')
    
    // Clean up extra spaces: "Movie    Title" → "Movie Title"
    .replace(/\s+/g, ' ')
    
    // Remove leading/trailing spaces
    .trim();
  
  console.log(`✨ Cleaned result: "${cleanedTitle}"`);
  return cleanedTitle;
}

// =============================================================================
// BASIC MOVIE DATA - Fetch main movie information from OMDb API
// =============================================================================

async function fetchBasicMovieData(title) {
  console.log(`📡 Fetching basic movie data from OMDb for: "${title}"`);
  
  try {
    // Build the API URL
    const apiUrl = `${OMDB_API_URL}?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}&plot=short`;
    console.log('🔗 API URL:', apiUrl);
    
    // Make the API call
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    console.log('📥 OMDb API response:', data);
    
    // Check if the API call was successful
    if (data.Response === 'False') {
      console.log('❌ OMDb exact match failed, trying search...');
      
      // Try searching instead of exact match
      return await searchMovieInOMDb(title);
    }
    
    console.log('✅ Successfully fetched basic movie data from OMDb');
    return data;
    
  } catch (error) {
    console.error('💥 Error fetching from OMDb:', error);
    throw new Error(`OMDb API error: ${error.message}`);
  }
}

// Helper function to search for movies when exact match fails
async function searchMovieInOMDb(title) {
  console.log(`🔍 Searching OMDb for movies matching: "${title}"`);
  
  try {
    // Search for movies with similar titles
    const searchUrl = `${OMDB_API_URL}?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(title)}`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    console.log('🔍 OMDb search results:', searchData);
    
    // Check if we found any results
    if (searchData.Response === 'True' && searchData.Search && searchData.Search.length > 0) {
      // Get detailed info for the first (most relevant) result
      const firstResult = searchData.Search[0];
      console.log('🎯 Using first search result:', firstResult.Title);
      
      const detailUrl = `${OMDB_API_URL}?apikey=${OMDB_API_KEY}&i=${firstResult.imdbID}&plot=short`;
      const detailResponse = await fetch(detailUrl);
      const detailData = await detailResponse.json();
      
      if (detailData.Response === 'True') {
        console.log('✅ Successfully got details from OMDb search');
        return detailData;
      }
    }
    
    throw new Error('No matching movies found in OMDb');
    
  } catch (error) {
    console.error('💥 Error in OMDb search:', error);
    throw error;
  }
}

// =============================================================================
// MOVIE REVIEWS - Fetch user reviews from TMDB API
// =============================================================================

async function fetchMovieReviews(title) {
  console.log(`💬 Fetching movie reviews from TMDB for: "${title}"`);
  
  try {
    // Step 1: Search for the movie to get its TMDB ID
    const movieId = await findMovieIdInTMDB(title);
    if (!movieId) {
      console.log('❌ Could not find movie in TMDB for reviews');
      return [];
    }
    
    // Step 2: Get reviews using the movie ID
    const reviewsUrl = `${TMDB_API_URL}/movie/${movieId}/reviews?api_key=${TMDB_API_KEY}`;
    console.log('🔗 TMDB reviews URL:', reviewsUrl);
    
    const response = await fetch(reviewsUrl);
    const data = await response.json();
    
    console.log('📥 TMDB reviews response:', data);
    
    // Step 3: Process and format the reviews
    if (!data.results || data.results.length === 0) {
      console.log('📝 No reviews found for this movie');
      return [];
    }
    
    // Take the first 3 reviews and format them nicely
    const formattedReviews = data.results.slice(0, 3).map(review => ({
      author: review.author,
      content: shortenText(review.content, 200), // Limit review length
      rating: review.author_details.rating || 'N/A',
      url: review.url,
      created_at: formatDate(review.created_at)
    }));
    
    console.log(`✅ Successfully formatted ${formattedReviews.length} reviews`);
    return formattedReviews;
    
  } catch (error) {
    console.error('💥 Error fetching reviews from TMDB:', error);
    return []; // Return empty array instead of failing completely
  }
}

// =============================================================================
// DETAILED MOVIE DATA - Fetch additional info like box office from TMDB
// =============================================================================

async function fetchDetailedMovieData(title) {
  console.log(`💎 Fetching detailed movie data from TMDB for: "${title}"`);
  
  try {
    // Step 1: Find the movie ID in TMDB
    const movieId = await findMovieIdInTMDB(title);
    if (!movieId) {
      console.log('❌ Could not find movie in TMDB for detailed data');
      return {};
    }
    
    // Step 2: Get detailed movie information
    const detailUrl = `${TMDB_API_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}`;
    console.log('🔗 TMDB detail URL:', detailUrl);
    
    const response = await fetch(detailUrl);
    const data = await response.json();
    
    console.log('📥 TMDB detailed response:', data);
    
    // Step 3: Extract useful information
    const detailedInfo = {};
    
    // Box office information
    if (data.revenue && data.revenue > 0) {
      detailedInfo.boxOffice = {
        revenue: data.revenue,
        budget: data.budget || 0,
        formatted: formatBoxOfficeNumbers(data.revenue, data.budget)
      };
      console.log('💰 Added box office data');
    }
    
    // Additional ratings and popularity
    detailedInfo.popularity = data.popularity || 0;
    detailedInfo.voteAverage = data.vote_average || 0;
    detailedInfo.voteCount = data.vote_count || 0;
    
    console.log('✅ Successfully compiled detailed movie data');
    return detailedInfo;
    
  } catch (error) {
    console.error('💥 Error fetching detailed data from TMDB:', error);
    return {}; // Return empty object instead of failing completely
  }
}

// =============================================================================
// BACKUP API FUNCTION - Use TMDB when OMDb fails
// =============================================================================

async function fetchMovieDataFromTMDB(title) {
  console.log(`🔄 Using TMDB as backup API for: "${title}"`);
  
  try {
    // Step 1: Search for the movie
    const movieId = await findMovieIdInTMDB(title);
    if (!movieId) {
      throw new Error('Movie not found in TMDB');
    }
    
    // Step 2: Get detailed movie info with credits
    const detailUrl = `${TMDB_API_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
    const response = await fetch(detailUrl);
    const tmdbData = await response.json();
    
    console.log('📥 TMDB backup data:', tmdbData);
    
    // Step 3: Convert TMDB format to match OMDb format (for consistency)
    const convertedData = {
      Title: tmdbData.title,
      Year: tmdbData.release_date ? tmdbData.release_date.substring(0, 4) : 'N/A',
      Rated: 'N/A', // TMDB doesn't have MPAA ratings
      Released: tmdbData.release_date || 'N/A',
      Runtime: tmdbData.runtime ? `${tmdbData.runtime} min` : 'N/A',
      Genre: tmdbData.genres ? tmdbData.genres.map(g => g.name).join(', ') : 'N/A',
      Director: extractDirectorFromCredits(tmdbData.credits),
      Writer: 'N/A', // TMDB doesn't easily provide writer info
      Actors: extractActorsFromCredits(tmdbData.credits),
      Plot: tmdbData.overview || 'No plot available',
      Language: tmdbData.original_language || 'N/A',
      Country: tmdbData.production_countries ? 
        tmdbData.production_countries.map(c => c.name).join(', ') : 'N/A',
      Awards: 'N/A', // TMDB doesn't have awards info
      Poster: tmdbData.poster_path ? 
        `https://image.tmdb.org/t/p/w300${tmdbData.poster_path}` : 'N/A',
      Ratings: [
        {
          Source: 'TMDB',
          Value: tmdbData.vote_average ? `${tmdbData.vote_average}/10` : 'N/A'
        }
      ],
      Metascore: 'N/A',
      imdbRating: tmdbData.vote_average ? tmdbData.vote_average.toFixed(1) : 'N/A',
      imdbVotes: tmdbData.vote_count ? tmdbData.vote_count.toLocaleString() : 'N/A',
      imdbID: tmdbData.imdb_id || 'N/A',
      Type: 'movie',
      DVD: 'N/A',
      BoxOffice: tmdbData.revenue ? formatSimpleBoxOffice(tmdbData.revenue) : 'N/A',
      Production: tmdbData.production_companies ? 
        tmdbData.production_companies.map(c => c.name).join(', ') : 'N/A',
      Website: tmdbData.homepage || 'N/A',
      Response: 'True'
    };
    
    console.log('✅ Successfully converted TMDB data to OMDb format');
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
  console.log(`🔍 Searching for "${title}" in TMDB...`);
  
  try {
    const searchUrl = `${TMDB_API_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const movieId = data.results[0].id;
      console.log(`✅ Found movie ID: ${movieId}`);
      return movieId;
    }
    
    console.log('❌ Movie not found in TMDB search');
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

// Extract director name from TMDB credits
function extractDirectorFromCredits(credits) {
  if (!credits || !credits.crew) return 'N/A';
  
  const director = credits.crew.find(person => person.job === 'Director');
  return director ? director.name : 'N/A';
}

// Extract main actors from TMDB credits
function extractActorsFromCredits(credits) {
  if (!credits || !credits.cast) return 'N/A';
  
  // Get the first 3 actors
  const mainActors = credits.cast.slice(0, 3).map(actor => actor.name);
  return mainActors.length > 0 ? mainActors.join(', ') : 'N/A';
}

// =============================================================================
// CACHE MANAGEMENT FUNCTIONS - Store and retrieve movie data
// =============================================================================

// Get movie data from cache if it exists and isn't expired
function getMovieFromCache(title) {
  const cacheKey = title.toLowerCase();
  const cachedItem = movieDataCache.get(cacheKey);
  
  if (!cachedItem) {
    console.log('📭 No cached data found');
    return null;
  }
  
  // Check if cached data is still valid (not expired)
  const timeElapsed = Date.now() - cachedItem.timestamp;
  if (timeElapsed > CACHE_EXPIRY_TIME) {
    console.log('⏰ Cached data is expired, removing from cache');
    movieDataCache.delete(cacheKey);
    return null;
  }
  
  console.log('⚡ Using cached data (age: ' + Math.round(timeElapsed / 1000 / 60) + ' minutes)');
  return cachedItem.data;
}

// Save movie data to cache
function saveMovieToCache(title, data) {
  const cacheKey = title.toLowerCase();
  
  movieDataCache.set(cacheKey, {
    data: data,
    timestamp: Date.now()
  });
  
  console.log(`💾 Saved "${title}" to cache`);
  
  // Keep cache size under control
  if (movieDataCache.size > MAX_CACHE_SIZE) {
    // Remove the oldest item (first one added)
    const oldestKey = movieDataCache.keys().next().value;
    movieDataCache.delete(oldestKey);
    console.log('🧹 Removed oldest item from cache to keep size under control');
  }
}

// =============================================================================
// EXTENSION INITIALIZATION - Set up the extension when it starts
// =============================================================================

// This runs when the extension is first installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🎉 Netflix Movie Info Extension installed successfully!');
    console.log('🎬 Ready to fetch movie information!');
  } else if (details.reason === 'update') {
    console.log('🔄 Netflix Movie Info Extension updated!');
  }
  
  // Clear old cache on install/update
  movieDataCache.clear();
  console.log('🧹 Cache cleared for fresh start');
});