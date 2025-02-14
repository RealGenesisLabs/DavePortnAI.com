const express = require('express');
const path = require('path');
const app = express();

// Serve static files from the current directory
app.use(express.static('./'));

// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Press Ctrl+C to stop the server`);
}); 