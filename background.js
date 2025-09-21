// Backend: handles API calls to movie & TV show databases
// Gets movie/show info when content.js requests that info

const OMDB_API_KEY = 'put_your_key_here';
const OMDB_API_URL = 'https://www.omdbapi.com/';

const TMDB_API_KEY = 'put_your_key_here';
const TMDB_API_URL = 'https://api.themoviedb.org/3';

const GEMINI_API_KEY = 'put_your_key_here'; 
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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
        console.error('Can\'t fetch movie data:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

async function fetchCompleteMovieInfo(movieTitle) {
  try {
    //Check if we already have this movie in our cache
    const cachedData = getMovieFromCache(movieTitle);
    if (cachedData) {
      return cachedData;
    }
    // Clean up the movie title for better API results
    const cleanTitle = cleanMovieTitle(movieTitle);
    const dataPromises = [
      fetchBasicMovieData(cleanTitle),
      fetchMovieReviews(cleanTitle),
      fetchDetailedMovieData(cleanTitle),
      fetchMovieFunFact(cleanTitle, '')
    ];

    const results = await Promise.allSettled(dataPromises);
    // Process the results
    const basicData = results[0].status === 'fulfilled' ? results[0].value : null;
    const reviews = results[1].status === 'fulfilled' ? results[1].value : [];
    const detailedData = results[2].status === 'fulfilled' ? results[2].value : {};
    const funFact = results[3].status === 'fulfilled' ? results[3].value : null;

    // If OMDB fails or is missing some info, try TMDB (alternative API)
    let finalMovieData = basicData;
    if (!finalMovieData) {
      finalMovieData = await fetchMovieDataFromTMDB(cleanTitle);
    }
    // Combine data from 2 APIs
    if (finalMovieData) {
      finalMovieData.userReviews = reviews;
      finalMovieData.detailedInfo = detailedData;
      finalMovieData.funFact = funFact;

      // Save to cache for future use (prevents stack overflow from calling API too frequently)
      saveMovieToCache(movieTitle, finalMovieData);
      return finalMovieData;
    } else {
      throw new Error('Movie not found in either database');
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

/* Helper function to get basic info from OMDb */
async function fetchBasicMovieData(title) {
  try {
    const apiUrl = `${OMDB_API_URL}?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}&plot=short`;
    const response = await fetch(apiUrl); // Make the API call
    const data = await response.json();
    if (data.Response === 'False') {
      return await searchMovieInOMDb(title);
    }
    return data;
  } catch (error) {
    console.error('Error fetching from OMDb:', error);
    throw new Error(`OMDb API error: ${error.message}`);
  }
}

/* Helper function to search OMDb for the movie */
async function searchMovieInOMDb(title) {
  try {
    // If no exact match, search for similar titles
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
    throw new Error('Can\'t find movie in OMDb');
  } catch (error) {
    console.error('Error in OMDb search:', error);
    throw error;
  }
}

/* Helper function to get movie reviews from TMDb */
async function fetchMovieReviews(title) {
  try {
    // get movie's TMDB ID
    const movieId = await findMovieIdInTMDB(title);
    if (!movieId) {
      return [];
    }
    const reviewsUrl = `${TMDB_API_URL}/movie/${movieId}/reviews?api_key=${TMDB_API_KEY}`; // Get reviews using the movie ID
    const response = await fetch(reviewsUrl);
    const data = await response.json();
    // Process and format the reviews
    if (!data.results || data.results.length === 0) {
      return [];
    }
    // Use the first 3 reviews and format them nicely
    const formattedReviews = data.results.slice(0, 3).map(review => ({
      author: review.author,
      content: shortenText(review.content, 300), // Limit review length
      rating: review.author_details.rating || 'N/A',
      created_at: formatDate(review.created_at)
    }));

    return formattedReviews;

  } catch (error) {
    console.error('Can\'t fetch reviews from TMDB:', error);
    return []; // Return empty array instead of failing completely
  }
}

/* Helper function to get more detailed info from TMDb, only box office info*/
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
        formatted: formatBoxOfficeNumbers(data.revenue)
      };
    }

    return detailedInfo;

  } catch (error) {
    console.error('Error fetching detailed data from TMDB:', error);
    return {}; // Return empty object instead of failing completely
  }
}

/* Helper function to use TMDb when OMDb fails */
async function fetchMovieDataFromTMDB(title) {

  try {
    // Search for the movie
    const movieId = await findMovieIdInTMDB(title);
    if (!movieId) {
      throw new Error('Movie not found!');
    }

    //Get detailed movie info
    const detailUrl = `${TMDB_API_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}`;
    const response = await fetch(detailUrl);
    const tmdbData = await response.json();

    //Convert TMDB format to match OMDb format, so it displays the same way
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
    console.error('Error using TMDB as backup:', error);
    throw error;
  }
}

/* Helper for helper function: find movie's TMDb ID */
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
    console.error('Error searching TMDB:', error);
    return null;
  }
}

/* Function to cut off long reviews at a specified length */
function shortenText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/* Function to format dates consistently */
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

/* Function to format box office numbers for OMDb */
function formatBoxOfficeNumbers(revenue) {
  const formatMoney = (amount) => {
    if (amount >= 1000000000) {
      return `$${(amount / 1000000000).toFixed(1)} billion`;
    } else if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(0)} million`;
    } else {
      return `$${amount.toLocaleString()}`;
    }
  };

  let result = `${formatMoney(revenue)} worldwide`;

  return result;
}

/* Function to format box office numbers for TMDb */
function formatSimpleBoxOffice(revenue) {
  if (revenue >= 1000000000) {
    return `$${(revenue / 1000000000).toFixed(1)} billion`;
  } else if (revenue >= 1000000) {
    return `$${(revenue / 1000000).toFixed(0)} million`;
  } else {
    return `$${revenue.toLocaleString()}`;
  }
}

// GEMIINI MAGIC !!!
async function fetchMovieFunFact(movieTitle, movieYear) {
  
  try {
    const prompt = `Give me one interesting, fun fact about the movie "${movieTitle}" (${movieYear}). 
    Keep it short (2-3 sentences), spoiler-free, and focus on behind-the-scenes trivia, cast facts, or
    production details. Don't reveal plot points.`;
    
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });
    
    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const funFact = data.candidates[0].content.parts[0].text;
      return funFact;
    } else {
      return null;
    }
    
  } catch (error) {
    return null;
  }
}

/* Function to fetch movie data and store it to avoid overflowing with too many API calls */
function getMovieFromCache(title) {
  const cacheKey = title.toLowerCase();
  const cachedItem = movieDataCache.get(cacheKey);

  if (!cachedItem) {
    return null;
  }

  // Make sure cached data is not expired
  const timeElapsed = Date.now() - cachedItem.timestamp;
  if (timeElapsed > CACHE_EXPIRY_TIME) {
    movieDataCache.delete(cacheKey);
    return null;
  }

  return cachedItem.data;
}

/* Function to save movie data to cache (no need to call API frequently) */
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


/* Initialize the extension! This runs when the extension is installed or updated */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
  } else if (details.reason === 'update') {
    //placeholder comment (nothing needs to be done)
  }

  // Clear old cache
  movieDataCache.clear();
});