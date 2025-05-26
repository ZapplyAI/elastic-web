#!/bin/bash
set -e

# Configuration
PROJECT_ID="elastic-x"
REGION="us-central1"
REPO_NAME="elasticapp-repo"
REPO_FORMAT="docker"

echo "Setting up Artifact Registry repository..."

# Enable Artifact Registry API
gcloud services enable artifactregistry.googleapis.com

# Create a repository if it doesn't exist
if ! gcloud artifacts repositories describe $REPO_NAME --location=$REGION &>/dev/null; then
  echo "Creating repository $REPO_NAME in $REGION..."
  gcloud artifacts repositories create $REPO_NAME \
    --repository-format=$REPO_FORMAT \
    --location=$REGION \
    --description="Repository for ElasticApp Docker images"
else
  echo "Repository $REPO_NAME already exists in $REGION"
fi

# Configure Docker to use gcloud credentials
gcloud auth configure-docker $REGION-docker.pkg.dev

echo "Artifact Registry setup complete!"
echo "You can now push images to: $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/elasticapp:latest"
