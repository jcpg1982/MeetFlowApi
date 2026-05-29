const cloudinary = require('cloudinary').v2;
require('dotenv').config({ path: '../.env' });

console.log("Cloudinary Configuration:");
console.log("Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME);
console.log("API Key:", process.env.CLOUDINARY_API_KEY);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create a very small dummy text file to test upload
const fs = require('fs');
fs.writeFileSync('temp_test.txt', 'This is a small test file to diagnose Cloudinary credentials.');

console.log("\nAttempting upload...");
cloudinary.uploader.upload('temp_test.txt', {
  folder: 'meetflow_test',
  resource_type: 'auto'
})
.then(result => {
  console.log("SUCCESS!", result);
  fs.unlinkSync('temp_test.txt');
})
.catch(err => {
  console.error("FAILED!");
  console.error(JSON.stringify(err, null, 2));
  fs.unlinkSync('temp_test.txt');
});
