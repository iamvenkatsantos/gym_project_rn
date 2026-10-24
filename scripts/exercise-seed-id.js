// Stable database UUIDs for the shared library, derived from the library ids.
// Shared by generate-exercise-seed.js and the demo-media tests.
const crypto = require('crypto');

function uuidFor(id) {
  const hex = crypto.createHash('sha1').update(`corefit/${id}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

module.exports = { uuidFor };
