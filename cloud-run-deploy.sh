#!/bin/bash
set -e

# Configuration
PROJECT_ID="elastic-x"
REGION="us-central1"
SERVICE_NAME="elasticapp"
IMAGE_NAME="$REGION-docker.pkg.dev/$PROJECT_ID/elasticapp-repo/$SERVICE_NAME:latest"

echo "Starting deployment to Cloud Run..."
echo "Using project: $PROJECT_ID in region: $REGION"

# Build the Docker image
echo "Building Docker image..."
docker build -t $IMAGE_NAME -f Dockerfile --target elasticApp-production .

# Push the image to Artifact Registry
echo "Pushing image to Artifact Registry..."
docker push $IMAGE_NAME

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --memory 4Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --port=8080 \
  --timeout=300s \
  --set-env-vars="NODE_ENV=production" \
  --quiet

# Get the URL of the deployed service
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format='value(status.url)')

echo "Deployment complete!"
echo "Your application is available at: $SERVICE_URL"
echo ""
echo "Note: Due to organization policies, the service may not be publicly accessible."
echo "To access it, you may need to be authenticated with gcloud or use IAM permissions."
echo "You can test the service with:"
echo "  curl -H \"Authorization: Bearer \$(gcloud auth print-identity-token)\" $SERVICE_URL"
