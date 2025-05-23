from flask import Flask, request, jsonify
from flask_cors import CORS
import os

# Normally, we would import the Google Cloud libraries
# from google.cloud import aiplatform

app = Flask(__name__)
CORS(app)  # To allow cross-origin requests from the extension

@app.route('/analyze_text', methods=['POST'])
def analyze_text():
    """
    Endpoint that takes text content and analyzes it using Google Vertex AI.
    
    This is a mockup of how the real implementation would look.
    """
    if not request.json or 'text' not in request.json:
        return jsonify({'error': 'No text provided'}), 400
    
    text = request.json['text']
    
    # In a real implementation, we would:
    # 1. Initialize the Vertex AI client
    # 2. Call the model to analyze the text
    
    # Example of what the real code might look like:
    """
    # Initialize Vertex AI
    aiplatform.init(
        project=os.getenv('GOOGLE_CLOUD_PROJECT'),
        location=os.getenv('GOOGLE_CLOUD_REGION')
    )
    
    # Get the endpoint
    endpoint = aiplatform.Endpoint(os.getenv('VERTEX_AI_ENDPOINT_ID'))
    
    # Prepare the request
    instances = [{"text": text}]
    
    # Make prediction
    response = endpoint.predict(instances=instances)
    
    # Process the results
    predictions = response.predictions
    """
    
    # For the hackathon, we'll mock the response
    # This simulates what we would get from a model trained to detect:
    # 1. Sentiment analysis
    # 2. Propaganda techniques
    # 3. Topic classification
    
    # Mockup analysis - in reality, this would come from the Vertex AI model
    mock_analysis = {
        "sentiment": {
            "score": 0.75,  # -1 to 1 scale, where -1 is very negative, 1 is very positive
            "magnitude": 0.85  # 0 to 1 scale indicating strength of emotion
        },
        "propaganda_techniques": [
            {
                "technique": "emotional_manipulation",
                "confidence": 0.92,
                "examples": ["shocking revelation", "they don't want you to know"]
            },
            {
                "technique": "loaded_language",
                "confidence": 0.78,
                "examples": ["radical", "devastating"]
            }
        ],
        "topic_classification": {
            "primary_topic": "politics",
            "confidence": 0.87,
            "subtopics": ["election", "controversy"]
        },
        "credibility_score": 0.35  # 0 to 1 scale, where 1 is highly credible
    }
    
    return jsonify({
        "analysis": mock_analysis,
        "summary": "This content shows signs of emotional manipulation and loaded language. The credibility score is low. Exercise caution when consuming this information."
    })

@app.route('/check_source', methods=['POST'])
def check_source():
    """
    Endpoint that checks the credibility of a news source against a database
    or by querying a model trained on source reliability.
    """
    if not request.json or 'domain' not in request.json:
        return jsonify({'error': 'No domain provided'}), 400
    
    domain = request.json['domain']
    
    # In a production implementation, we would:
    # 1. Query a database of known problematic sites
    # 2. Check against fact-checking organizations' APIs
    # 3. Use a model to analyze the overall reputation
    
    # For the hackathon, we'll use a simple mock response
    untrusted_domains = [
        "example-fake-news.com",
        "another-biased-site.org",
        "unreliable-source.net"
    ]
    
    is_untrusted = domain in untrusted_domains
    
    # Mock what would be a more complex analysis in production
    mock_source_analysis = {
        "domain": domain,
        "is_untrusted": is_untrusted,
        "trustworthiness_score": 0.2 if is_untrusted else 0.85,
        "bias_rating": "extreme" if is_untrusted else "minimal",
        "fact_check_history": {
            "total_checks": 17 if is_untrusted else 3,
            "failed_checks": 14 if is_untrusted else 0
        }
    }
    
    return jsonify({
        "source_analysis": mock_source_analysis,
        "summary": "This source has a history of publishing misleading content." if is_untrusted else "This source appears to be generally reliable."
    })

if __name__ == '__main__':
    # For production, use a proper WSGI server
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 8080))) 