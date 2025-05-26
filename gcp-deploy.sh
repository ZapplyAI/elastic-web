##!/bin/bash
#set -e
#
## Configuration
PROJECT_ID="elasticai-451101"
REGION="us-central1"
SERVICE_NAME="elasticapps"
#IMAGE_TAG="europe-west2-docker.pkg.dev/elasticai-451101/elastic-app/elastic-x@sha256:c6f62ae781f99114f599f4f8378d997e55d40106f61eb7c1476bfad14e1b112a"
REGISTRY_LOCATION="europe-west2"
REPOSITORY_NAME="elastic-app"
#
## Check if gcloud is installed
#if ! command -v gcloud &> /dev/null; then
#    echo "gcloud is not installed. Please install the Google Cloud SDK."
#    exit 1
#fi
#
## Check if user is logged in
#echo "Checking gcloud authentication..."
#if ! gcloud auth print-access-token &>/dev/null; then
#    echo "You need to login with gcloud first. Run 'gcloud auth login'"
#    exit 1
#fi
#
## Ensure the user has the necessary permissions
#echo "Checking if you have the necessary permissions..."
#if ! gcloud projects get-iam-policy $PROJECT_ID --format="json" | grep -q "\"roles/artifactregistry.admin\""; then
#    echo "Warning: You may not have the 'artifactregistry.admin' role required to modify IAM policies."
#    echo "You can ask your project administrator to grant you this role or use a service account with the necessary permissions."
#    echo "To continue anyway, press Enter. To exit, press Ctrl+C."
#    read -r
#fi
#
#
#
## Grant Cloud Run service account permission to access the Artifact Registry
##echo "Granting Cloud Run service account permission to access the Artifact Registry..."
##SERVICE_ACCOUNT=$(gcloud run services describe $SERVICE_NAME --region $REGION --format="value(spec.template.spec.serviceAccountName)")
##if [ -z "$SERVICE_ACCOUNT" ]; then
##  # If no custom service account is set, use the default Cloud Run service account
#  SERVICE_ACCOUNT="service-$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')@serverless-robot-prod.iam.gserviceaccount.com"
##fi
#
#gcloud artifacts repositories add-iam-policy-binding $REPOSITORY_NAME \
#  --location=$REGISTRY_LOCATION \
#  --member="serviceAccount:$SERVICE_ACCOUNT" \
#  --role="roles/artifactregistry.reader"
#
##echo "Permissions granted successfully."
##
##
##
##
##echo "Starting deployment to Google Cloud Run..."
### Deploy to Cloud Run
##echo "Deploying to Cloud Run..."
##gcloud run deploy $SERVICE_NAME \
##  --image $IMAGE_TAG \
##  --platform managed \
##  --region $REGION \
##  --allow-unauthenticated \
##  --memory 2Gi \
##  --cpu 1 \
##  --min-instances 1 \
##  --max-instances 2 \
##  --set-env-vars="NODE_ENV=production" \
##  --quiet
##
##echo "Deployment completed successfully."



#!/bin/bash

# --- Configuration ---
IMAGE_NAME="elastic-x"
REPOSITORY_NAME="elastic-app"
IMAGE_TAG="latest"
RUNTIME_ACCOUNT="cloud-run-sa@$PROJECT_ID.iam.gserviceaccount.com"

# Fully-qualified Artifact Registry image path
IMAGE_URL="$REGISTRY_LOCATION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY_NAME/$IMAGE_NAME:$IMAGE_TAG"

# --- Enable required APIs ---
gcloud services enable run.googleapis.com \
    artifactregistry.googleapis.com \
    iam.googleapis.com

# --- Create service account for Cloud Run ---
gcloud iam service-accounts create cloud-run-sa \
    --project="$PROJECT_ID" \
    --display-name="Cloud Run Service Account"

# --- Grant Artifact Registry access to service account ---
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$RUNTIME_ACCOUNT" \
    --role="roles/artifactregistry.reader"

# Build the Docker image
echo "Building Docker image..."
docker build -t $IMAGE_NAME .

# Push the image to Artifact Registry
echo "Pushing image to Artifact Registry..."
docker push $IMAGE_NAME

# --- Deploy to Cloud Run ---
gcloud run deploy "$SERVICE_NAME" \
    --image="$IMAGE_URL" \
    --region="$REGION" \
    --platform=managed \
    --service-account="$RUNTIME_ACCOUNT" \
    --allow-unauthenticated \
    --project="$PROJECT_ID" \
    --memory 2Gi \
    --cpu 1 \
    --min-instances 1 \
    --max-instances 2 \
    --set-env-vars="NODE_ENV=production"
