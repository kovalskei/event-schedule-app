#!/usr/bin/env python3
"""
Script to make HTTP POST request to template-generator function
and save templates to database.
"""

import json
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("Installing requests library...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests


def main():
    # Read HTML content
    html_file = Path("test-complex-template.html")
    
    if not html_file.exists():
        print(f"ERROR: File {html_file} not found")
        sys.exit(1)
    
    print("Reading HTML file...")
    html_content = html_file.read_text(encoding='utf-8')
    print(f"HTML content length: {len(html_content)} characters\n")
    
    # Prepare request
    url = "https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b"
    
    request_body = {
        "html_content": html_content,
        "event_id": 1,
        "content_type_id": 13,
        "name": "Тестовый лонгрид со стилями"
    }
    
    print("=" * 60)
    print("Making POST request to template-generator function...")
    print(f"URL: {url}")
    print(f"Request body size: {len(json.dumps(request_body))} bytes")
    print("=" * 60)
    print()
    
    # Make the request
    try:
        response = requests.post(
            url,
            json=request_body,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        print("Response received!\n")
        
        # Parse response
        print("=" * 60)
        print(f"RESPONSE STATUS CODE: {response.status_code}")
        print(f"RESPONSE STATUS TEXT: {response.reason}")
        print("=" * 60)
        print()
        
        # Try to parse JSON
        try:
            response_data = response.json()
            print("RESPONSE BODY:")
            print(json.dumps(response_data, indent=2, ensure_ascii=False))
        except json.JSONDecodeError:
            print("Response is not JSON, raw text:")
            print(response.text)
            response_data = {"raw": response.text}
        
        print()
        print("=" * 60)
        
        # Check if successful
        if response.ok:
            print("STATUS: SUCCESS!")
            print("=" * 60)
            print()
            
            if isinstance(response_data, dict):
                if 'template_id' in response_data:
                    print(f"✓ Template ID: {response_data['template_id']}")
                if 'example_id' in response_data:
                    print(f"✓ Example ID: {response_data['example_id']}")
                if 'message' in response_data:
                    print(f"✓ Message: {response_data['message']}")
        else:
            print(f"STATUS: ERROR - Request failed with status {response.status_code}")
            print("=" * 60)
            print()
            
            if isinstance(response_data, dict):
                if 'error' in response_data:
                    print(f"✗ Error: {response_data['error']}")
                if 'details' in response_data:
                    print(f"✗ Details: {response_data['details']}")
        
        print()
        return response_data
        
    except requests.exceptions.RequestException as e:
        print()
        print("=" * 60)
        print("ERROR OCCURRED:")
        print("=" * 60)
        print(f"Exception: {type(e).__name__}")
        print(f"Message: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
    print("\nScript completed successfully.")
