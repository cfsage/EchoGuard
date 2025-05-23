// List of domains known for misinformation or extreme bias
const untrustedDomains = [
  "example-fake-news.com",
  "another-biased-site.org",
  "unreliable-source.net",
  "extreme-bias.info",
  "conspiracy-news.com"
];

// List of emotional keywords that may indicate manipulative content
const emotionalKeywords = [
  "shocking",
  "outrageous",
  "miracle",
  "secret",
  "warning",
  "must see",
  "amazing",
  "ultimate",
  "jaw-dropping",
  "they don't want you to know",
  "the truth about",
  "what they aren't telling you",
  "bombshell",
  "explosive",
  "unbelievable",
  "triggers",
  "emotional",
  "reaction",
  "trauma",
  "anxiety",
  "stress",
  "panic",
  "anger",
  "fear"
];

// Store analysis results for communication with popup
let analysisResults = {
  analyzed: false,
  credibility: null,
  emotion: null,
  timestamp: null,
  apiStatus: null, // To track API call status
  aiSummary: null // To store AI-generated summary
};

// Initialization flag to prevent multiple analyses
let isInitialized = false;
let isAnalyzing = false;
let analysisTimeout = null;

// Signal that the content script is ready
console.log("EchoGuard content script loaded at " + new Date().toISOString());

// Initialize when the DOM is ready
function initialize() {
  if (isInitialized) return;
  
  console.log("EchoGuard initializing...");
  isInitialized = true;
  
  // Add our custom stylesheet for UI elements
  addEchoGuardStyles();
  
  // If document is already loaded, analyze immediately
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(analyzePageContentWithAI, 100); // Use the new AI function
  } else {
    // Otherwise wait for the page to load
    window.addEventListener('DOMContentLoaded', function() {
      setTimeout(analyzePageContentWithAI, 100); // Use the new AI function
    });
    window.addEventListener('load', function() {
      if (!analysisResults.analyzed) {
        analyzePageContentWithAI(); // Use the new AI function
      }
    });
  }
}

// Add custom styles for our UI elements
function addEchoGuardStyles() {
  if (document.getElementById('echoguard-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'echoguard-styles';
  style.textContent = `
    @keyframes echoguard-slide-down {
      from { transform: translateY(-100%); }
      to { transform: translateY(0); }
    }
    
    @keyframes echoguard-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes echoguard-pulse {
      0% { box-shadow: 0 0 0 0 rgba(255, 64, 129, 0.4); }
      70% { box-shadow: 0 0 0 10px rgba(255, 64, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(255, 64, 129, 0); }
    }
    
    #echoguard-banner {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      padding: 0;
      z-index: 2147483647;
      font-size: 14px;
      text-align: center;
      animation: echoguard-slide-down 0.4s ease-out, echoguard-fade-in 0.5s ease;
      box-shadow: 0 2px 10px rgba(0,0,0,0.15);
      border-bottom: 1px solid rgba(0,0,0,0.05);
    }
    
    .echoguard-banner-inner {
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .echoguard-untrusted {
      background: linear-gradient(135deg, #ff4d4d, #d63031);
      color: white;
    }
    
    .echoguard-warning {
      background: linear-gradient(135deg, #ffeaa7, #fdcb6e);
      color: #333;
    }
    
    .echoguard-info {
      background: linear-gradient(135deg, #74b9ff, #0984e3);
      color: white;
    }
    
    .echoguard-icon {
      flex-shrink: 0;
      margin-right: 12px;
      display: flex;
    }
    
    .echoguard-content {
      flex-grow: 1;
      text-align: left;
      font-weight: 500;
    }
    
    .echoguard-close {
      background: transparent;
      border: none;
      color: inherit;
      opacity: 0.6;
      cursor: pointer;
      padding: 8px;
      margin-left: 10px;
      transition: opacity 0.2s, transform 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      width: 32px;
      height: 32px;
    }
    
    .echoguard-close:hover {
      opacity: 1;
      background-color: rgba(0, 0, 0, 0.1);
      transform: scale(1.1);
    }
    
    .echoguard-close:active {
      transform: scale(0.95);
    }
    
    .echoguard-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      margin-right: 8px;
      background-color: rgba(255, 255, 255, 0.25);
    }
    
    .echoguard-timer {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      background-color: rgba(255, 255, 255, 0.5);
      width: 100%;
      transition: width 30s linear;
    }
    
    .echoguard-learn-more {
      margin-left: 12px;
      color: inherit;
      text-decoration: underline;
      opacity: 0.85;
      font-size: 12px;
      cursor: pointer;
    }
    
    .echoguard-learn-more:hover {
      opacity: 1;
    }
    
    #echoguard-banner strong {
      font-weight: 700;
    }
    
    /* Updated emotional keywords counter */
    .echoguard-counter {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background-color: rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      padding: 2px 8px;
      margin-left: 8px;
      font-size: 12px;
      font-weight: 600;
    }
    
    /* Improved focus styles for better accessibility */
    .echoguard-close:focus, 
    .echoguard-learn-more:focus {
      outline: 2px solid white;
      outline-offset: 2px;
      opacity: 1;
    }
    
    @media (max-width: 768px) {
      .echoguard-banner-inner {
        padding: 10px 15px;
      }
      
      #echoguard-banner {
        font-size: 13px;
      }
    }
  `;
  document.head.appendChild(style);
}

// Main function to analyze the page content using AI
async function analyzePageContentWithAI() {
  if (isAnalyzing) {
    console.log("EchoGuard: AI Analysis already in progress, skipping");
    return;
  }
  
  if (analysisTimeout) clearTimeout(analysisTimeout);
  analysisTimeout = setTimeout(() => {
    if (isAnalyzing) {
      console.log("EchoGuard: AI Analysis timed out, providing fallback");
      isAnalyzing = false;
      if (!analysisResults.analyzed) {
        analysisResults = {
          analyzed: true,
          credibility: analysisResults.credibility || checkSourceCredibility(window.location.href), // Fallback
          emotion: analysisResults.emotion || { keywordCount: 0, level: "low" }, // Fallback
          timestamp: new Date().toISOString(),
          timedOut: true,
          apiStatus: "timeout",
          aiSummary: "AI analysis timed out."
        };
        updateUIAfterAnalysis(analysisResults); 
      }
    }
  }, 10000); // 10-second timeout for AI analysis

  isAnalyzing = true;
  console.log("EchoGuard: Starting AI-powered page analysis");

  try {
    // Call the enhanced analysis function from api_integration.js
    // This function is expected to handle its own API calls and fallbacks
    const results = await enhancedAnalyzePageContent(); 

    analysisResults = {
        ...results, // Spread the results from enhancedAnalyzePageContent
        analyzed: true,
        inProgress: false,
        timestamp: new Date().toISOString(),
        apiStatus: results.error ? "error" : "success" 
    };
    
    updateUIAfterAnalysis(analysisResults);

  } catch (error) {
    console.error("EchoGuard AI analysis error:", error);
    analysisResults = {
      analyzed: true,
      credibility: checkSourceCredibility(window.location.href), // Fallback
      emotion: analyzeTextForEmotion(extractPageText(), emotionalKeywords), // Fallback
      timestamp: new Date().toISOString(),
      error: error.message,
      apiStatus: "error",
      aiSummary: "An error occurred during AI analysis."
    };
    updateUIAfterAnalysis(analysisResults);
  } finally {
    isAnalyzing = false;
    clearTimeout(analysisTimeout);
    analysisTimeout = null;
  }
}

// Function to update UI elements based on analysis results
function updateUIAfterAnalysis(currentResults) {
    // Determine the appropriate warning message and level
    if (currentResults.credibility && currentResults.credibility.isUntrusted) {
        showBanner(currentResults.aiSummary || "This source has a history of unreliability. Information may be misleading.", "untrusted");
    } else if (currentResults.emotion && (currentResults.emotion.level === "high" || (currentResults.emotion.aiAnalysis && currentResults.emotion.aiAnalysis.credibility_score < 0.4))) {
        showBanner(currentResults.aiSummary || "This content uses highly emotional or manipulative language. Read critically.", "warning");
    } else if (currentResults.error) {
        showBanner(`Analysis Error: ${currentResults.error}`, "error");
    } else if (currentResults.timedOut) {
        showBanner("Analysis timed out. Basic checks applied.", "warning");
    }
    // Optionally, show a neutral banner or no banner if everything is fine
    
    console.log("EchoGuard AI analysis complete, UI updated:", currentResults);
}

// Extract the main text content from the page
function extractPageText() {
  // Get all text nodes from the body, excluding script and style tags
  const textContent = document.body.innerText || "";
  
  // Verification - if innerText is empty, try a different approach
  if (!textContent || textContent.trim().length < 50) {
    const paragraphs = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, div:not(:has(*))'));
    const extractedText = paragraphs.map(el => el.textContent).join(' ');
    if (extractedText.trim().length > textContent.trim().length) {
      return extractedText;
    }
  }
  
  return textContent;
}

// Check if the current website is from a known unreliable source
function checkSourceCredibility(currentUrl) {
  try {
    const domain = new URL(currentUrl).hostname.toLowerCase();
    
    // Check if the domain or a subdomain of it matches any in our list
    const isUntrusted = untrustedDomains.some(untrustedDomain => {
      return domain === untrustedDomain || domain.endsWith('.' + untrustedDomain);
    });
    
    return { isUntrusted, domain };
  } catch (error) {
    console.error("Error checking domain:", error);
    return { isUntrusted: false, domain: "" };
  }
}

// Analyze text for emotional or manipulative language
function analyzeTextForEmotion(text, keywords) {
  // Safety check - if text is empty or not a string, return low
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { keywordCount: 0, level: "low" };
  }
  
  let keywordCount = 0;
  const foundKeywords = [];
  const textLower = text.toLowerCase();
  
  // Count occurrences of emotional keywords
  keywords.forEach(keyword => {
    // Skip very short keywords to avoid false positives
    if (keyword.length < 3) return;
    
    try {
      const regex = new RegExp('\\b' + keyword + '\\b', 'gi');
      const matches = textLower.match(regex);
      if (matches) {
        keywordCount += matches.length;
        foundKeywords.push(keyword);
      }
    } catch (e) {
      console.error(`Error with regex for keyword "${keyword}":`, e);
    }
  });
  
  // Determine emotion level based on keyword count
  let level = "low";
  if (keywordCount > 5) {
    level = "high";
  } else if (keywordCount > 2) {
    level = "medium";
  }
  
  return { keywordCount, level, foundKeywords };
}

// Display a warning banner at the top of the page
function showBanner(message, level) {
  // Remove any existing banner
  const existingBanner = document.getElementById('echoguard-banner');
  if (existingBanner) {
    existingBanner.remove();
  }
  
  // Add our custom stylesheet for the banner
  addEchoGuardStyles();
  
  // Create a new banner element
  const banner = document.createElement('div');
  banner.id = 'echoguard-banner';
  banner.className = level === 'untrusted' ? 'echoguard-untrusted' : 
                     level === 'warning' ? 'echoguard-warning' : 
                     'echoguard-info';
  
  // Generate appropriate icon and message based on the warning level
  let iconSvg = '';
  let badgeText = '';
  let learnMoreHtml = '';
  let keywordCounter = '';
  
  if (level === 'untrusted') {
    // Red alert for unreliable sources
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    badgeText = 'UNRELIABLE SOURCE';
    learnMoreHtml = `<span class="echoguard-learn-more" onclick="window.open('https://echoguard.io/unreliable-sources', '_blank')">Learn why</span>`;
  } else if (level === 'warning') {
    // Yellow warning for emotional language
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><circle cx="9" cy="9" r="1"></circle><circle cx="15" cy="9" r="1"></circle><circle cx="12" cy="12" r="10"></circle></svg>`;
    badgeText = 'EMOTIONAL LANGUAGE';
    
    // Add keyword counter if available
    if (analysisResults.emotion && analysisResults.emotion.keywordCount) {
      keywordCounter = `<span class="echoguard-counter">${analysisResults.emotion.keywordCount} emotional terms</span>`;
    }
  } else {
    // Blue info for general information
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    badgeText = 'INFO';
  }
  
  // Add the inner content with flexbox layout
  banner.innerHTML = `
    <div class="echoguard-banner-inner">
      <div class="echoguard-icon">${iconSvg}</div>
      <div class="echoguard-content">
        <span class="echoguard-badge">${badgeText}</span>
        <strong>EchoGuard:</strong> ${message}${keywordCounter}
        ${learnMoreHtml}
      </div>
      <button class="echoguard-close" aria-label="Close banner">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="echoguard-timer"></div>
    </div>
  `;
  
  // Add the banner to the page
  document.body.insertBefore(banner, document.body.firstChild);
  
  // Start the timer animation
  setTimeout(() => {
    const timer = banner.querySelector('.echoguard-timer');
    if (timer) {
      timer.style.width = '0';
    }
  }, 50);
  
  // Add event listener to close button
  const closeButton = banner.querySelector('.echoguard-close');
  closeButton.addEventListener('click', function() {
    banner.style.opacity = '0';
    banner.style.transform = 'translateY(-100%)';
    banner.style.transition = 'opacity 0.3s ease, transform 0.5s ease';
    setTimeout(() => banner.remove(), 500);
  });
  
  // Set auto-dismiss after 30 seconds
  setTimeout(() => {
    if (banner && banner.parentNode) {
      banner.style.opacity = '0';
      banner.style.transform = 'translateY(-100%)';
      banner.style.transition = 'opacity 0.3s ease, transform 0.5s ease';
      setTimeout(() => banner.remove(), 500);
    }
  }, 30000);
}

// Listen for messages from the popup and background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // Respond to ping to verify the content script is loaded
  if (request.action === "ping") {
    sendResponse({ pong: true, timestamp: new Date().toISOString() });
    return true;
  }
  
  // Return analysis results
  if (request.action === "getAnalysis") {
    // If analysis is stuck, return what we have so far
    if (isAnalyzing && analysisResults.credibility) {
      const tempResults = {
        ...analysisResults,
        analyzed: true, // Force it to be considered analyzed
        emotion: analysisResults.emotion || { keywordCount: 0, level: "low" }
      };
      sendResponse(tempResults);
    } else {
      sendResponse(analysisResults);
    }
    return true;
  }
  
  // Run a new analysis
  if (request.action === "runAnalysis") {
    console.log("EchoGuard: Received runAnalysis request");
    
    // Force a new analysis (for the refresh button)
    if (isAnalyzing) {
      // If already analyzing, cancel it and start fresh
      console.log("EchoGuard: Canceling in-progress analysis to start fresh");
      isAnalyzing = false;
      if (analysisTimeout) {
        clearTimeout(analysisTimeout);
        analysisTimeout = null;
      }
    }
    
    // Reset analysis results to indicate we're starting fresh
    analysisResults = {
      analyzed: false,
      credibility: null,
      emotion: null,
      timestamp: new Date().toISOString()
    };
    
    // Start analysis with a slight delay to allow for response
    setTimeout(analyzePageContentWithAI, 50);
    
    // Send immediate response to prevent timeout
    sendResponse({ 
      status: "Analysis started", 
      timestamp: analysisResults.timestamp 
    });
    return true;
  }
  
  return true; // Keep the message channel open for async responses
});

// Ensure initialize is called
initialize(); 