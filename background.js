// Background script for Netflix Movie Info Extension

// Background script for Netflix Movie Info Extension

// Built-in API configuration (no user setup required!)
const OMDB_API_KEY = '916c6abc'; // Free API key - replace with your own
const OMDB_BASE_URL = 'https://www.omdbapi.com/';

const TMDB_API_KEY = 'a4f5c5f6e3d2c1b0a9f8e7d6c5b4a3f2'; // Replace with your TMDB key
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Cache for movie data to reduce API calls
const movieCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getMovieInfo') {
    getMovieInfo(request.title)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Will respond asynchronously
  }
});

// Main function to get movie information
async function getMovieInfo(title) {
  try {
    // Check cache first
    const cached = getCachedMovie(title);
    if (cached) {
      return cached;
    }
    
    // Clean title for better API results
    const cleanedTitle = cleanMovieTitle(title);
    
    // Get movie data from both APIs
    const [movieData, reviewsData, detailedData] = await Promise.allSettled([
      searchMovie(cleanedTitle),
      getMovieReviews(cleanedTitle),
      getDetailedMovieData(cleanedTitle)
    ]);
    
    // Combine the data
    let combinedData = movieData.status === 'fulfilled' ? movieData.value : null;
    const reviews = reviewsData.status === 'fulfilled' ? reviewsData.value : [];
    const detailed = detailedData.status === 'fulfilled' ? detailedData.value : {};
    
    // If OMDb fails, try TMDB as backup
    if (!combinedData) {
      combinedData = await searchMovieWithTMDB(cleanedTitle);
    }
    
    // Add reviews and detailed info to the movie data
    if (combinedData) {
      combinedData.userReviews = reviews;
      combinedData.detailedInfo = detailed;
    }
    
    // Cache the result
    cacheMovie(title, combinedData);
    
    return combinedData;
  } catch (error) {
    console.error('Error fetching movie info:', error);
    throw error;
  }
}

// Clean movie title for better API search results
function cleanMovieTitle(title) {
  return title
    .replace(/\([^)]*\)/g, '') // Remove parentheses content
    .replace(/\[[^\]]*\]/g, '') // Remove bracket content
    .replace(/:\s*Season\s*\d+/i, '') // Remove season info
    .replace(/:\s*Episode\s*\d+/i, '') // Remove episode info
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

// Search for movie using OMDb API
async function searchMovie(title) {
  const url = `${OMDB_BASE_URL}?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}&plot=short`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.Response === 'False') {
    // Try searching by title only if exact match fails
    const searchUrl = `${OMDB_BASE_URL}?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(title)}`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (searchData.Response === 'True' && searchData.Search && searchData.Search.length > 0) {
      // Get details for the first search result
      const firstResult = searchData.Search[0];
      const detailUrl = `${OMDB_BASE_URL}?apikey=${OMDB_API_KEY}&i=${firstResult.imdbID}&plot=short`;
      const detailResponse = await fetch(detailUrl);
      const detailData = await detailResponse.json();
      
      if (detailData.Response === 'True') {
        return detailData;
      }
    }
    
    throw new Error(data.Error || 'Movie not found');
  }
  
  return data;
}

// Cache management
function getCachedMovie(title) {
  const cached = movieCache.get(title.toLowerCase());
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function cacheMovie(title, data) {
  movieCache.set(title.toLowerCase(), {
    data: data,
    timestamp: Date.now()
  });
  
  // Limit cache size
  if (movieCache.size > 100) {
    const oldestKey = movieCache.keys().next().value;
    movieCache.delete(oldestKey);
  }
}

// Get movie reviews from TMDB
async function getMovieReviews(title) {
  try {
    // First, search for the movie to get its ID
    const searchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (!searchData.results || searchData.results.length === 0) {
      return [];
    }
    
    const movieId = searchData.results[0].id;
    
    // Get reviews for the movie
    const reviewsUrl = `${TMDB_BASE_URL}/movie/${movieId}/reviews?api_key=${TMDB_API_KEY}`;
    const reviewsResponse = await fetch(reviewsUrl);
    const reviewsData = await reviewsResponse.json();
    
    if (!reviewsData.results || reviewsData.results.length === 0) {
      return [];
    }
    
    // Process and return top 3 reviews
    return reviewsData.results.slice(0, 3).map(review => ({
      author: review.author,
      content: truncateText(review.content, 200),
      rating: review.author_details.rating || 'N/A',
      url: review.url,
      created_at: formatDate(review.created_at)
    }));
    
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return [];
  }
}

// Get detailed movie data including awards and box office from TMDB
async function getDetailedMovieData(title) {
  try {
    // First, search for the movie to get its ID
    const searchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (!searchData.results || searchData.results.length === 0) {
      return {};
    }
    
    const movieId = searchData.results[0].id;
    
    // Get detailed movie info including revenue
    const detailUrl = `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}`;
    const detailResponse = await fetch(detailUrl);
    const detailData = await detailResponse.json();
    
    const result = {};
    
    // Box office data
    if (detailData.revenue && detailData.revenue > 0) {
      result.boxOffice = {
        revenue: detailData.revenue,
        budget: detailData.budget || 0,
        formatted: formatBoxOffice(detailData.revenue, detailData.budget)
      };
    }
    
    // Awards data (we'll enhance OMDb awards with additional context)
    result.popularity = detailData.popularity || 0;
    result.voteAverage = detailData.vote_average || 0;
    result.voteCount = detailData.vote_count || 0;
    
    return result;
    
  } catch (error) {
    console.error('Error fetching detailed movie data:', error);
    return {};
  }
}

// Format box office numbers into readable format
function formatBoxOffice(revenue, budget = 0) {
  const formatMoney = (amount) => {
    if (amount >= 1000000000) {
      return `${(amount / 1000000000).toFixed(1)}B`;
    } else if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(0)}M`;
    } else {
      return `${amount.toLocaleString()}`;
    }
  };
  
  let result = `${formatMoney(revenue)} worldwide`;
  
  if (budget > 0) {
    const profit = revenue - budget;
    const profitMultiplier = (revenue / budget).toFixed(1);
    result += ` (${profitMultiplier}x budget)`;
  }
  
  return result;
}

// Enhanced awards parsing
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
      display: `🏆 ${oscarWins[1]} Oscar${oscarWins[1] > 1 ? 's' : ''}`
    });
  }
  
  // Parse Oscar nominations
  const oscarNoms = awardsString.match(/Nominated for (\d+) Oscar/i);
  if (oscarNoms && !oscarWins) {
    awards.push({
      type: 'Oscar',
      status: 'Nominated',
      count: parseInt(oscarNoms[1]),
      display: `🎬 ${oscarNoms[1]} Oscar nomination${oscarNoms[1] > 1 ? 's' : ''}`
    });
  }
  
  // Parse Golden Globe wins
  const ggWins = awardsString.match(/Won (\d+) Golden Globe/i);
  if (ggWins) {
    awards.push({
      type: 'Golden Globe',
      status: 'Won',
      count: parseInt(ggWins[1]),
      display: `🌟 ${ggWins[1]} Golden Globe${ggWins[1] > 1 ? 's' : ''}`
    });
  }
  
  // Parse BAFTA wins
  const baftaWins = awardsString.match(/Won (\d+) BAFTA/i);
  if (baftaWins) {
    awards.push({
      type: 'BAFTA',
      status: 'Won',
      count: parseInt(baftaWins[1]),
      display: `🎭 ${baftaWins[1]} BAFTA${baftaWins[1] > 1 ? 's' : ''}`
    });
  }
  
  // Catch-all for other wins
  const otherWins = awardsString.match(/Won (\d+) wins?/i);
  if (otherWins && awards.length === 0) {
    awards.push({
      type: 'Various',
      status: 'Won',
      count: parseInt(otherWins[1]),
      display: `🏅 ${otherWins[1]} award${otherWins[1] > 1 ? 's' : ''}`
    });
  }
  
  return awards.length > 0 ? awards : null;
}

// Helper function to truncate long review text
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

// Helper function to format date
function formatDate(dateString) {
  if (!dateString) return 'Unknown date';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

// Alternative API function using The Movie Database (TMDB) as backup
async function searchMovieWithTMDB(title) {
  try {
    // Search for movie
    const searchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const movie = data.results[0];
      
      // Get additional details
      const detailUrl = `${TMDB_BASE_URL}/movie/${movie.id}?api_key=${TMDB_API_KEY}&append_to_response=credits,keywords`;
      const detailResponse = await fetch(detailUrl);
      const details = await detailResponse.json();
      
      // Convert TMDB format to OMDb-like format for consistency
      return {
        Title: details.title,
        Year: details.release_date ? details.release_date.substring(0, 4) : 'N/A',
        Rated: 'N/A', // TMDB doesn't provide MPAA ratings
        Released: details.release_date || 'N/A',
        Runtime: details.runtime ? `${details.runtime} min` : 'N/A',
        Genre: details.genres ? details.genres.map(g => g.name).join(', ') : 'N/A',
        Director: details.credits && details.credits.crew ? 
          details.credits.crew.find(c => c.job === 'Director')?.name || 'N/A' : 'N/A',
        Writer: 'N/A',
        Actors: details.credits && details.credits.cast ? 
          details.credits.cast.slice(0, 3).map(a => a.name).join(', ') : 'N/A',
        Plot: details.overview || 'No plot available',
        Language: details.original_language || 'N/A',
        Country: details.production_countries ? 
          details.production_countries.map(c => c.name).join(', ') : 'N/A',
        Awards: 'N/A',
        Poster: details.poster_path ? 
          `https://image.tmdb.org/t/p/w300${details.poster_path}` : 'N/A',
        Ratings: [
          {
            Source: 'TMDB',
            Value: details.vote_average ? `${details.vote_average}/10` : 'N/A'
          }
        ],
        Metascore: 'N/A',
        imdbRating: details.vote_average ? details.vote_average.toFixed(1) : 'N/A',
        imdbVotes: details.vote_count ? details.vote_count.toLocaleString() : 'N/A',
        imdbID: details.imdb_id || 'N/A',
        Type: 'movie',
        DVD: 'N/A',
        BoxOffice: details.revenue ? `${details.revenue.toLocaleString()}` : 'N/A',
        Production: details.production_companies ? 
          details.production_companies.map(c => c.name).join(', ') : 'N/A',
        Website: details.homepage || 'N/A',
        Response: 'True'
      };
    }
    
    throw new Error('Movie not found in TMDB');
  } catch (error) {
    console.error('TMDB API error:', error);
    throw error;
  }
}

// Initialize extension
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Netflix Movie Info Extension installed - ready to use!');
  }
});