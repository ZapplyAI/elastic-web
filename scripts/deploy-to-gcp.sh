#!/bin/bash
# Script to deploy Elastic App to Google Cloud Platform

set -e

# Default values
PROJECT_ID=""
REGION="us-central1"
SERVICE_NAME="elasticApp-ai"
IMAGE_NAME="elasticApp-ai"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    --project)
      PROJECT_ID="$2"
      shift
      shift
      ;;
    --region)
      REGION="$2"
      shift
      shift
      ;;
    --service-name)
      SERVICE_NAME="$2"
      shift
      shift
      ;;
    --help)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  --project PROJECT_ID    GCP project ID (required)"
      echo "  --region REGION         GCP region (default: us-central1)"
      echo "  --service-name NAME     Cloud Run service name (default: elasticApp-ai)"
      echo "  --help                  Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Check if project ID is provided
if [ -z "$PROJECT_ID" ]; then
  echo "Error: Project ID is required. Use --project to specify."
  exit 1
fi

# Set the GCP project
echo "Setting GCP project to $PROJECT_ID..."
gcloud config set project "$PROJECT_ID"

# Enable required services
echo "Enabling required GCP services..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com

# Check if .env.local exists
if [ ! -f .env.local ]; then
  echo "Warning: .env.local file not found. You'll need to set up environment variables manually in GCP."
else
  echo "Creating secrets from .env.local file..."
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip empty lines and comments
    if [[ -z "$line" || "$line" =~ ^# ]]; then
      continue
    fi

    # Extract key and value
    key=$(echo "$line" | cut -d= -f1)
    value=$(echo "$line" | cut -d= -f2-)

    # Remove quotes if present
    value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")

    # Create secret if it doesn't exist
    if ! gcloud secrets describe "$key" &>/dev/null; then
      echo "Creating secret for $key..."
      echo -n "$value" | gcloud secrets create "$key" --data-file=-
    else
      echo "Secret $key already exists. Updating..."
      echo -n "$value" | gcloud secrets versions add "$key" --data-file=-
    fi
  done < .env.local
fi

# Build the Docker image
echo "Building Docker image..."
docker build -t "gcr.io/$PROJECT_ID/$IMAGE_NAME:latest" --target elasticApp-ai-production .

# Push the image to Container Registry
echo "Pushing image to Container Registry..."
docker push "gcr.io/$PROJECT_ID/$IMAGE_NAME:latest"

# Get the project number for service account permissions
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
SERVICE_ACCOUNT="service-$PROJECT_NUMBER@serverless-robot-prod.iam.gserviceaccount.com"

# Grant permissions to secrets
echo "Granting Cloud Run service account access to secrets..."
for secret in $(gcloud secrets list --format="value(name)"); do
  echo "Granting access to $secret..."
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor"
done

# Prepare the secrets string for Cloud Run
SECRETS_STRING=""
for secret in $(gcloud secrets list --format="value(name)"); do
  if [ -n "$SECRETS_STRING" ]; then
    SECRETS_STRING="$SECRETS_STRING,"
  fi
  SECRETS_STRING="$SECRETS_STRING$secret=$secret:latest"
done

# Deploy to Cloud Run
echo "Deploying to Cloud Run in $REGION..."
gcloud run deploy "$SERVICE_NAME" \
  --image "gcr.io/$PROJECT_ID/$IMAGE_NAME:latest" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 5173 \
  --memory 2Gi \
  --cpu 1 \
  --set-env-vars NODE_ENV=production \
  --update-secrets "$SECRETS_STRING"

# Get the deployed service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format="value(status.url)")

echo "Deployment complete!"
echo "Your application is available at: $SERVICE_URL"
