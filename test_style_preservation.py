#!/usr/bin/env python3
import requests
import json
import re
import sys

# API endpoint
url = "https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b"

# Test payload with complex HTML containing:
# - CSS gradients (linear-gradient)
# - Inline styles
# - <style> tag with CSS class
# - Multiple colors
# - border-radius, padding, etc.
payload = {
    "html_content": "<!DOCTYPE html><html><head><style>.gradient{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);}</style></head><body><table width=\"600\" style=\"background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\"><tr><td style=\"padding:40px;text-align:center;\"><h1 style=\"color:#fff;font-size:32px;\">Революция в HR</h1><p style=\"color:#f3f4f6;font-size:18px;\">Увеличьте скорость найма на 300%</p></td></tr></table><table width=\"600\" style=\"margin-top:32px;\"><tr><td style=\"padding:24px;border:2px solid #e5e7eb;border-radius:12px;\"><h2 style=\"color:#1f2937;font-size:48px;\">2,500+</h2><p style=\"color:#6b7280;\">HR-менеджеров используют</p></td></tr></table><table width=\"600\"><tr><td style=\"text-align:center;\"><a href=\"https://example.com/demo\" style=\"background:linear-gradient(90deg,#667eea,#764ba2);color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;\">Начать бесплатно</a></td></tr></table></body></html>",
    "event_id": 1,
    "content_type_id": 1,
    "name": "Test Template"
}

print("=" * 80)
print("TESTING TEMPLATE-GENERATOR BACKEND FUNCTION")
print("=" * 80)
print(f"\nEndpoint: {url}")
print(f"\nOriginal HTML length: {len(payload['html_content'])} characters")

print("\n" + "=" * 80)
print("MAKING REQUEST...")
print("=" * 80)

try:
    response = requests.post(url, json=payload, timeout=30)
    
    print(f"\nStatus Code: {response.status_code}")
    print(f"Status Text: {response.reason}")
    
    if response.status_code == 200:
        try:
            result = response.json()
            
            # Extract the converted template
            converted_html = result.get('html_template', '')
            
            if not converted_html:
                print("\n❌ ERROR: No 'html_template' field in response")
                print("Available fields:", list(result.keys()))
                print("\nFull response:")
                print(json.dumps(result, indent=2, ensure_ascii=False))
                sys.exit(1)
            
            print("\n" + "=" * 80)
            print("ANALYSIS REPORT")
            print("=" * 80)
            
            print("\n📋 BEFORE (Original HTML - first 400 chars):")
            print("-" * 80)
            print(payload['html_content'][:400] + "...")
            
            print("\n📋 AFTER (Converted Template - first 400 chars):")
            print("-" * 80)
            print(converted_html[:400] + "...")
            
            print("\n" + "=" * 80)
            print("PRESERVATION CHECK")
            print("=" * 80)
            
            checks = {
                "linear-gradient (table bg)": ("linear-gradient(135deg, #667eea 0%, #764ba2 100%)" in converted_html or 
                                              "linear-gradient(135deg,#667eea 0%,#764ba2 100%)" in converted_html),
                "linear-gradient (button)": ("linear-gradient(90deg,#667eea,#764ba2)" in converted_html or 
                                            "linear-gradient(90deg, #667eea, #764ba2)" in converted_html),
                "<style> tag": "<style>" in converted_html and "</style>" in converted_html,
                "Color #667eea": "#667eea" in converted_html,
                "Color #764ba2": "#764ba2" in converted_html,
                "Color #fff": "#fff" in converted_html,
                "Color #f3f4f6": "#f3f4f6" in converted_html,
                "Color #e5e7eb": "#e5e7eb" in converted_html,
                "Color #1f2937": "#1f2937" in converted_html,
                "Color #6b7280": "#6b7280" in converted_html,
                "border-radius": "border-radius" in converted_html,
                "padding styles": "padding:" in converted_html,
                "inline styles (style=)": 'style="' in converted_html,
            }
            
            print("\n✅ PRESERVED:")
            preserved_items = []
            for check, passed in checks.items():
                if passed:
                    print(f"  ✓ {check}")
                    preserved_items.append(check)
            
            print("\n❌ MISSING:")
            missing = [check for check, passed in checks.items() if not passed]
            if missing:
                for check in missing:
                    print(f"  ✗ {check}")
            else:
                print("  (none)")
            
            print("\n" + "=" * 80)
            print("VARIABLE REPLACEMENT CHECK")
            print("=" * 80)
            
            replacements = {
                "Text → variables": "{{" in converted_html and "}}" in converted_html,
                "URL → {{cta_url}}": "{{cta_url}}" in converted_html,
                "Contains placeholders": "{{" in converted_html,
            }
            
            print("\n✅ REPLACED:")
            for check, passed in replacements.items():
                if passed:
                    print(f"  ✓ {check}")
            
            # Count variables
            variables = re.findall(r'\{\{([^}]+)\}\}', converted_html)
            unique_vars = list(set(variables))
            
            print(f"\n📊 Found {len(variables)} variable placeholders ({len(unique_vars)} unique):")
            for var in unique_vars:
                count = variables.count(var)
                print(f"  - {{{{{var}}}}} (used {count}x)")
            
            # Show full converted HTML
            print("\n" + "=" * 80)
            print("FULL CONVERTED TEMPLATE HTML")
            print("=" * 80)
            print(converted_html)
            
            print("\n" + "=" * 80)
            print("FINAL VERDICT")
            print("=" * 80)
            
            all_preserved = all(checks.values())
            has_variables = replacements["Text → variables"]
            has_cta_url = replacements["URL → {{cta_url}}"]
            
            preserved_count = sum(checks.values())
            total_checks = len(checks)
            
            print(f"\n📊 Preservation Rate: {preserved_count}/{total_checks} ({round(preserved_count / total_checks * 100)}%)")
            
            if all_preserved and has_variables and has_cta_url:
                print("\n🎉 PASS - All styles preserved and content properly templated!")
                print("\n✅ Summary:")
                print("  - All CSS gradients preserved")
                print("  - All colors preserved")
                print("  - All inline styles preserved")
                print("  - <style> tag preserved")
                print("  - Text replaced with variables")
                print("  - URLs replaced with {{cta_url}}")
                sys.exit(0)
            elif all_preserved:
                print("\n⚠️ PARTIAL PASS - Styles preserved but variable replacement incomplete")
                print(f"\n  - Variables found: {has_variables}")
                print(f"  - CTA URL replaced: {has_cta_url}")
                sys.exit(0)
            else:
                print("\n❌ FAIL - Some styles were not preserved")
                print(f"\n  - Preservation rate: {preserved_count}/{total_checks}")
                print(f"  - Missing: {', '.join(missing)}")
                sys.exit(1)
            
            # Additional metadata
            print("\n" + "=" * 80)
            print("ADDITIONAL METADATA")
            print("=" * 80)
            
            if result.get('template_id'):
                print(f"\n✓ Template ID: {result['template_id']}")
            if result.get('example_id'):
                print(f"✓ Example ID: {result['example_id']}")
            if result.get('message'):
                print(f"✓ Message: {result['message']}")
                
        except json.JSONDecodeError:
            print("\n❌ ERROR: Response is not valid JSON")
            print("Raw response:")
            print(response.text)
            sys.exit(1)
    else:
        print(f"\n❌ ERROR: Request failed with status {response.status_code}")
        print("Response body:")
        print(response.text)
        sys.exit(1)
        
except requests.exceptions.Timeout:
    print("\n❌ ERROR: Request timed out after 30 seconds")
    sys.exit(1)
except requests.exceptions.ConnectionError:
    print("\n❌ ERROR: Failed to connect to the endpoint")
    sys.exit(1)
except Exception as e:
    print(f"\n❌ ERROR: {type(e).__name__}: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 80)
