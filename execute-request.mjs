import { readFileSync } from 'fs';

async function makeRequest() {
  try {
    // Read HTML content
    console.log('Reading HTML file...');
    const htmlContent = readFileSync('test-complex-template.html', 'utf-8');
    console.log('HTML content length:', htmlContent.length, 'characters');
    
    // Prepare request body
    const requestBody = {
      html_content: htmlContent,
      event_id: 1,
      content_type_id: 13,
      name: "Тестовый лонгрид со стилями"
    };
    
    console.log('\n========================================');
    console.log('Making POST request to template-generator function...');
    console.log('URL: https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b');
    console.log('Request body size:', JSON.stringify(requestBody).length, 'bytes');
    console.log('========================================\n');
    
    // Make the request
    const response = await fetch('https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('Response received!\n');
    
    // Get response body
    let responseData;
    const responseText = await response.text();
    
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.log('Response is not JSON, raw text:');
      console.log(responseText);
      responseData = { raw: responseText };
    }
    
    // Output results
    console.log('========================================');
    console.log('RESPONSE STATUS CODE:', response.status);
    console.log('RESPONSE STATUS TEXT:', response.statusText);
    console.log('========================================\n');
    
    console.log('RESPONSE BODY:');
    console.log(JSON.stringify(responseData, null, 2));
    console.log('\n========================================');
    
    // Check if successful
    if (response.ok) {
      console.log('STATUS: SUCCESS!');
      console.log('========================================\n');
      
      if (responseData.template_id) {
        console.log('✓ Template ID:', responseData.template_id);
      }
      if (responseData.example_id) {
        console.log('✓ Example ID:', responseData.example_id);
      }
      if (responseData.message) {
        console.log('✓ Message:', responseData.message);
      }
    } else {
      console.log('STATUS: ERROR - Request failed with status', response.status);
      console.log('========================================\n');
      
      if (responseData.error) {
        console.log('✗ Error:', responseData.error);
      }
      if (responseData.details) {
        console.log('✗ Details:', responseData.details);
      }
    }
    
    return responseData;
    
  } catch (error) {
    console.error('\n========================================');
    console.error('ERROR OCCURRED:');
    console.error('========================================');
    console.error('Message:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    console.error('\nStack trace:');
    console.error(error.stack);
    throw error;
  }
}

// Execute the request
makeRequest()
  .then(() => {
    console.log('\nScript completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed with error.');
    process.exit(1);
  });