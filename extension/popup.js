// Initialize popup
document.addEventListener('DOMContentLoaded', function() {
  const analyzeBtn = document.getElementById('analyze-button');
  const autoToggle = document.getElementById('autoToggle');
  const aboutToggle = document.getElementById('about-toggle');
  const aboutContent = document.getElementById('about-content');
  const aboutToggleIcon = document.querySelector('.about-toggle');
  const pageUrlDisplay = document.getElementById('pageUrl');
  const viewTermsLink = document.getElementById('viewTermsLink');
  const helpLink = document.querySelector('.footer-links a[href*="help"]');
  const reportLink = document.getElementById('reportLink');
  const settingsBtn = document.getElementById('settingsBtn');
  const statusBox = document.getElementById('status-box');
  const urlDisplay = document.getElementById('url-display');
  const autoToggleInput = document.getElementById('auto-toggle-input');
  
  // Force initial visibility
  if (aboutContent) {
    // Remove the collapsed class to make it visible initially
    aboutContent.classList.remove('collapsed');
    console.log('Ensuring about section is visible');
    
    // Also make sure the style is correct
    aboutContent.style.maxHeight = '500px';
    aboutContent.style.padding = '12px 0';
    aboutContent.style.visibility = 'visible';
  }
  
  // Set initial states
  let isLoading = false;
  let currentTab = null;
  let analysisTimestamp = null;
  let retryCount = 0;
  const MAX_RETRIES = 3;
  const pendingAnalyses = new Map(); // Local mapping for tracking analysis status
  
  // Initialize UI elements
  initializeUI();
  
  // Get current tab and update UI
  getCurrentTab()
    .then(tab => {
      currentTab = tab;
      displayCurrentUrl(tab);
      checkContentScriptStatus();
    })
    .catch(error => {
      console.error("Error getting current tab:", error);
      showError("Could not access current tab. Please try again.");
    });
  
  // Set initial collapsible state (closed)
  aboutToggle.addEventListener('click', function() {
    console.log('About toggle clicked');
    if (aboutContent) {
      aboutContent.classList.toggle('collapsed');
      const isCollapsed = aboutContent.classList.contains('collapsed');
      
      // Update the arrow based on collapsed state
      const downArrow = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
      const upArrow = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`;
      
      const arrowToUse = isCollapsed ? downArrow : upArrow;
      aboutToggle.innerHTML = `About EchoGuard <span class="toggle-icon">${arrowToUse}</span>`;
      
      // Save the user preference
      chrome.storage.sync.set({ aboutCollapsed: isCollapsed });
    } else {
      console.error('About content element not found');
    }
  });
  
  // Set initial loading state
  showLoading();
  
  // Setup event handlers
  helpLink.addEventListener('click', function(e) {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  });
  
  reportLink.addEventListener('click', function(e) {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/echoguard/extension/issues/new' });
  });
  
  viewTermsLink.addEventListener('click', function() {
    // In a more advanced version, this would show a modal with detected terms
    alert('Feature coming soon: Highlighting detected emotional terms on the page');
  });
  
  settingsBtn.addEventListener('click', function() {
    // In a more advanced version, this would open a settings page
    alert('Settings panel will be available in the next update');
  });
  
  // Handle Auto-mode toggle
  autoToggle.addEventListener('change', function() {
    chrome.storage.local.set({ autoAnalysis: this.checked });
    
    // Reflect the change in button prominence
    if (this.checked) {
      analyzeBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
        Refresh Analysis`;
    } else {
      analyzeBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        Analyze Page`;
    }
  });
  
  // Load saved auto mode setting
  chrome.storage.local.get(['autoAnalysis'], function(result) {
    if (result.autoAnalysis === undefined) {
      // Default to true if not set
      chrome.storage.local.set({ autoAnalysis: true });
      autoToggle.checked = true;
    } else {
      autoToggle.checked = result.autoAnalysis;
    }
  });
  
  // Event Listeners for Refresh Analysis button
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', function() {
      console.log('Refresh Analysis button clicked');
      if (isLoading) return; // Prevent multiple clicks while loading
      
      setLoadingState(true);
      retryCount = 0;
      runAnalysis();
    });
  } else {
    console.error('Refresh Analysis button not found in the DOM');
  }
  
  autoToggleInput.addEventListener('change', function() {
    // Save the auto mode preference
    chrome.storage.sync.set({ autoMode: autoToggleInput.checked }, function() {
      console.log('Auto mode set to:', autoToggleInput.checked);
      
      // Send message to background to update auto mode
      chrome.runtime.sendMessage({
        action: "updateAutoMode",
        enabled: autoToggleInput.checked
      });
      
      // If turning on auto mode, run analysis immediately
      if (autoToggleInput.checked) {
        setLoadingState(true);
        runAnalysis();
      }
    });
  });
  
  // Initialize the UI with user preferences
  function initializeUI() {
    // Make sure the about section is visible initially
    if (aboutContent) {
      // Default to expanded
      chrome.storage.sync.get(['aboutCollapsed'], function(result) {
        const isCollapsed = result.aboutCollapsed === true; // Default to false (expanded) if not explicitly set
        if (aboutToggle) { // Ensure aboutToggle exists
            aboutContent.classList.toggle('collapsed', isCollapsed);
            const arrowSvg = isCollapsed ? 
                `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>` : 
                `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`;
            aboutToggle.innerHTML = `About EchoGuard <span class="toggle-icon">${arrowSvg}</span>`;
        }
      });
    }
    
    // Load other preferences
    chrome.storage.sync.get(['autoMode'], function(result) {
      // Set the auto toggle state
      if (autoToggleInput) {
        autoToggleInput.checked = result.autoMode !== false; // Default to true
      }
    });
  }
  
  // Helper function to get the current active tab
  function getCurrentTab() {
    return new Promise((resolve, reject) => {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
          if (tabs && tabs.length > 0) {
            resolve(tabs[0]);
          } else {
            reject(new Error("No active tab found"));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Display the current tab's URL in the popup
  function displayCurrentUrl(tab) {
    if (!tab || !tab.url) {
      urlDisplay.textContent = "No URL available";
      analyzeBtn.disabled = true;
      return;
    }
    
    try {
      const url = new URL(tab.url);
      
      // Check if we're on a webpage we can analyze
      if (url.protocol.startsWith('http')) {
        urlDisplay.textContent = url.hostname;
        urlDisplay.title = tab.url; // Full URL on hover
        analyzeBtn.disabled = false;
      } else {
        // Not a webpage we can analyze
        urlDisplay.textContent = "Non-webpage: " + url.protocol;
        analyzeBtn.disabled = true;
        showError("EchoGuard only works on webpages (http/https)");
      }
    } catch (error) {
      console.error("Error parsing URL:", error);
      urlDisplay.textContent = "Invalid URL";
      analyzeBtn.disabled = true;
    }
  }
  
  // Set the loading state of the UI
  function setLoadingState(loading) {
    isLoading = loading;
    
    if (!analyzeBtn) {
      console.error("Can't find analyze button to update state");
      return;
    }
    
    if (loading) {
      // Update button to show loading state
      analyzeBtn.innerHTML = `
        <svg class="spin-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
        </svg>
        <span>Analyzing...</span>`;
      analyzeBtn.disabled = true;
      analyzeBtn.classList.add('analyzing');
      
      // Update status box to show loading
      if (statusBox) {
        statusBox.innerHTML = `
          <div class="status-item">
            <div class="loading-indicator analyzing"></div>
            <span>Analyzing page content...</span>
          </div>`;
      }
    } else {
      // Restore button to normal state
      analyzeBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 2v6h-6"></path>
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
          <path d="M3 12a9 9 0 0 0 6 8.5l1-2.5"></path>
        </svg>
        <span>Refresh Analysis</span>`;
      analyzeBtn.disabled = false;
      analyzeBtn.classList.remove('analyzing');
    }
  }
  
  // Check if the content script is loaded and ping it
  function checkContentScriptStatus() {
    if (!currentTab || !currentTab.id) {
      showError("Cannot access the current tab");
      return;
    }
    
    // Try to ping the content script
    chrome.tabs.sendMessage(
      currentTab.id,
      { action: "ping" },
      function(response) {
        const lastError = chrome.runtime.lastError;
        
        if (lastError || !response || !response.pong) {
          console.log("Content script not loaded:", lastError ? lastError.message : "No response");
          
          // Request the background script to inject the content script
          chrome.runtime.sendMessage(
            { action: "injectContentScript", tabId: currentTab.id },
            function(injectionResponse) {
              if (chrome.runtime.lastError) {
                console.error("Error injecting content script:", chrome.runtime.lastError);
                showError("Could not analyze page. Try refreshing.");
              } else {
                console.log("Content script injection response:", injectionResponse);
                // Wait a bit for the content script to initialize
                setTimeout(function() {
                  // If auto mode is enabled, run analysis after injection
                  chrome.storage.sync.get(['autoMode'], function(result) {
                    if (result.autoMode !== false) {
                      setLoadingState(true);
                      runAnalysis();
                    } else {
                      setLoadingState(false);
                      updateAnalysisStatus({ analyzed: false });
                    }
                  });
                }, 300);
              }
            }
          );
        } else {
          console.log("Content script is loaded, ping response:", response);
          // Get analysis results if the script is loaded
          requestAnalysisResults();
        }
      }
    );
  }
  
  // Request analysis results from the content script
  function requestAnalysisResults() {
    if (!currentTab || !currentTab.id) {
      setLoadingState(false);
      showError("Cannot access the current tab");
      return;
    }
    
    try {
      chrome.tabs.sendMessage(
        currentTab.id,
        { action: "getAnalysis" },
        function(results) {
          const lastError = chrome.runtime.lastError;
          
          if (lastError) {
            console.error("Error getting analysis:", lastError);
            setLoadingState(false);
            showError("Error communicating with the page");
            return;
          }
          
          if (!results) {
            console.log("No analysis results received");
            setLoadingState(false);
            showError("No analysis results available");
            return;
          }
          
          if (!results.timestamp) {
            console.log("Invalid analysis results received (no timestamp)");
            
            // If auto mode is on, trigger a fresh analysis
            chrome.storage.sync.get(['autoMode'], function(result) {
              if (result.autoMode !== false) {
                runAnalysis();
              } else {
                setLoadingState(false);
                updateAnalysisStatus({ analyzed: false });
              }
            });
            return;
          }
          
          // We have results!
          console.log("Analysis results:", results);
          
          // Check if the results timestamp changed
          if (analysisTimestamp !== results.timestamp) {
            analysisTimestamp = results.timestamp;
            updateAnalysisStatus(results);
          }
          
          // If analysis is not complete and we're in a loading state, wait and check again
          if ((!results.analyzed || !results.emotion) && isLoading) {
            // If we've waited too long, force a refresh
            if (retryCount++ < MAX_RETRIES) {
              console.log(`Analysis incomplete, retrying (${retryCount}/${MAX_RETRIES})...`);
              setTimeout(requestAnalysisResults, 1000);
            } else {
              console.log("Max retries reached, forcing refresh");
              runAnalysis(); // Force a new analysis
            }
          } else {
            setLoadingState(false);
          }
        }
      );
    } catch (error) {
      console.error("Exception requesting analysis results:", error);
      setLoadingState(false);
      showError("An error occurred while retrieving analysis results");
    }
  }
  
  // Run a new analysis
  function runAnalysis() {
    console.log("Running analysis...");
    if (!currentTab || !currentTab.id) {
      setLoadingState(false);
      showError("Cannot access the current tab");
      return;
    }
    
    retryCount = 0;
    console.log("Requesting new analysis for tab:", currentTab.id);
    
    // Track that we have a pending analysis
    pendingAnalyses.set(currentTab.id, Date.now());
    
    try {
      // Send the runAnalysis message to the content script
      chrome.tabs.sendMessage(
        currentTab.id,
        { action: "runAnalysis" },
        function(response) {
          const lastError = chrome.runtime.lastError;
          
          if (lastError) {
            console.error("Error starting analysis:", lastError);
            
            // Try to inject the content script if communication failed
            chrome.runtime.sendMessage(
              { action: "injectContentScript", tabId: currentTab.id },
              function(injectionResponse) {
                if (chrome.runtime.lastError) {
                  console.error("Error injecting content script:", chrome.runtime.lastError);
                  setLoadingState(false);
                  showError("Could not analyze page. Try refreshing the page.");
                } else {
                  console.log("Content script injected, waiting before retrying analysis");
                  setTimeout(function() {
                    // Try again after injecting the content script
                    chrome.tabs.sendMessage(
                      currentTab.id,
                      { action: "runAnalysis" },
                      function(retryResponse) {
                        if (chrome.runtime.lastError) {
                          console.error("Error in retry:", chrome.runtime.lastError);
                          setLoadingState(false);
                          showError("Analysis failed. Please refresh the page and try again.");
                        } else {
                          console.log("Analysis retry succeeded:", retryResponse);
                          setTimeout(requestAnalysisResults, 1000);
                        }
                      }
                    );
                  }, 500);
                }
              }
            );
            return;
          }
          
          console.log("Analysis started:", response);
          
          // Wait before checking for results
          setTimeout(requestAnalysisResults, 1000);
        }
      );
    } catch (error) {
      console.error("Exception during analysis:", error);
      setLoadingState(false);
      showError("An error occurred while analyzing the page");
    }
  }
  
  // Update the analysis status display
  function updateAnalysisStatus(results) {
    if (!statusBox) {
        console.error("Status box not found!");
        return;
    }

    if (!results) {
      statusBox.innerHTML = `
        <div class="status-item">
          <div class="status-content not-analyzed">
            <span>No analysis data available</span>
          </div>
        </div>
      `;
      return;
    }
    
    const { 
        credibility, 
        emotion, 
        error, 
        timedOut, 
        timestamp, 
        aiSummary, 
        apiStatus,
        metadata 
    } = results;

    let statusHTML = '';

    // AI Summary Section (if available)
    if (aiSummary) {
        statusHTML += `
            <div class="status-item">
                <div class="status-heading">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                    AI Analysis Summary
                </div>
                <div class="status-content">
                    <span>${aiSummary}</span>
                </div>
            </div>
        `;
    }

    // Source credibility section
    if (credibility) {
      const domain = credibility.domain || "unknown";
      const isUntrusted = credibility.isUntrusted || false;
      
      statusHTML += `
        <div class="status-item">
          <div class="status-heading">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            Source Credibility
          </div>
          <div class="status-content ${isUntrusted ? 'untrusted' : 'trusted'}">
            <span>
              <strong>${domain}</strong>: 
              ${isUntrusted 
                ? (credibility.aiAnalysis && credibility.aiAnalysis.summary ? credibility.aiAnalysis.summary : 'This source has been flagged as potentially unreliable.') 
                : 'No credibility issues detected with this source.'}
            </span>
          </div>
        </div>
      `;
    } else {
      statusHTML += `
        <div class="status-item">
          <div class="status-heading">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            Source Credibility
          </div>
          <div class="status-content not-analyzed">
            <span>Unable to analyze source credibility</span>
          </div>
        </div>
      `;
    }
    
    // Emotional language / AI Text Analysis section
    if (emotion) {
      const level = emotion.level || "unknown";
      const keywordCount = emotion.keywordCount || 0;
      const foundKeywords = emotion.foundKeywords || [];
      const aiAnalysis = emotion.aiAnalysis; // This is the new AI part

      let emotionStatus = '';
      let emotionClass = '';
      let badgeHTML = '';
      let aiDetailsHTML = '';

      if (aiAnalysis) {
        // Display AI-driven analysis
        emotionStatus = `AI analysis detected.`;
        emotionClass = aiAnalysis.credibility_score < 0.5 ? 'high-emotion' : (aiAnalysis.sentiment.score < -0.2 ? 'medium-emotion' : 'low-emotion');
        badgeHTML = `<span class="badge ${aiAnalysis.credibility_score < 0.4 ? 'badge-high' : (aiAnalysis.credibility_score < 0.7 ? 'badge-medium' : 'badge-low')}">AI</span>`;
        
        aiDetailsHTML += `<div class="found-keywords"><strong>Sentiment:</strong> ${aiAnalysis.sentiment.score.toFixed(2)} (Magnitude: ${aiAnalysis.sentiment.magnitude.toFixed(2)})<br>`;
        if (aiAnalysis.propaganda_techniques && aiAnalysis.propaganda_techniques.length > 0) {
            aiDetailsHTML += `<strong>Techniques:</strong> ${aiAnalysis.propaganda_techniques.map(pt => pt.technique).join(', ')}<br>`;
        }
        if (aiAnalysis.topic_classification) {
            aiDetailsHTML += `<strong>Topic:</strong> ${aiAnalysis.topic_classification.primary_topic}<br>`;
        }
        aiDetailsHTML += `<strong>AI Credibility Score:</strong> ${aiAnalysis.credibility_score.toFixed(2)}</div>`;

      } else {
        // Fallback to keyword-based analysis
        if (level === "high") {
          emotionStatus = `This content contains highly emotional language with ${keywordCount} trigger words detected.`;
          emotionClass = 'high-emotion';
          badgeHTML = '<span class="badge badge-high">HIGH</span>';
        } else if (level === "medium") {
          emotionStatus = `This content contains moderate emotional language with ${keywordCount} trigger words.`;
          emotionClass = 'medium-emotion';
          badgeHTML = '<span class="badge badge-medium">MEDIUM</span>';
        } else if (level === "low") {
          emotionStatus = `Low emotional content detected (${keywordCount} trigger words).`;
          emotionClass = 'low-emotion';
          badgeHTML = '<span class="badge badge-low">LOW</span>';
        } else {
          emotionStatus = `Unable to determine emotional content level.`;
          emotionClass = 'unknown-emotion';
        }
        if (foundKeywords && foundKeywords.length > 0) {
          aiDetailsHTML = formatKeywords(foundKeywords); // Existing keyword formatting
        }
      }
      
      statusHTML += `
        <div class="status-item">
          <div class="status-heading">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><circle cx="9" cy="9" r="1"></circle><circle cx="15" cy="9" r="1"></circle><circle cx="12" cy="12" r="10"></circle></svg>
            Content Analysis ${badgeHTML}
          </div>
          <div class="status-content ${emotionClass}">
            <span>${emotionStatus}</span>
          </div>
          ${aiDetailsHTML}
        </div>
      `;
    } else if (timedOut) {
      statusHTML += `
        <div class="status-item">
          <div class="status-heading">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><circle cx="9" cy="9" r="1"></circle><circle cx="15" cy="9" r="1"></circle><circle cx="12" cy="12" r="10"></circle></svg>
            Content Analysis
          </div>
          <div class="status-content not-analyzed">
            <span>Analysis timed out. Try refreshing.</span>
          </div>
        </div>
      `;
    } else if (error) {
      statusHTML += `
        <div class="status-item">
          <div class="status-heading">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><circle cx="9" cy="9" r="1"></circle><circle cx="15" cy="9" r="1"></circle><circle cx="12" cy="12" r="10"></circle></svg>
            Content Analysis
          </div>
          <div class="status-content error">
            <span>Error during analysis: ${error}</span>
          </div>
        </div>
      `;
    } else if (isLoading) {
       // This state is usually handled by setLoadingState, but as a fallback
      statusHTML += `
        <div class="status-item">
          <div class="status-heading">
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><circle cx="9" cy="9" r="1"></circle><circle cx="15" cy="9" r="1"></circle><circle cx="12" cy="12" r="10"></circle></svg>
            Content Analysis
          </div>
          <div class="status-content">
            <div class="loading-indicator analyzing"></div>
            <span>Analyzing content...</span>
          </div>
        </div>
      `;
    } else {
      statusHTML += `
        <div class="status-item">
          <div class="status-heading">
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><circle cx="9" cy="9" r="1"></circle><circle cx="15" cy="9" r="1"></circle><circle cx="12" cy="12" r="10"></circle></svg>
            Content Analysis
          </div>
          <div class="status-content not-analyzed">
            <span>Content not yet analyzed. Click "Refresh Analysis".</span>
          </div>
        </div>
      `;
    }

    // API Status section (if applicable)
    if (apiStatus) {
        let apiMessage = '';
        let apiClass = 'not-analyzed'; // Default class
        if (apiStatus === 'success') {
            apiMessage = 'AI analysis completed successfully via API.';
            apiClass = 'trusted';
        } else if (apiStatus === 'error') {
            apiMessage = 'AI analysis API call failed. Using fallback.';
            apiClass = 'error';
        } else if (apiStatus === 'timeout') {
            apiMessage = 'AI analysis API call timed out. Using fallback.';
            apiClass = 'warning'; // Or another appropriate class
        }
        
        if (apiMessage) {
            statusHTML += `
                <div class="status-item">
                    <div class="status-heading">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line></svg>
                        AI Service Status
                    </div>
                    <div class="status-content ${apiClass}">
                        <span>${apiMessage}</span>
                    </div>
                </div>
            `;
        }
    }
    
    // Add a timestamp if available
    if (timestamp) {
      const timeString = formatTimeDiff(timestamp);
      statusHTML += `<div class="status-timestamp">Last analyzed: ${timeString}</div>`;
    } else {
      statusHTML += `<div class="status-timestamp">Analysis pending...</div>`;
    }
    
    statusBox.innerHTML = statusHTML;
  }
  
  // Show an error message
  function showError(message) {
    statusBox.innerHTML = `
      <div class="status-item error-message">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <span>${message}</span>
      </div>
    `;
    setLoadingState(false);
  }
});

// Show loading state in all sections
function showLoading() {
  document.getElementById('sourceContent').innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; padding: 10px;">
      <div class="loading-spinner"></div>
    </div>`;
  document.getElementById('sourceBadge').innerText = "ANALYZING";
  document.getElementById('sourceBadge').className = "analysis-badge badge-neutral";
  
  document.getElementById('emotionContent').innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; padding: 10px;">
      <div class="loading-spinner"></div>
    </div>`;
  document.getElementById('emotionBadge').innerText = "ANALYZING";
  document.getElementById('emotionBadge').className = "analysis-badge badge-neutral";
}

// Show not yet analyzed state
function showNotAnalyzedState() {
  updateSourceSection({
    isUntrusted: false,
    domain: "pending"
  }, "WAITING");
  
  updateEmotionSection({
    keywordCount: 0,
    level: "unknown"
  }, "WAITING");
}

// Update the analysis display based on results
function updateAnalysisDisplay(analysis) {
  // Update source credibility section
  if (analysis.credibility) {
    updateSourceSection(analysis.credibility);
  }
  
  // Update emotional language section
  if (analysis.emotion) {
    updateEmotionSection(analysis.emotion);
  }
}

// Update the source credibility section
function updateSourceSection(credibility, overrideStatus) {
  const sourceSection = document.getElementById('sourceSection');
  const sourceBadge = document.getElementById('sourceBadge');
  const sourceContent = document.getElementById('sourceContent');
  
  // Remove any existing status classes
  sourceSection.className = 'analysis-section source';
  
  let badgeText = '';
  let badgeClass = '';
  let message = '';
  
  if (overrideStatus) {
    badgeText = overrideStatus;
    badgeClass = 'badge-neutral';
    message = 'Unable to analyze this page type.';
  } else if (credibility.isUntrusted) {
    badgeText = 'UNRELIABLE';
    badgeClass = 'badge-danger';
    sourceSection.className = 'analysis-section danger';
    message = `<strong>Warning:</strong> The domain <code>${credibility.domain}</code> has been flagged as potentially unreliable. Consider verifying information with additional sources.`;
  } else {
    badgeText = 'TRUSTED';
    badgeClass = 'badge-ok';
    message = `This source (${credibility.domain}) has not been flagged in our database of unreliable domains.`;
  }
  
  // Update badge
  sourceBadge.innerText = badgeText;
  sourceBadge.className = `analysis-badge ${badgeClass}`;
  
  // Update content
  sourceContent.innerHTML = message;
}

// Update the emotional language section
function updateEmotionSection(emotion, overrideStatus) {
  const emotionSection = document.getElementById('emotionSection');
  const emotionBadge = document.getElementById('emotionBadge');
  const emotionContent = document.getElementById('emotionContent');
  const viewTermsLink = document.getElementById('viewTermsLink');
  
  // Remove any existing status classes
  emotionSection.className = 'analysis-section warning';
  
  let badgeText = '';
  let badgeClass = '';
  let message = '';
  
  if (overrideStatus) {
    badgeText = overrideStatus;
    badgeClass = 'badge-neutral';
    message = 'Unable to analyze emotional language on this page.';
    viewTermsLink.style.display = 'none';
  } else {
    switch(emotion.level) {
      case 'high':
        badgeText = 'HIGH';
        badgeClass = 'badge-danger';
        emotionSection.className = 'analysis-section danger';
        message = `<strong>Caution:</strong> This content contains highly emotional language (${emotion.keywordCount} emotional terms detected). This may be used to manipulate reader perception.`;
        break;
      case 'medium':
        badgeText = 'MODERATE';
        badgeClass = 'badge-warning';
        message = `<strong>Notice:</strong> This content contains some emotional language (${emotion.keywordCount} emotional terms detected). Consider whether this affects objectivity.`;
        break;
      case 'low':
        badgeText = 'LOW';
        badgeClass = 'badge-ok';
        emotionSection.className = 'analysis-section source';
        message = 'No significant emotional manipulation detected. Content appears to be relatively neutral in tone.';
        break;
      default:
        badgeText = 'UNKNOWN';
        badgeClass = 'badge-neutral';
        message = 'Unable to determine emotional content level.';
    }
    
    // Only show the view terms link if we detected emotional terms
    if (emotion.keywordCount > 0) {
      viewTermsLink.style.display = 'block';
    } else {
      viewTermsLink.style.display = 'none';
    }
  }
  
  // Update badge
  emotionBadge.innerText = badgeText;
  emotionBadge.className = `analysis-badge ${badgeClass}`;
  
  // Update content
  emotionContent.innerHTML = message;
  
  // Append the view terms link back (it was removed by the innerHTML assignment)
  if (emotion.keywordCount > 0) {
    emotionContent.appendChild(viewTermsLink);
  }
}

// Display error message in analysis sections
function showAnalysisError(errorMsg) {
  document.getElementById('sourceContent').innerHTML = `
    <div style="color: #d63031;">${errorMsg}</div>`;
  document.getElementById('sourceBadge').innerText = "ERROR";
  document.getElementById('sourceBadge').className = "analysis-badge badge-danger";
  
  document.getElementById('emotionContent').innerHTML = `
    <div style="color: #d63031;">${errorMsg}</div>`;
  document.getElementById('emotionBadge').innerText = "ERROR";
  document.getElementById('emotionBadge').className = "analysis-badge badge-danger";
}

// Format keywords into HTML tags with categories
function formatKeywords(keywords = []) {
  if (!keywords || keywords.length === 0) return '';
  
  const uniqueKeywords = [...new Set(keywords.map(kw => typeof kw === 'string' ? kw : kw.term || ''))].filter(Boolean); // Ensure items are strings and filter out empty ones
  const displayKeywords = uniqueKeywords.slice(0, 10); // Limit to 10 keywords
  
  const tagsHtml = displayKeywords.map(keyword => 
    `<span class="keyword-tag emotion">${keyword}</span>` // Assuming 'emotion' class for now
  ).join('');
  
  const moreCount = uniqueKeywords.length - displayKeywords.length;
  const moreText = moreCount > 0 ? `<span class="keyword-counter">+${moreCount}</span>` : '';
  
  return `<div class="found-keywords">${tagsHtml}${moreText}</div>`;
}

// Format time difference with improved human-readability
function formatTimeDiff(timestamp) {
  if (!timestamp) return 'N/A';
  
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now - time;
  const diffSec = Math.round(diffMs / 1000);
  
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec} seconds ago`;
  
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  
  return time.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Function to check if the analysis has completed
function checkAnalysisCompletion(tabId, callback = null) {
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
    
    // Update UI to show timeout
    setLoadingState(false);
    statusBox.innerHTML = `
      <div class="status-item">
        <div class="status-icon error">!</div>
        <span class="error">Analysis timed out. Please try again.</span>
      </div>`;
    
    if (callback) callback({ 
      success: false, 
      status: "timeout", 
      message: "Analysis timed out" 
    });
    return;
  }
  
  // Continue checking status
  requestAnalysisResults();
} 