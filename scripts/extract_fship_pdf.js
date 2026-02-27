const fs = require('fs');
const pdf = require('pdf-parse');

const pdfPath = 'c:\\Users\\HP\\OneDrive\\Desktop\\debuging\\api_document.pdf';

(async () => {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdf(dataBuffer);
    console.log(data.text);
  } catch (err) {
    console.error('ERROR extracting PDF:', err);
    process.exit(2);
  }
})();
