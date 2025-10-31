#!/usr/bin/env python3
"""
Test OpenAI API key connectivity by creating a test embedding.
"""
import os
import json
import urllib.request
import urllib.error
import sys


def test_openai_api():
    """Test OpenAI API key by creating a simple embedding."""
    
    # Get API key from environment
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        print("ERROR: OPENAI_API_KEY environment variable not set")
        sys.exit(1)
    
    print("Testing OpenAI API connectivity...")
    print(f"API Key found: {api_key[:8]}...{api_key[-4:]}")
    print()
    
    # Prepare the request
    url = "https://api.openai.com/v1/embeddings"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "input": "test",
        "model": "text-embedding-3-small"
    }
    
    # Convert data to JSON bytes
    json_data = json.dumps(data).encode('utf-8')
    
    # Create request
    req = urllib.request.Request(
        url,
        data=json_data,
        headers=headers,
        method='POST'
    )
    
    try:
        # Make the request
        print(f"Making request to: {url}")
        print(f"Model: {data['model']}")
        print(f"Input text: {data['input']}")
        print()
        
        with urllib.request.urlopen(req) as response:
            # Success!
            response_data = json.loads(response.read().decode('utf-8'))
            
            print("✓ SUCCESS!")
            print()
            print("Response details:")
            print(f"  Status code: {response.status}")
            print(f"  Model used: {response_data.get('model', 'N/A')}")
            print(f"  Embedding dimensions: {len(response_data['data'][0]['embedding'])}")
            print(f"  Usage tokens: {response_data.get('usage', {}).get('total_tokens', 'N/A')}")
            print()
            print("Your OpenAI API key is working correctly!")
            
            return True
            
    except urllib.error.HTTPError as e:
        # HTTP error occurred
        print("✗ HTTP ERROR!")
        print()
        print("Error details:")
        print(f"  Status code: {e.code}")
        print(f"  Reason: {e.reason}")
        print()
        print("Response headers:")
        for header, value in e.headers.items():
            print(f"  {header}: {value}")
        print()
        
        # Try to read the response body
        try:
            error_body = e.read().decode('utf-8')
            print("Response body:")
            try:
                error_json = json.loads(error_body)
                print(json.dumps(error_json, indent=2))
            except json.JSONDecodeError:
                print(error_body)
        except Exception as read_error:
            print(f"  Could not read response body: {read_error}")
        
        return False
        
    except urllib.error.URLError as e:
        # URL error (network issue, etc.)
        print("✗ URL ERROR!")
        print()
        print(f"Error: {e.reason}")
        print()
        print("This typically indicates a network connectivity issue.")
        
        return False
        
    except Exception as e:
        # Other unexpected error
        print("✗ UNEXPECTED ERROR!")
        print()
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        
        return False


if __name__ == "__main__":
    success = test_openai_api()
    sys.exit(0 if success else 1)
