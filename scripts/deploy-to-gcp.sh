#!/bin/bash
set -e

# Configuration
PROJECT_ID="elastic-x"
REGION="us-central1"
SERVICE_NAME="elasticapp"
DOCKERFILE_PATH="./Dockerfile"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "gcloud is not installed. Please install the Google Cloud SDK."
    exit 1
fi

# Check if user is logged in
if ! gcloud auth print-identity-token &> /dev/null; then
    echo "You are not logged in to gcloud. Please run 'gcloud auth login'."
    exit 1
fi

# Build the container image using Cloud Build
echo "Building container image with Cloud Build..."
gcloud builds submit --config=./cloud-build.yaml .

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars="NODE_ENV=production" \
  --quiet

# Get the deployed service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format='value(status.url)')

echo "Deployment complete!"
echo "Your application is now available at: $SERVICE_URL"
