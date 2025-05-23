// Background script for EchoGuard
// Automatically triggers analysis when a new page is loaded

// Keeps track of tabs that have been analyzed in this session
const analyzedTabs = new Set();
// Tracks pending analyses with their timestamps
const pendingAnalyses = new Map();
// Store user preferences
let userPreferences = {
  autoMode: true // Default to auto mode enabled
};

// Load saved preferences
chrome.storage.sync.get(['autoMode'], function(result) {
  userPreferences.autoMode = result.autoMode !== false; // Default to true if not set
  console.log('Auto mode loaded:', userPreferences.autoMode);
});

// Listen for installation or update
chrome.runtime.onInstalled.addListener(function(details) {
  console.log("EchoGuard Extension installed/updated", details.reason);
  
  // Set default preferences if not already set
  chrome.storage.sync.get(['autoMode', 'aboutCollapsed'], function(result) {
    if (result.autoMode === undefined) {
      chrome.storage.sync.set({ autoMode: true });
    }
    
    if (result.aboutCollapsed === undefined) {
      chrome.storage.sync.set({ aboutCollapsed: true });
    }
  });
  
  // Open welcome page on install (not on update)
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }
});

// Listen for tab updates (URL changes)
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  // Only process when the page is done loading and it's a valid webpage (http/https)
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    // Check if auto mode is enabled
    if (userPreferences.autoMode) {
      console.log(`Tab ${tabId} completed loading, preparing to analyze`);
      // Add a small delay to ensure the page is properly loaded
      setTimeout(() => {
        injectContentScriptIfNeeded(tabId, tab.url);
      }, 500);
    }
  }
});

// Listen for messages from the popup or content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("Background received message:", request.action);
  
  if (request.action === "updateAutoMode") {
    userPreferences.autoMode = request.enabled;
    console.log("Auto mode updated to:", userPreferences.autoMode);
    sendResponse({ success: true });
    return true;
  }
  
  // Handle requests to inject the content script
  if (request.action === "injectContentScript") {
    const tabId = request.tabId;
    
    if (!tabId) {
      sendResponse({ success: false, error: "No tab ID provided" });
      return true;
    }
    
    chrome.tabs.get(tabId, function(tab) {
      if (chrome.runtime.lastError) {
        console.error("Error getting tab:", chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      
      if (!tab || !tab.url || !tab.url.startsWith('http')) {
        sendResponse({ success: false, error: "Invalid tab or URL" });
        return;
      }
      
      injectContentScriptIfNeeded(tabId, tab.url, function(result) {
        sendResponse(result);
      });
    });
    
    return true; // Keep the message channel open for async response
  }
  
  // Force-analyze a tab (from popup)
  if (request.action === "forceAnalysis" || request.action === "runAnalysis") {
    const tabId = request.tabId || (sender.tab && sender.tab.id);
    
    if (!tabId) {
      sendResponse({ success: false, error: "No tab ID provided" });
      return true;
    }
    
    triggerAnalysisInTab(tabId, function(result) {
      sendResponse(result);
    });
    
    return true; // Keep the message channel open for async response
  }
  
  // Check analysis status for a tab
  if (request.action === "checkAnalysisStatus") {
    const tabId = request.tabId;
    
    if (!tabId) {
      sendResponse({ success: false, error: "No tab ID provided" });
      return true;
    }
    
    checkAnalysisCompletion(tabId, function(result) {
      sendResponse(result);
    });
    
    return true; // Keep the message channel open for async response
  }
  
  // Open a popup page
  if (request.action === "openPopup") {
    try {
      chrome.windows.create({
        url: request.url || chrome.runtime.getURL('welcome.html'),
        type: 'popup',
        width: 800,
        height: 600
      });
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
  
  return false;
});

// Helper function to check if the content script is loaded and inject it if needed
function injectContentScriptIfNeeded(tabId, url, callback = null) {
  console.log(`Checking if content script needs to be injected for tab ${tabId}`);
  
  // Save the timestamp when starting the injection/analysis process
  pendingAnalyses.set(tabId, Date.now());
  
  // Clear any existing badge
  chrome.action.setBadgeText({ text: "" });
  
  // First, try to ping the content script to see if it's already loaded
  chrome.tabs.sendMessage(tabId, { action: "ping" }, function(response) {
    const lastError = chrome.runtime.lastError;
    
    // If we can't communicate with the content script, it needs to be injected
    if (lastError || !response || !response.pong) {
      console.log(`Content script not loaded in tab ${tabId}, injecting now`);
      
      // Set badge to "..."
      chrome.action.setBadgeText({ text: "..." });
      chrome.action.setBadgeBackgroundColor({ color: "#757575" });
      
      // Execute the content script
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }).then(() => {
        console.log(`Content script injected into tab ${tabId}`);
        
        // Check if the URL has changed during injection
        chrome.tabs.get(tabId, function(tab) {
          if (chrome.runtime.lastError) {
            console.error("Error getting tab:", chrome.runtime.lastError);
            if (callback) callback({ success: false, error: chrome.runtime.lastError.message });
            return;
          }
          
          if (tab.url !== url) {
            console.log(`Tab URL changed during injection, was ${url}, now ${tab.url}`);
            if (callback) callback({ success: false, error: "URL changed during injection" });
            return;
          }
          
          // Wait briefly for the content script to initialize, then trigger analysis
          setTimeout(() => {
            triggerAnalysisInTab(tabId, callback);
          }, 300);
        });
      }).catch(error => {
        console.error(`Error injecting content script into tab ${tabId}:`, error);
        chrome.action.setBadgeText({ text: "!" });
        chrome.action.setBadgeBackgroundColor({ color: "#f44336" });
        if (callback) callback({ success: false, error: error.message || "Script injection failed" });
      });
    } else {
      // Content script is already loaded
      console.log(`Content script already loaded in tab ${tabId}`);
      triggerAnalysisInTab(tabId, callback);
    }
  });
  
  // Set a timeout to check if the analysis completed
  setTimeout(() => {
    checkAnalysisCompletion(tabId);
  }, 2000);
}

// Function to trigger the analysis in a tab
function triggerAnalysisInTab(tabId, callback = null) {
  console.log(`Triggering analysis in tab ${tabId}`);
  
  // Update the timestamp when triggering analysis
  pendingAnalyses.set(tabId, Date.now());
  
  // Set badge to indicate analyzing
  chrome.action.setBadgeText({ text: "..." });
  chrome.action.setBadgeBackgroundColor({ color: "#3d5afe" });
  
  chrome.tabs.sendMessage(tabId, { action: "runAnalysis" }, function(response) {
    const lastError = chrome.runtime.lastError;
    
    if (lastError) {
      console.error(`Error triggering analysis in tab ${tabId}:`, lastError);
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#f44336" });
      
      if (callback) callback({ 
        success: false, 
        error: lastError.message || "Failed to communicate with content script"
      });
      return;
    }
    
    console.log(`Analysis triggered in tab ${tabId}`, response);
    analyzedTabs.add(tabId);
    
    if (callback) callback({ 
      success: true, 
      message: "Analysis started", 
      timestamp: response && response.timestamp ? response.timestamp : new Date().toISOString()
    });
    
    // Check if the analysis completed after some time
    setTimeout(() => {
      checkAnalysisCompletion(tabId);
    }, 3000);
  });
}

// Function to check if the analysis has completed
function checkAnalysisCompletion(tabId, callback = null) {
  // Check if this tab is still being analyzed
  if (!pendingAnalyses.has(tabId)) {
    if (callback) callback({ success: true, status: "No pending analysis" });
    return;
  }
  
  const startTime = pendingAnalyses.get(tabId);
  const currentTime = Date.now();
  const elapsedSeconds = (currentTime - startTime) / 1000;
  
  // If more than 5 seconds have passed, consider it timed out
  if (elapsedSeconds > 5) {
    console.log(`Analysis in tab ${tabId} timed out after ${elapsedSeconds.toFixed(1)} seconds`);
    pendingAnalyses.delete(tabId);
    
    // Clear the badge or set to timeout
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#f44336" });
    
    if (callback) callback({ 
      success: false, 
      status: "timeout", 
      message: "Analysis timed out" 
    });
    return;
  }
  
  // Check the current status
  chrome.tabs.sendMessage(tabId, { action: "getAnalysis" }, function(results) {
    const lastError = chrome.runtime.lastError;
    
    if (lastError) {
      console.error(`Error checking analysis status for tab ${tabId}:`, lastError);
      
      if (callback) callback({ 
        success: false, 
        error: lastError.message || "Failed to communicate with content script" 
      });
      return;
    }
    
    // If we have results and they are marked as analyzed, the analysis is complete
    if (results && results.analyzed === true) {
      console.log(`Analysis completed successfully for tab ${tabId}`, results);
      pendingAnalyses.delete(tabId);
      
      // Update badge based on results
      updateBadgeForResults(tabId, results);
      
      if (callback) callback({ 
        success: true, 
        status: "complete", 
        results: results 
      });
    } else {
      console.log(`Analysis still in progress for tab ${tabId}`);
      
      if (callback) callback({ 
        success: true, 
        status: "in_progress", 
        partial: results || null
      });
      
      // Check again after a short delay if still within timeout
      if (elapsedSeconds < 5) {
        setTimeout(() => {
          checkAnalysisCompletion(tabId);
        }, 1000);
      }
    }
  });
}

// Update badge based on analysis results
function updateBadgeForResults(tabId, results) {
  if (!results) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }
  
  // Check if any warnings were found
  let badgeText = "";
  let badgeColor = "#4caf50"; // Default to green (OK)
  
  if (results.credibility && results.credibility.isUntrusted) {
    // If untrusted source, show red badge with "!"
    badgeText = "!";
    badgeColor = "#f44336"; // Red
  } else if (results.emotion && results.emotion.level === "high") {
    // If high emotional content, show yellow badge with warning indicator
    badgeText = "!";
    badgeColor = "#ffd600"; // Yellow
  } else if (results.emotion && results.emotion.level === "medium") {
    // If medium emotional content, show orange badge with moderate indicator
    badgeText = "•";
    badgeColor = "#ff9800"; // Orange
  } else if (results.timedOut) {
    // If analysis timed out
    badgeText = "?";
    badgeColor = "#9e9e9e"; // Gray
  } else if (results.analyzed) {
    // If analyzed successfully with no issues
    badgeText = "✓";
    badgeColor = "#4caf50"; // Green
  }
  
  // Set the badge
  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeBackgroundColor({ color: badgeColor });
}

// Listen for tab removal to clean up
chrome.tabs.onRemoved.addListener(function(tabId) {
  // Clean up when tabs are closed
  analyzedTabs.delete(tabId);
  pendingAnalyses.delete(tabId);
});

// Check for stalled analyses periodically
setInterval(() => {
  const currentTime = Date.now();
  
  pendingAnalyses.forEach((timestamp, tabId) => {
    const elapsedSeconds = (currentTime - timestamp) / 1000;
    
    if (elapsedSeconds > 8) {
      console.log(`Cleaning up stalled analysis for tab ${tabId} after ${elapsedSeconds.toFixed(1)} seconds`);
      pendingAnalyses.delete(tabId);
      
      // Clear the badge
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#f44336" });
    }
  });
}, 5000); 