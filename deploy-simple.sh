#!/bin/bash
set -e

# Configuration
PROJECT_ID="elastic-x"
REGION="us-central1"
SERVICE_NAME="elasticapp"

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

# Enable required services
echo "Enabling required services..."
gcloud services enable artifactregistry.googleapis.com cloudrun.googleapis.com cloudbuild.googleapis.com

# Set necessary permissions
echo "Setting necessary permissions..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
    --role="roles/run.invoker"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
    --role="roles/logging.logWriter"

# Deploy directly from source code
echo "Deploying to Cloud Run from source..."
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
  --quiet

# Add IAM policy binding for public access
echo "Setting public access..."
gcloud run services add-iam-policy-binding $SERVICE_NAME \
  --region=$REGION \
  --member="allUsers" \
  --role="roles/run.invoker"

# Get the deployed service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format='value(status.url)')

echo "Deployment complete!"
echo "Your application is now available at: $SERVICE_URL"
