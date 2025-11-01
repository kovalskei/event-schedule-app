# Template Generator Style Preservation Test

## Test Objective
Verify that the template-generator backend function at `https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b` preserves complex HTML styles while converting content to template variables.

## How to Run the Test

### Option 1: Node.js (Recommended)
```bash
node test-style-preservation.mjs
```

### Option 2: Python
```bash
python3 test_style_preservation.py
```

## Test Input

### Complex HTML Payload
The test sends a POST request with the following JSON payload:

```json
{
  "html_content": "<!DOCTYPE html><html><head><style>.gradient{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);}</style></head><body><table width=\"600\" style=\"background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\"><tr><td style=\"padding:40px;text-align:center;\"><h1 style=\"color:#fff;font-size:32px;\">Революция в HR</h1><p style=\"color:#f3f4f6;font-size:18px;\">Увеличьте скорость найма на 300%</p></td></tr></table><table width=\"600\" style=\"margin-top:32px;\"><tr><td style=\"padding:24px;border:2px solid #e5e7eb;border-radius:12px;\"><h2 style=\"color:#1f2937;font-size:48px;\">2,500+</h2><p style=\"color:#6b7280;\">HR-менеджеров используют</p></td></tr></table><table width=\"600\"><tr><td style=\"text-align:center;\"><a href=\"https://example.com/demo\" style=\"background:linear-gradient(90deg,#667eea,#764ba2);color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;\">Начать бесплатно</a></td></tr></table></body></html>",
  "event_id": 1,
  "content_type_id": 1,
  "name": "Test Template"
}
```

### HTML Features Being Tested
The test HTML contains:

1. **CSS `<style>` tag** with gradient class
2. **Inline styles** with `linear-gradient()` on table background
3. **Multiple color values**:
   - `#667eea` (purple)
   - `#764ba2` (darker purple)
   - `#fff` (white)
   - `#f3f4f6` (light gray)
   - `#e5e7eb` (border gray)
   - `#1f2937` (dark gray)
   - `#6b7280` (medium gray)
4. **Complex CSS properties**:
   - `linear-gradient(135deg, ...)` on table
   - `linear-gradient(90deg, ...)` on button
   - `border-radius: 12px` and `8px`
   - `padding: 40px`, `24px`, `16px 32px`
   - `text-align: center`
   - `border: 2px solid`
5. **Russian text** that should be replaced with variables
6. **URL** (`https://example.com/demo`) that should become `{{cta_url}}`

## What the Test Checks

### ✅ Preservation Checks (13 items)
1. linear-gradient (table background) - 135deg gradient
2. linear-gradient (button) - 90deg gradient  
3. `<style>` tag with CSS class
4. Color #667eea preserved
5. Color #764ba2 preserved
6. Color #fff preserved
7. Color #f3f4f6 preserved
8. Color #e5e7eb preserved
9. Color #1f2937 preserved
10. Color #6b7280 preserved
11. border-radius properties
12. padding properties
13. inline styles (style=) attributes

### ✅ Replacement Checks (3 items)
1. Text → variables (contains `{{...}}`)
2. URL → `{{cta_url}}`
3. Contains template placeholders

## Expected Test Output

The test script will output:

1. **Request Info**: Endpoint URL, payload size
2. **Response Status**: HTTP status code and message
3. **BEFORE snippet**: First 400 chars of original HTML
4. **AFTER snippet**: First 400 chars of converted template
5. **Preservation Check**: List of preserved vs missing features
6. **Variable Replacement Check**: List of found variables
7. **Full Converted HTML**: Complete template output
8. **Final Verdict**: PASS/PARTIAL PASS/FAIL with detailed breakdown

## Success Criteria

### 🎉 PASS
All 13 preservation checks pass AND text is replaced with variables AND URLs replaced with {{cta_url}}

### ⚠️ PARTIAL PASS  
All preservation checks pass BUT variable replacement is incomplete

### ❌ FAIL
Any preservation checks fail (styles lost during conversion)

## Test Files

- **test-style-preservation.mjs** - Node.js version using fetch API
- **test_style_preservation.py** - Python version using requests library
- **RUN_STYLE_TEST.md** - This documentation

## Dependencies

### Node.js version
- Node.js 14+ (built-in fetch API in Node 18+)
- No external dependencies

### Python version  
- Python 3.6+
- `requests` library: `pip install requests`

## Example Expected Output

```
================================================================================
TESTING TEMPLATE-GENERATOR BACKEND FUNCTION
================================================================================

Endpoint: https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b

Original HTML length: 892 characters

================================================================================
MAKING REQUEST...
================================================================================

Status Code: 200
Status Text: OK

================================================================================
ANALYSIS REPORT
================================================================================

📋 BEFORE (Original HTML - snippet):
--------------------------------------------------------------------------------
<!DOCTYPE html><html><head><style>.gradient{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);}</style></head><body><table width="600" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"><tr><td style="padding:40px;text-align:center;"><h1 style="color:#fff;font-size:32px;">Революция в HR</h1>...

📋 AFTER (Converted Template - snippet):
--------------------------------------------------------------------------------
<!DOCTYPE html><html><head><style>.gradient{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);}</style></head><body><table width="600" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"><tr><td style="padding:40px;text-align:center;"><h1 style="color:#fff;font-size:32px;">{{headline}}</h1>...

================================================================================
PRESERVATION CHECK
================================================================================

✅ PRESERVED:
  ✓ linear-gradient (table bg)
  ✓ linear-gradient (button)
  ✓ <style> tag
  ✓ Color #667eea
  ✓ Color #764ba2
  ✓ Color #fff
  ✓ Color #f3f4f6
  ✓ Color #e5e7eb
  ✓ Color #1f2937
  ✓ Color #6b7280
  ✓ border-radius
  ✓ padding styles
  ✓ inline styles (style=)

❌ MISSING:
  (none)

================================================================================
VARIABLE REPLACEMENT CHECK
================================================================================

✅ REPLACED:
  ✓ Text → variables
  ✓ URL → {{cta_url}}
  ✓ Contains placeholders

📊 Found 5 variable placeholders (5 unique):
  - {{headline}} (used 1x)
  - {{subheadline}} (used 1x)
  - {{stat_number}} (used 1x)
  - {{stat_text}} (used 1x)
  - {{cta_url}} (used 1x)

================================================================================
FINAL VERDICT
================================================================================

📊 Preservation Rate: 13/13 (100%)

🎉 PASS - All styles preserved and content properly templated!

✅ Summary:
  - All CSS gradients preserved
  - All colors preserved
  - All inline styles preserved
  - <style> tag preserved
  - Text replaced with variables
  - URLs replaced with {{cta_url}}
```

## Troubleshooting

### Request Timeout
If the test times out, the backend function may be cold-starting. Wait 30 seconds and retry.

### Connection Error
Check your internet connection and verify the endpoint URL is accessible.

### Unexpected Response Format
If the response doesn't contain `html_template` field, check the response structure and update the test accordingly.

### Python Requests Module Not Found
Install it with: `pip install requests`

## Related Files

- `/backend/api/template-generator/` - Backend function source code
- `test-complex-template.html` - Another test HTML file
- `execute-request.mjs` - Generic request executor
- `test-template-conversion.py` - Original Python test script
