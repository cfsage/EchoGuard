# EchoGuard - AI Canary for Information Authenticity

EchoGuard is a browser extension designed to help users identify potentially misleading online content. It serves as an "AI Canary" for information authenticity by analyzing web pages for unreliable sources and emotionally manipulative language.

## Features

- **Source Credibility Check**: Flags websites from a database of known unreliable sources
- **Emotional Language Detection**: Identifies content with highly emotional or manipulative language
- **Clear Visual Warnings**: Provides unobtrusive but clear warnings at the top of web pages
- **Detailed Analysis via Popup**: Access more detailed analysis through the browser toolbar popup

## Installation (Development)

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/echoguard.git
   cd echoguard
   ```

2. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the directory containing the extension files

3. (Optional) Run the backend server:
   ```
   pip install -r requirements.txt
   python server.py
   ```

## How It Works

1. When you visit a web page, EchoGuard automatically:
   - Checks if the domain is in a list of known unreliable sources
   - Analyzes the text content for emotional/manipulative language patterns
   - Displays a warning banner if potential issues are detected

2. The extension icon in your browser toolbar shows the current site's analysis:
   - Green: No issues detected
   - Yellow: Some concerning patterns (e.g., emotional language)
   - Red: Source is flagged as potentially unreliable

3. Click the extension icon for more detailed analysis and explanation.

## Future Enhancements (Post-Hackathon)

- **Full Vertex AI Integration**: Replace simple keyword analysis with more sophisticated AI models
- **User Feedback Loop**: Allow users to report false positives/negatives
- **Expanded Database**: Continuous updates to the database of unreliable sources
- **Custom Sensitivity Settings**: Adjust warning thresholds based on user preferences
- **Cross-Browser Support**: Expand beyond Chrome to Firefox, Safari, etc.

## Project Structure

- `manifest.json`: Chrome extension configuration
- `content.js`: Main script that runs on each web page
- `popup.html` & `popup.js`: Extension popup UI and functionality
- `server.py`: Backend server (mockup for the hackathon)
- `icon128.png`: Extension icon

## Technology Stack

- **Frontend**: JavaScript, HTML, CSS
- **Backend**: Python, Flask
- **AI (Future)**: Google Vertex AI

## Hackathon Information

This project was developed for the security hackathon focused on the theme of "(In)security" as a solution to help users feel more secure about the information they consume online.

## License

MIT 