// server.js - Express server for serving the app in production
// This server supports both CommonJS and ES Modules

// Check if we're using ES modules
const isESM = typeof import.meta !== 'undefined';

// Import dependencies based on module system
let express, path, fs, __dirname;

if (isESM) {
  // ES Modules
  import('express').then(module => express = module.default);
  import('path').then(module => path = module);
  import('fs').then(module => fs = module);
  import('url').then(module => {
    const { fileURLToPath } = module;
    __dirname = path.dirname(fileURLToPath(import.meta.url));
    initServer();
  });
} else {
  // CommonJS
  express = require('express');
  path = require('path');
  fs = require('fs');
  __dirname = __dirname || process.cwd();
  initServer();
}

// Server initialization function
function initServer() {
  const app = express();

  // Get port from environment and store in Express
  // Cloud Run automatically sets PORT environment variable
  const port = process.env.PORT || 8080;
  console.log(`Starting server on port: ${port}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`Current directory: ${__dirname}`);

  // Add debugging information
  try {
    console.log(`Files in current directory: ${fs.readdirSync(__dirname).join(', ')}`);

    // Check if build directory exists
    if (fs.existsSync(path.join(__dirname, 'build'))) {
      console.log(`Files in build directory: ${fs.readdirSync(path.join(__dirname, 'build')).join(', ')}`);

      // Define clientBuildPath
      const clientBuildPath = path.join(__dirname, 'build', 'client');
      if (fs.existsSync(clientBuildPath)) {
        console.log(`Files in client build directory: ${fs.readdirSync(clientBuildPath).join(', ')}`);
      } else {
        console.log('client build directory does not exist');
      }
    } else {
      console.log('build directory does not exist');
    }
  } catch (error) {
    console.error(`Error listing directory contents: ${error.message}`);
  }

  // Add health check endpoint for Cloud Run
  app.get('/_health', (req, res) => {
    res.status(200).send('OK');
  });

  // Serve static files from the build directory
  const clientBuildPath = path.join(__dirname, 'build', 'client');
  if (fs.existsSync(clientBuildPath)) {
    console.log(`Serving static files from: ${clientBuildPath}`);
    app.use(express.static(clientBuildPath));

    // Handle all other routes by serving the index.html
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
  } else {
    console.error(`Build directory not found at ${clientBuildPath}`);
    app.get('/', (req, res) => {
      res.status(200).send(`
        <html>
          <body>
            <h1>Server is running</h1>
            <p>Build directory not found. Check logs for more details.</p>
            <pre>${JSON.stringify({
              env: process.env.NODE_ENV,
              port: port,
              dir: __dirname,
              files: fs.existsSync(__dirname) ? fs.readdirSync(__dirname) : 'Cannot read directory'
            }, null, 2)}</pre>
          </body>
        </html>
      `);
    });
  }

  // Start the server
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running at http://0.0.0.0:${port}`);
  });

  // Set a longer timeout to give Cloud Run more time to initialize
  server.timeout = 120000; // 2 minutes

  // Handle graceful shutdown (Cloud Run sends SIGTERM)
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}
