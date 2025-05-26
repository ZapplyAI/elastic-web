#!/bin/bash
set -e

# Configuration
PROJECT_ID="elastic-x"
REGION="us-central1"
SERVICE_NAME="elasticapp"

echo "Starting direct deployment to Cloud Run with serverless approach..."

# Step 1: Create a temp directory
TEMP_DIR=$(mktemp -d)
echo "Created temporary directory: $TEMP_DIR"

# Step 2: Copy necessary files
echo "Copying project files..."
cp -r build $TEMP_DIR/
cp package.json $TEMP_DIR/
cp pnpm-lock.yaml $TEMP_DIR/
cp -r public $TEMP_DIR/
cp .env.production $TEMP_DIR/

# Step 3: Create a new server.js file
echo "Creating server.js file..."
cat > $TEMP_DIR/server.js << 'EOF'
const express = require('express');
const path = require('path');
const fs = require('fs');

// Create Express app
const app = express();

// Get port from environment variable (Cloud Run sets PORT)
const port = process.env.PORT || 8080;

console.log('Starting server.js...');
console.log(`PORT: ${port}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`Current directory: ${__dirname}`);

// List directory contents for debugging
try {
  console.log(`Files in current directory: ${fs.readdirSync(__dirname).join(', ')}`);

  // Check if build directory exists
  if (fs.existsSync(path.join(__dirname, 'build'))) {
    console.log(`Files in build directory: ${fs.readdirSync(path.join(__dirname, 'build')).join(', ')}`);

    // Check if client directory exists
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

// Health check endpoint
app.get('/_health', (req, res) => {
  res.status(200).send('OK');
});

// Serve static files from the client build directory
const clientBuildPath = path.join(__dirname, 'build', 'client');
if (fs.existsSync(clientBuildPath)) {
  console.log(`Serving static files from: ${clientBuildPath}`);
  app.use(express.static(clientBuildPath));

  // Handle all other routes by serving index.html
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

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
EOF

# Step 4: Create a custom package.json for deployment
echo "Creating simplified package.json..."
cat > $TEMP_DIR/package.json << EOF
{
  "name": "elasticapp",
  "version": "1.0.0",
  "private": true,
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "engines": {
    "node": ">=18"
  }
}
EOF

# Step 5: Create a simple Dockerfile
echo "Creating Dockerfile..."
cat > $TEMP_DIR/Dockerfile << 'EOF'
FROM node:18-slim

WORKDIR /app
COPY package.json ./
RUN npm install --production

COPY . .

ENV PORT=8080
ENV HOST=0.0.0.0
EXPOSE 8080

CMD ["node", "server.js"]
EOF

# Step 6: Move to the temp directory and deploy
echo "Moving to temporary directory and deploying..."
cd $TEMP_DIR

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars="NODE_ENV=production" \
  --timeout=300s \
  --quiet

# Get the deployed service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format='value(status.url)')

# Clean up
cd - > /dev/null
echo "Cleaning up temporary directory..."
rm -rf $TEMP_DIR

echo "Deployment complete!"
echo "Your application is now available at: $SERVICE_URL"
