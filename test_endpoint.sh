#!/bin/bash

# Test endpoint /generate-email
URL="https://functions.poehali.dev/d2a2e722-c697-4c1e-a3c7-af2366b408af"

echo "Testing endpoint: $URL"
echo "================================"
echo ""

# Make POST request with JSON data
response=$(curl -s -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": 1,
    "template_id": 138,
    "theme": "Анонс спикеров по адаптации и мотивации сотрудников",
    "test_mode": true
  }')

# Save response to file
echo "$response" > test_response.json

# Pretty print the response
echo "Response:"
echo "$response" | python3 -m json.tool

echo ""
echo "================================"
echo "Response saved to test_response.json"
