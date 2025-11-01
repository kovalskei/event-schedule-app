async function testStylePreservation() {
  try {
    // Complex HTML with gradients, inline styles, and <style> tag
    const htmlContent = `<!DOCTYPE html><html><head><style>.gradient{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);}</style></head><body><table width="600" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"><tr><td style="padding:40px;text-align:center;"><h1 style="color:#fff;font-size:32px;">Революция в HR</h1><p style="color:#f3f4f6;font-size:18px;">Увеличьте скорость найма на 300%</p></td></tr></table><table width="600" style="margin-top:32px;"><tr><td style="padding:24px;border:2px solid #e5e7eb;border-radius:12px;"><h2 style="color:#1f2937;font-size:48px;">2,500+</h2><p style="color:#6b7280;">HR-менеджеров используют</p></td></tr></table><table width="600"><tr><td style="text-align:center;"><a href="https://example.com/demo" style="background:linear-gradient(90deg,#667eea,#764ba2);color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">Начать бесплатно</a></td></tr></table></body></html>`;
    
    // Prepare request body
    const requestBody = {
      html_content: htmlContent,
      event_id: 1,
      content_type_id: 1,
      name: "Test Template"
    };
    
    console.log('=' .repeat(80));
    console.log('TESTING TEMPLATE-GENERATOR BACKEND FUNCTION');
    console.log('=' .repeat(80));
    console.log('\nEndpoint: https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b');
    console.log('\nOriginal HTML length:', htmlContent.length, 'characters');
    console.log('\n' + '=' .repeat(80));
    console.log('MAKING REQUEST...');
    console.log('=' .repeat(80));
    
    // Make the request
    const response = await fetch('https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('\nStatus Code:', response.status);
    console.log('Status Text:', response.statusText);
    
    // Get response body
    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.log('\n❌ ERROR: Response is not valid JSON');
      console.log('Raw response:', responseText);
      return;
    }
    
    console.log('\n' + '=' .repeat(80));
    console.log('RESPONSE DATA');
    console.log('=' .repeat(80));
    console.log(JSON.stringify(responseData, null, 2));
    
    if (!response.ok) {
      console.log('\n❌ ERROR: Request failed with status', response.status);
      if (responseData.error) {
        console.log('Error:', responseData.error);
      }
      if (responseData.details) {
        console.log('Details:', responseData.details);
      }
      return;
    }
    
    // Extract the converted template
    const convertedHtml = responseData.html_template || responseData.template || '';
    
    if (!convertedHtml) {
      console.log('\n❌ ERROR: No html_template field in response');
      console.log('Available fields:', Object.keys(responseData));
      return;
    }
    
    console.log('\n' + '=' .repeat(80));
    console.log('ANALYSIS REPORT');
    console.log('=' .repeat(80));
    
    console.log('\n📋 BEFORE (Original HTML - snippet):');
    console.log('-'.repeat(80));
    console.log(htmlContent.substring(0, 300) + '...');
    
    console.log('\n📋 AFTER (Converted Template - snippet):');
    console.log('-'.repeat(80));
    console.log(convertedHtml.substring(0, 300) + '...');
    
    console.log('\n' + '=' .repeat(80));
    console.log('PRESERVATION CHECK');
    console.log('=' .repeat(80));
    
    // Check what was preserved
    const checks = {
      'linear-gradient (table bg)': convertedHtml.includes('linear-gradient(135deg') || convertedHtml.includes('linear-gradient(135deg,'),
      'linear-gradient (button)': convertedHtml.includes('linear-gradient(90deg'),
      '<style> tag': convertedHtml.includes('<style>') && convertedHtml.includes('</style>'),
      'Color #667eea': convertedHtml.includes('#667eea'),
      'Color #764ba2': convertedHtml.includes('#764ba2'),
      'Color #fff': convertedHtml.includes('#fff'),
      'Color #f3f4f6': convertedHtml.includes('#f3f4f6'),
      'Color #e5e7eb': convertedHtml.includes('#e5e7eb'),
      'Color #1f2937': convertedHtml.includes('#1f2937'),
      'Color #6b7280': convertedHtml.includes('#6b7280'),
      'border-radius': convertedHtml.includes('border-radius'),
      'padding styles': convertedHtml.includes('padding:'),
      'inline styles (style=)': convertedHtml.includes('style="'),
    };
    
    console.log('\n✅ PRESERVED:');
    Object.entries(checks).forEach(([check, passed]) => {
      if (passed) {
        console.log(`  ✓ ${check}`);
      }
    });
    
    console.log('\n❌ MISSING:');
    const missing = Object.entries(checks).filter(([_, passed]) => !passed).map(([check]) => check);
    if (missing.length > 0) {
      missing.forEach(check => console.log(`  ✗ ${check}`));
    } else {
      console.log('  (none)');
    }
    
    console.log('\n' + '=' .repeat(80));
    console.log('VARIABLE REPLACEMENT CHECK');
    console.log('=' .repeat(80));
    
    const replacements = {
      'Text → variables': convertedHtml.includes('{{') && convertedHtml.includes('}}'),
      'URL → {{cta_url}}': convertedHtml.includes('{{cta_url}}'),
      'Contains placeholders': convertedHtml.includes('{{'),
    };
    
    console.log('\n✅ REPLACED:');
    Object.entries(replacements).forEach(([check, passed]) => {
      if (passed) {
        console.log(`  ✓ ${check}`);
      }
    });
    
    // Count variables
    const variableMatches = convertedHtml.match(/\{\{([^}]+)\}\}/g) || [];
    const uniqueVars = [...new Set(variableMatches)];
    
    console.log(`\n📊 Found ${variableMatches.length} variable placeholders (${uniqueVars.length} unique):`);
    uniqueVars.forEach(varName => {
      const count = variableMatches.filter(v => v === varName).length;
      console.log(`  - ${varName} (used ${count}x)`);
    });
    
    // Show full converted HTML
    console.log('\n' + '=' .repeat(80));
    console.log('FULL CONVERTED TEMPLATE HTML');
    console.log('=' .repeat(80));
    console.log(convertedHtml);
    
    console.log('\n' + '=' .repeat(80));
    console.log('FINAL VERDICT');
    console.log('=' .repeat(80));
    
    const allPreserved = Object.values(checks).every(v => v);
    const hasVariables = replacements['Text → variables'];
    const hasCtaUrl = replacements['URL → {{cta_url}}'];
    
    const preservedCount = Object.values(checks).filter(v => v).length;
    const totalChecks = Object.keys(checks).length;
    
    console.log(`\n📊 Preservation Rate: ${preservedCount}/${totalChecks} (${Math.round(preservedCount / totalChecks * 100)}%)`);
    
    if (allPreserved && hasVariables && hasCtaUrl) {
      console.log('\n🎉 PASS - All styles preserved and content properly templated!');
      console.log('\n✅ Summary:');
      console.log('  - All CSS gradients preserved');
      console.log('  - All colors preserved');
      console.log('  - All inline styles preserved');
      console.log('  - <style> tag preserved');
      console.log('  - Text replaced with variables');
      console.log('  - URLs replaced with {{cta_url}}');
    } else if (allPreserved) {
      console.log('\n⚠️ PARTIAL PASS - Styles preserved but variable replacement incomplete');
      console.log(`\n  - Variables found: ${hasVariables}`);
      console.log(`  - CTA URL replaced: ${hasCtaUrl}`);
    } else {
      console.log('\n❌ FAIL - Some styles were not preserved');
      console.log(`\n  - Preservation rate: ${preservedCount}/${totalChecks}`);
      console.log(`  - Missing: ${missing.join(', ')}`);
    }
    
    // Additional checks
    console.log('\n' + '=' .repeat(80));
    console.log('ADDITIONAL DETAILS');
    console.log('=' .repeat(80));
    
    if (responseData.template_id) {
      console.log(`\n✓ Template ID: ${responseData.template_id}`);
    }
    if (responseData.example_id) {
      console.log(`✓ Example ID: ${responseData.example_id}`);
    }
    if (responseData.message) {
      console.log(`✓ Message: ${responseData.message}`);
    }
    
    console.log('\n' + '=' .repeat(80));
    
  } catch (error) {
    console.error('\n' + '=' .repeat(80));
    console.error('ERROR OCCURRED:');
    console.error('=' .repeat(80));
    console.error('Message:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    throw error;
  }
}

// Execute the test
testStylePreservation()
  .then(() => {
    console.log('\nTest completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTest failed with error.');
    process.exit(1);
  });
