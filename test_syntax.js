const fs = require('fs');
const js = fs.readFileSync('static/js/devices-table.js', 'utf8');
try {
  new Function(js);
  console.log('JS syntax is valid.');
} catch(e) {
  console.error('JS Syntax error:', e);
}
