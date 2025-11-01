// Test endpoint /generate-email
const url = "https://functions.poehali.dev/d2a2e722-c697-4c1e-a3c7-af2366b408af";

const payload = {
  event_id: 1,
  template_id: 138,
  theme: "Анонс спикеров по адаптации и мотивации сотрудников",
  test_mode: true
};

console.log("Testing endpoint:", url);
console.log("================================\n");
console.log("Request payload:");
console.log(JSON.stringify(payload, null, 2));
console.log("\n================================\n");

try {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  console.log("Response status:", response.status);
  console.log("Response headers:", Object.fromEntries(response.headers.entries()));
  console.log("\n================================\n");
  console.log("Response body:");
  console.log(JSON.stringify(data, null, 2));
  console.log("\n================================\n");

  // Validation
  console.log("VALIDATION:");
  console.log("- success:", data.success === true ? "✓ true" : "✗ " + data.success);
  console.log("- rendered_html present:", data.rendered_html ? "✓ yes" : "✗ no");
  console.log("- rendered_html contains HTML:", data.rendered_html && data.rendered_html.includes("<") ? "✓ yes" : "✗ no");
  console.log("- selected_speakers present:", data.selected_speakers ? "✓ yes" : "✗ no");
  console.log("- selected_speakers count:", data.selected_speakers ? data.selected_speakers.length : 0);
  console.log("- ai_reasoning present:", data.ai_reasoning ? "✓ yes" : "✗ no");
  
  if (data.selected_speakers && data.selected_speakers.length > 0) {
    console.log("\nSelected speakers:");
    data.selected_speakers.forEach((speaker, idx) => {
      console.log(`  ${idx + 1}. ${speaker.name || speaker}`);
    });
  }

  if (data.ai_reasoning) {
    console.log("\nAI Reasoning:");
    console.log(data.ai_reasoning);
  }

  // Save to file
  await Bun.write("test_response.json", JSON.stringify(data, null, 2));
  console.log("\n================================");
  console.log("Full response saved to test_response.json");

} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
}
