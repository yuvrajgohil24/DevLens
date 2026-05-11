const fs = require('fs');
const path = require('path');

function findTrivy(dir) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        try {
          const res = findTrivy(fullPath);
          if (res) return res;
        } catch(e) {}
      } else if (file.toLowerCase() === 'trivy.exe') {
        return fullPath;
      }
    }
  } catch(e) {}
  return null;
}

const localAppData = process.env.LOCALAPPDATA;
const searchPath = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
console.log(findTrivy(searchPath));
