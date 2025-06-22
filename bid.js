const { chromium, request } = require('playwright');
const fs = require('fs');
const path = require('path');

// Helper function to write data to CSV
function writeToCSV(filename, data) {
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
    const headers = Object.keys(data[0]);
    let csvContent = headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',') + '\n';
    data.forEach(row => {
      const rowValues = headers.map(header => {
        const value = row[header];
        return `"${String(value ?? '').replace(/"/g, '""')}"`;
      });
      csvContent += rowValues.join(',') + '\n';
    });
    fs.writeFileSync(filename, csvContent);
  } else if (typeof data === 'object' && data !== null) {
    // Single object
    const headers = Object.keys(data);
    const rowValues = headers.map(header =>
      `"${String(data[header] ?? '').replace(/"/g, '""')}"`
    );
    fs.writeFileSync(filename, headers.join(',') + '\n' + rowValues.join(',') + '\n');
  } else {
    // Primitive value
    fs.writeFileSync(filename, `"Value"\n"${String(data).replace(/"/g, '""')}"\n`);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://smartauction.okloapps.com/Reports/BidHistoryReport');
    console.log("👉 Please log in manually and press ENTER to continue...");
    await new Promise(resolve => process.stdin.once('data', resolve));

    // Get browser storage state for authenticated API requests
    const storageState = await context.storageState();
    const apiRequestContext = await request.newContext({ storageState });

    const apiUrls = [
      'https://smartauction.okloapps.com/api/AuctionItemBid/get-all-item-history/2011750',
      'https://smartauction.okloapps.com/api/AuctionItemBid/get-all-item-history/2011751'
    ];

    for (const apiUrl of apiUrls) {
      console.log(`\n🚀 Fetching data from API URL: ${apiUrl}`);
      const response = await apiRequestContext.post(apiUrl, { data: {} });

      if (!response.ok()) {
        console.log(`❌ API call failed for URL ${apiUrl}: ${response.status()}`);
        continue;
      }

      const apiData = await response.json();
      const apiId = apiUrl.split('/').pop();

      if (Array.isArray(apiData)) {
        // Array response
        const filename = path.join(__dirname, `output_${apiId}.csv`);
        writeToCSV(filename, apiData);
        console.log(`💾 Saved array data to: ${filename}`);
      } else if (typeof apiData === 'object' && apiData !== null) {
        // Object response with multiple keys
        for (const [key, value] of Object.entries(apiData)) {
          const filename = path.join(__dirname, `output_${apiId}_${key}.csv`);
          writeToCSV(filename, value);
          console.log(`💾 Saved data for key '${key}' to: ${filename}`);
        }
      } else {
        // Primitive response
        const filename = path.join(__dirname, `output_${apiId}.csv`);
        writeToCSV(filename, apiData);
        console.log(`💾 Saved primitive data to: ${filename}`);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log("\n🏁 COMPLETED!");
    await apiRequestContext.dispose();
  } catch (error) {
    console.error("💥 Fatal error:", error);
  } finally {
    await browser.close();
    console.log("✅ Done!");
  }
})();
