# 1. Use an official Node.js runtime as a parent image
FROM node:18 AS base
# No need for libc6-compat on Debian-based image
# RUN apk add --no-cache libc6-compat

# Set the working directory in the container
WORKDIR /app

# Install dependencies stage
FROM base AS deps
# Install pnpm globally
RUN npm install -g pnpm
# Copy package.json and lock file
COPY package.json pnpm-lock.yaml ./
# Install dependencies using pnpm
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS build
# Install pnpm globally (needed again for RUN command)
RUN npm install -g pnpm
# Install git needed for build steps (use apt-get for Debian)
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
# Copy installed dependencies
COPY --from=deps /app/node_modules /app/node_modules
# Copy the rest of the application code
COPY . .
# Build the Remix app using pnpm
RUN pnpm run build

# Production stage
FROM base AS production
ENV NODE_ENV=production
# Install pnpm globally (needed for CMD)
RUN npm install -g pnpm
# Copy built app and dependencies
COPY --from=build /app/build /app/build
COPY --from=build /app/public /app/public
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app/package.json

# Expose the port the app runs on (Cloud Run often expects 8080)
# The start:gcp script will use the PORT env var provided by Cloud Run.
EXPOSE 8080

# Command to run the application using the specific GCP start script
CMD ["pnpm", "run", "start:gcp"]
# europe west 2