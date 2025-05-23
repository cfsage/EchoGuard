/**
 * API Integration for EchoGuard Extension
 * 
 * This file handles communication with backend AI services for enhanced analysis.
 * It supports the improved UI with better error handling and result formatting.
 */

// API endpoint configuration
const API_CONFIG = {
  baseUrl: "https://api.echoguard.io",  // Production endpoint - would be different in dev
  fallbackUrl: "http://localhost:8080",  // Fallback for development/testing
  endpoints: {
    analyzeText: "/analyze_text",
    checkSource: "/check_source"
  },
  // API keys would be securely stored and retrieved in production
  headers: {
    'Content-Type': 'application/json',
    'X-API-Version': '1.0.0'
  }
};

/**
 * Sends page text to the backend for advanced AI analysis
 * @param {string} text - The text content from the webpage
 * @param {object} options - Optional configuration parameters
 * @returns {Promise} - Promise resolving to the AI analysis
 */
async function sendTextForAnalysis(text, options = {}) {
  if (!text || text.length < 50) {
    console.warn("Text too short for analysis");
    return { error: "Text content too short for analysis", status: "insufficient_content" };
  }
  
  const { timeout = 5000, maxLength = 50000 } = options;
  
  try {
    // Trim text to avoid extremely large payloads
    const trimmedText = text.length > maxLength ? 
      text.substring(0, maxLength - 3) + "..." : 
      text;
    
    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Set up the request with timeout
    const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.analyzeText}`, {
      method: 'POST',
      headers: API_CONFIG.headers,
      body: JSON.stringify({ 
        text: trimmedText,
        metadata: {
          timestamp: new Date().toISOString(),
          client_version: chrome.runtime.getManifest().version
        }
      }),
      signal: controller.signal
    }).catch(async error => {
      // If the main API fails, try the fallback
      if (error.name === 'AbortError') {
        throw new Error('API request timed out');
      }
      
      console.log("Primary API unreachable, trying fallback...");
      return fetch(`${API_CONFIG.fallbackUrl}${API_CONFIG.endpoints.analyzeText}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmedText })
      });
    });
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error analyzing text with backend API:", error);
    return { 
      error: error.message || "Failed to analyze text", 
      status: "api_error",
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Checks a domain against the backend's database of sources
 * @param {string} domain - The domain to check
 * @param {object} options - Optional parameters like timeout
 * @returns {Promise} - Promise resolving to the source analysis
 */
async function checkSourceWithAPI(domain, options = {}) {
  if (!domain) {
    return { error: "No domain provided", status: "invalid_input" };
  }
  
  const { timeout = 3000 } = options;
  
  try {
    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Set up the request with timeout
    const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.checkSource}`, {
      method: 'POST',
      headers: API_CONFIG.headers,
      body: JSON.stringify({ 
        domain: domain,
        include_history: true 
      }),
      signal: controller.signal
    }).catch(async error => {
      // If the main API fails, try the fallback
      if (error.name === 'AbortError') {
        throw new Error('API request timed out');
      }
      
      console.log("Primary API unreachable, trying fallback...");
      return fetch(`${API_CONFIG.fallbackUrl}${API_CONFIG.endpoints.checkSource}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain })
      });
    });
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error checking source with backend API:", error);
    return { 
      error: error.message || "Failed to check source", 
      status: "api_error",
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Enhanced version of analyzePageContent that uses the backend API
 * This function integrates with the improved UI and handles errors more gracefully
 */
async function enhancedAnalyzePageContent() {
  // Update UI to show analysis in progress
  if (isAnalyzing) {
    console.log("Analysis already in progress, skipping");
    return;
  }
  
  isAnalyzing = true;
  
  // Set a timeout to prevent hanging
  const analysisTimeout = setTimeout(() => {
    if (isAnalyzing) {
      console.log("API analysis timed out, forcing completion");
      isAnalyzing = false;
      
      // Set default results if we timed out
      analysisResults = {
        analyzed: true,
        credibility: analysisResults.credibility || checkSourceCredibility(window.location.href),
        emotion: { keywordCount: 0, level: "low" },
        timestamp: new Date().toISOString(),
        timedOut: true,
        apiStatus: "timeout"
      };
    }
  }, 8000); // 8 second timeout for the entire analysis
  
  try {
    // Extract page content
    const pageText = extractPageText();
    const currentUrl = window.location.href;
    let domain = "";
    
    try {
      domain = new URL(currentUrl).hostname.toLowerCase();
    } catch (error) {
      console.error("Error extracting domain:", error);
    }
    
    // Start with partial results that can be updated
    analysisResults = {
      analyzed: false,
      credibility: null,
      emotion: null,
      timestamp: new Date().toISOString(),
      inProgress: true
    };
    
    // Run credibility check first (faster)
    const credibilityResult = checkSourceCredibility(currentUrl);
    analysisResults.credibility = credibilityResult;
    
    // Parallel API calls for efficiency
    const [sourceAnalysis, textAnalysis] = await Promise.allSettled([
      domain ? checkSourceWithAPI(domain) : Promise.resolve(null),
      pageText ? sendTextForAnalysis(pageText, { maxLength: 20000 }) : Promise.resolve(null)
    ]);
    
    // Process source analysis results
    if (sourceAnalysis.status === 'fulfilled' && sourceAnalysis.value && !sourceAnalysis.value.error) {
      // Use the API result if available
      analysisResults.credibility = sourceAnalysis.value.source_analysis || credibilityResult;
      analysisResults.apiSourceSuccess = true;
    }
    
    // Process text analysis results
    if (textAnalysis.status === 'fulfilled' && textAnalysis.value && !textAnalysis.value.error) {
      // Enhanced emotional analysis from AI
      const aiAnalysis = textAnalysis.value.analysis;
      
      analysisResults.emotion = {
        keywordCount: aiAnalysis.propaganda_techniques ? 
          aiAnalysis.propaganda_techniques.length : 0,
        level: getEmotionLevelFromScore(aiAnalysis.sentiment.magnitude),
        foundKeywords: aiAnalysis.propaganda_techniques ? 
          aiAnalysis.propaganda_techniques.map(pt => pt.examples).flat() : [],
        aiAnalysis: aiAnalysis
      };
      
      analysisResults.aiSummary = textAnalysis.value.summary;
      analysisResults.apiTextSuccess = true;
    } else {
      // Fallback to basic emotional analysis
      analysisResults.emotion = analyzeTextForEmotion(pageText, emotionalKeywords);
    }
    
    // Add metadata
    analysisResults.metadata = {
      textLength: pageText.length,
      analysisMethod: analysisResults.apiTextSuccess ? "advanced-ai" : "basic-keywords",
      timestamp: new Date().toISOString(),
      url: currentUrl,
      domain: domain
    };
    
    // Mark as complete
    analysisResults.analyzed = true;
    analysisResults.inProgress = false;
    
    // Determine appropriate warning message and level
    if (analysisResults.credibility.isUntrusted) {
      showBanner("This source has a history of unreliability. Information may be misleading.", "untrusted");
    } else if (
      (analysisResults.emotion && analysisResults.emotion.level === "high") || 
      (analysisResults.apiTextSuccess && analysisResults.emotion.aiAnalysis.credibility_score < 0.4)
    ) {
      showBanner("This content contains highly emotional language that may affect objectivity.", "warning");
    }
    
  } catch (error) {
    console.error("Error in enhanced analysis:", error);
    
    // Set error results
    analysisResults = {
      analyzed: true,
      credibility: analysisResults.credibility || { isUntrusted: false, domain: "error" },
      emotion: analysisResults.emotion || { keywordCount: 0, level: "unknown" },
      timestamp: new Date().toISOString(),
      error: error.message,
      apiStatus: "error"
    };
  } finally {
    // Clean up
    isAnalyzing = false;
    clearTimeout(analysisTimeout);
    
    console.log("Enhanced analysis complete:", analysisResults);
  }
  
  return analysisResults;
}

/**
 * Helper function to convert sentiment magnitude to emotion level
 * @param {number} magnitude - The sentiment magnitude (0-1)
 * @returns {string} - Emotion level (low, medium, high)
 */
function getEmotionLevelFromScore(magnitude) {
  if (!magnitude && magnitude !== 0) return "unknown";
  if (magnitude > 0.8) return "high";
  if (magnitude > 0.5) return "medium";
  return "low";
}

/**
 * Format AI analysis results for display in the UI
 * @param {object} aiResults - The AI analysis results
 * @returns {object} - Formatted results for the UI
 */
function formatAIResultsForDisplay(aiResults) {
  if (!aiResults || !aiResults.analysis) {
    return { error: "No AI results available" };
  }
  
  const analysis = aiResults.analysis;
  const summary = aiResults.summary;
  
  // Extract propaganda techniques
  const techniques = analysis.propaganda_techniques || [];
  
  // Format keywords
  const keywords = techniques
    .map(t => t.examples || [])
    .flat()
    .filter((value, index, self) => self.indexOf(value) === index) // unique values
    .slice(0, 15); // limit to 15 keywords
  
  // Get sentiment description
  let sentimentText = "neutral";
  const score = analysis.sentiment.score;
  if (score > 0.3) sentimentText = "positive";
  else if (score < -0.3) sentimentText = "negative";
  
  return {
    summary: summary,
    sentiment: {
      text: sentimentText,
      score: score,
      magnitude: analysis.sentiment.magnitude
    },
    techniques: techniques.map(t => ({
      name: t.technique,
      confidence: t.confidence,
      examples: t.examples
    })),
    keywords: keywords,
    topics: analysis.topic_classification ? [
      analysis.topic_classification.primary_topic,
      ...(analysis.topic_classification.subtopics || [])
    ] : [],
    credibilityScore: analysis.credibility_score
  };
}

// Export functions for potential use in other parts of the extension
window.EchoGuardAPI = {
  sendTextForAnalysis,
  checkSourceWithAPI,
  enhancedAnalyzePageContent,
  formatAIResultsForDisplay
}; 