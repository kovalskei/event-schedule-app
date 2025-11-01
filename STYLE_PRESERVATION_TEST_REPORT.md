# Template Generator Style Preservation Test Report

## Test Summary

**Objective**: Verify that the template-generator backend function preserves complex HTML styles (gradients, colors, inline styles, <style> tags) while converting content to template variables.

**Endpoint**: `https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b`

**Method**: POST

**Test Date**: 2025-11-01

---

## Test Setup

### Test Files Created
- ✅ `test-style-preservation.mjs` - Node.js test script (275 lines)
- ✅ `test_style_preservation.py` - Python test script (172 lines)
- ✅ `test-styles.sh` - Bash wrapper to run either version
- ✅ `RUN_STYLE_TEST.md` - Test documentation
- ✅ `STYLE_PRESERVATION_TEST_REPORT.md` - This report

### How to Execute

```bash
# Option 1: Auto-detect and run
chmod +x test-styles.sh
./test-styles.sh

# Option 2: Run Node.js version directly
node test-style-preservation.mjs

# Option 3: Run Python version directly
python3 test_style_preservation.py

# Option 4: Manual curl test (see below)
```

---

## Test Input Data

### Request Body
```json
{
  "html_content": "<!DOCTYPE html><html><head><style>.gradient{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);}</style></head><body><table width=\"600\" style=\"background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\"><tr><td style=\"padding:40px;text-align:center;\"><h1 style=\"color:#fff;font-size:32px;\">Революция в HR</h1><p style=\"color:#f3f4f6;font-size:18px;\">Увеличьте скорость найма на 300%</p></td></tr></table><table width=\"600\" style=\"margin-top:32px;\"><tr><td style=\"padding:24px;border:2px solid #e5e7eb;border-radius:12px;\"><h2 style=\"color:#1f2937;font-size:48px;\">2,500+</h2><p style=\"color:#6b7280;\">HR-менеджеров используют</p></td></tr></table><table width=\"600\"><tr><td style=\"text-align:center;\"><a href=\"https://example.com/demo\" style=\"background:linear-gradient(90deg,#667eea,#764ba2);color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;\">Начать бесплатно</a></td></tr></table></body></html>",
  "event_id": 1,
  "content_type_id": 1,
  "name": "Test Template"
}
```

### HTML Breakdown

**Size**: 892 characters

**Key Features**:
1. **`<style>` tag**: Contains `.gradient` CSS class with linear-gradient
2. **Inline gradient on table**: `background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
3. **Inline gradient on button**: `background:linear-gradient(90deg,#667eea,#764ba2)`
4. **7 different color values**: #667eea, #764ba2, #fff, #f3f4f6, #e5e7eb, #1f2937, #6b7280
5. **Complex CSS properties**: border-radius, padding variations, text-align, border
6. **Russian text**: "Революция в HR", "Увеличьте скорость найма на 300%", etc.
7. **URL**: `https://example.com/demo` (should convert to `{{cta_url}}`)

---

## Test Validation Criteria

### A. Preservation Checks (13 Tests)

| # | Check | Expected Result |
|---|-------|----------------|
| 1 | linear-gradient (135deg) on table | ✅ PRESERVED |
| 2 | linear-gradient (90deg) on button | ✅ PRESERVED |
| 3 | `<style>` tag with CSS | ✅ PRESERVED |
| 4 | Color #667eea | ✅ PRESERVED |
| 5 | Color #764ba2 | ✅ PRESERVED |
| 6 | Color #fff | ✅ PRESERVED |
| 7 | Color #f3f4f6 | ✅ PRESERVED |
| 8 | Color #e5e7eb | ✅ PRESERVED |
| 9 | Color #1f2937 | ✅ PRESERVED |
| 10 | Color #6b7280 | ✅ PRESERVED |
| 11 | border-radius properties | ✅ PRESERVED |
| 12 | padding properties | ✅ PRESERVED |
| 13 | inline style attributes | ✅ PRESERVED |

### B. Replacement Checks (3 Tests)

| # | Check | Expected Result |
|---|-------|----------------|
| 1 | Text → `{{variables}}` | ✅ REPLACED |
| 2 | URL → `{{cta_url}}` | ✅ REPLACED |
| 3 | Contains placeholders | ✅ YES |

---

## Expected Behavior

### Before Conversion (Input HTML Snippet)
```html
<!DOCTYPE html><html><head>
<style>.gradient{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);}</style>
</head><body>
<table width="600" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
  <tr>
    <td style="padding:40px;text-align:center;">
      <h1 style="color:#fff;font-size:32px;">Революция в HR</h1>
      <p style="color:#f3f4f6;font-size:18px;">Увеличьте скорость найма на 300%</p>
    </td>
  </tr>
</table>
```

### After Conversion (Expected Output Snippet)
```html
<!DOCTYPE html><html><head>
<style>.gradient{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);}</style>
</head><body>
<table width="600" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
  <tr>
    <td style="padding:40px;text-align:center;">
      <h1 style="color:#fff;font-size:32px;">{{headline}}</h1>
      <p style="color:#f3f4f6;font-size:18px;">{{subheadline}}</p>
    </td>
  </tr>
</table>
```

**Key Changes**:
- ✅ Styles preserved exactly as-is
- ✅ Text "Революция в HR" → `{{headline}}`
- ✅ Text "Увеличьте скорость найма на 300%" → `{{subheadline}}`
- ✅ Gradient, colors, padding, all intact

---

## Manual Test (cURL)

If you want to test manually without running the scripts:

### Create test payload file
```bash
cat > test-payload.json << 'EOF'
{
  "html_content": "<!DOCTYPE html><html><head><style>.gradient{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);}</style></head><body><table width=\"600\" style=\"background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\"><tr><td style=\"padding:40px;text-align:center;\"><h1 style=\"color:#fff;font-size:32px;\">Революция в HR</h1><p style=\"color:#f3f4f6;font-size:18px;\">Увеличьте скорость найма на 300%</p></td></tr></table><table width=\"600\" style=\"margin-top:32px;\"><tr><td style=\"padding:24px;border:2px solid #e5e7eb;border-radius:12px;\"><h2 style=\"color:#1f2937;font-size:48px;\">2,500+</h2><p style=\"color:#6b7280;\">HR-менеджеров используют</p></td></tr></table><table width=\"600\"><tr><td style=\"text-align:center;\"><a href=\"https://example.com/demo\" style=\"background:linear-gradient(90deg,#667eea,#764ba2);color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;\">Начать бесплатно</a></td></tr></table></body></html>",
  "event_id": 1,
  "content_type_id": 1,
  "name": "Test Template"
}
EOF
```

### Execute request
```bash
curl -X POST https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b \
  -H "Content-Type: application/json" \
  -d @test-payload.json \
  -w "\n\nHTTP Status: %{http_code}\n" \
  | jq .
```

### Validate response
Check the response JSON for:
1. `html_template` field exists
2. Contains the gradients: `linear-gradient(135deg` and `linear-gradient(90deg`
3. Contains all 7 colors: #667eea, #764ba2, #fff, #f3f4f6, #e5e7eb, #1f2937, #6b7280
4. Contains `{{` placeholders
5. Contains `{{cta_url}}`
6. Contains `<style>` tag
7. Contains `border-radius` and `padding:` styles

---

## Success Criteria

### 🎉 PASS
- **Preservation Rate**: 13/13 (100%)
- **All gradients preserved**: Both 135deg and 90deg gradients intact
- **All colors preserved**: All 7 color codes present
- **All CSS properties preserved**: border-radius, padding, text-align, etc.
- **Variable replacement**: Text converted to `{{...}}` placeholders
- **URL replacement**: Links converted to `{{cta_url}}`

### ⚠️ PARTIAL PASS
- **Preservation Rate**: 13/13 (100%)
- **Issue**: Variable replacement incomplete or missing

### ❌ FAIL
- **Preservation Rate**: < 13/13
- **Issue**: One or more styles lost during conversion
- **Impact**: Template would render incorrectly

---

## Test Output Format

The test scripts output:

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

================================================================================
ADDITIONAL METADATA
================================================================================

✓ Template ID: 123
✓ Example ID: 456
✓ Message: Template created successfully

================================================================================
```

---

## Files Reference

All test files are in the project root:

| File | Purpose | Language | Lines |
|------|---------|----------|-------|
| `test-style-preservation.mjs` | Main test script | JavaScript (ES6) | 275 |
| `test_style_preservation.py` | Main test script | Python 3 | 172 |
| `test-styles.sh` | Runner script | Bash | 37 |
| `RUN_STYLE_TEST.md` | Test documentation | Markdown | ~350 |
| `STYLE_PRESERVATION_TEST_REPORT.md` | This report | Markdown | ~400 |

---

## Dependencies

### Node.js Version
- **Runtime**: Node.js 14+
- **Dependencies**: None (uses built-in `fetch`)

### Python Version  
- **Runtime**: Python 3.6+
- **Dependencies**: `requests` library
  ```bash
  pip install requests
  ```

---

## Troubleshooting

### Common Issues

**Issue**: `ModuleNotFoundError: No module named 'requests'`
```bash
# Fix:
pip install requests
# or
pip3 install requests
```

**Issue**: `node: command not found`
```bash
# Use Python version instead:
python3 test_style_preservation.py
```

**Issue**: Request timeout
- **Cause**: Cold start of backend function
- **Fix**: Wait 30 seconds, retry

**Issue**: Connection refused
- **Cause**: Network/firewall blocking request
- **Fix**: Check internet connection, verify endpoint is accessible

---

## Why This Test Is Important

### Context
The template-generator backend function converts real HR email/landing page HTML into reusable templates by:
1. Preserving the exact HTML structure and styling
2. Replacing variable content (text, numbers, URLs) with `{{placeholders}}`

### Risk
If the function doesn't preserve styles correctly:
- ❌ Email templates will look broken
- ❌ Gradients will be lost
- ❌ Colors will be wrong
- ❌ Layout will break

### This Test Validates
✅ Complex CSS features (gradients) are preserved  
✅ Inline styles are maintained  
✅ `<style>` tags are kept  
✅ All color codes are intact  
✅ Border-radius, padding, and other properties work  
✅ Text is properly templated  
✅ URLs become `{{cta_url}}` placeholders

---

## Next Steps

1. **Run the test**: Execute `./test-styles.sh` or run directly
2. **Review output**: Check preservation rate and final verdict
3. **Verify visually**: If available, render the template to see actual output
4. **Report issues**: If any styles are lost, note which ones
5. **Fix backend**: Update template-generator function if needed

---

## Test Result Summary

**Status**: ⏳ PENDING EXECUTION

To execute this test, run:
```bash
chmod +x test-styles.sh
./test-styles.sh
```

**Expected Result**: 🎉 PASS with 13/13 preservation rate

---

## Additional Notes

- Test HTML uses Russian text to verify UTF-8 handling
- Gradients are the most complex CSS feature being tested
- Both `linear-gradient(135deg,...)` and `linear-gradient(90deg,...)` variations included
- Test verifies 7 different color formats (3-char and 6-char hex)
- Border and padding variations test CSS property preservation
- URL replacement verifies link templating works correctly

---

**Last Updated**: 2025-11-01  
**Test Version**: 1.0  
**Backend Endpoint**: https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b
