#!/bin/bash
set -e

# Configuration
PROJECT_ID="elastic-x"
REGION="us-central1"
SERVICE_NAME="elasticapp"

echo "Starting deployment to Cloud Run..."

# Make server.js executable
echo "Ensuring server.js is present..."
if [ ! -f "server.js" ]; then
  echo "Error: server.js not found!"
  exit 1
fi

# First build the application
echo "Building the application..."
pnpm run build

# Deploy directly from source
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
  --port=8080 \
  --timeout=300s \
  --set-env-vars="NODE_ENV=production" \
  --quiet

echo "Setting IAM policy for public access..."
gcloud run services add-iam-policy-binding $SERVICE_NAME \
  --region=$REGION \
  --member="allUsers" \
  --role="roles/run.invoker"

# Get the URL of the deployed service
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format='value(status.url)')

echo "Deployment complete!"
echo "Your application is available at: $SERVICE_URL"
