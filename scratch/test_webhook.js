
const http = require('http');

const data = JSON.stringify({
  commit_sha: "980da6c768912345678901234567890123456789",
  service_name: "DevLens",
  branch: "main",
  environment: "production"
});

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/webhooks/pipeline',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(data);
req.end();
