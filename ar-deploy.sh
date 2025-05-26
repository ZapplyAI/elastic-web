#!/bin/bash
set -e

# Configuration
PROJECT_ID="elastic-x"
REGION="us-central1"
SERVICE_NAME="elasticapp"
REPO_NAME="elasticapp-repo"
IMAGE_TAG="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$SERVICE_NAME:latest"

echo "Starting deployment to Google Cloud Run using Artifact Registry..."

# Build the Docker image locally
echo "Building Docker image..."
docker build -t $IMAGE_TAG .

# Push the image to Artifact Registry
echo "Pushing image to Artifact Registry..."
docker push $IMAGE_TAG

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_TAG \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars="NODE_ENV=production" \
  --quiet

echo "Deployment completed successfully."
