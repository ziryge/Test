#!/bin/bash
# Script to set up the AI workspace directories

# Get the home directory
HOME_DIR=$(eval echo ~$USER)

# Create main AI workspace directory
AI_WORKSPACE="$HOME_DIR/workspace/ai_workspace"
echo "Creating AI workspace directory at: $AI_WORKSPACE"
mkdir -p "$AI_WORKSPACE"

# Create subdirectories
echo "Creating subdirectories..."
mkdir -p "$AI_WORKSPACE/screenshots"
mkdir -p "$AI_WORKSPACE/downloads"
mkdir -p "$AI_WORKSPACE/documents"
mkdir -p "$AI_WORKSPACE/code"
mkdir -p "$AI_WORKSPACE/data"
mkdir -p "$AI_WORKSPACE/temp"

# Create a README file
cat > "$AI_WORKSPACE/README.md" << EOF
# AI Workspace

This directory is used by the AI to store files, screenshots, and other data.

## Directory Structure

- **screenshots/**: Screenshots taken by the AI browser
- **downloads/**: Files downloaded by the AI
- **documents/**: Documents created or used by the AI
- **code/**: Code files created or used by the AI
- **data/**: Data files created or used by the AI
- **temp/**: Temporary files

## Usage

This workspace allows the AI to have persistent storage across sessions.
EOF

echo "AI workspace setup complete!"
echo "Workspace location: $AI_WORKSPACE"

# Set permissions
chmod -R 755 "$AI_WORKSPACE"

# Create a test file
echo "Creating a test file..."
cat > "$AI_WORKSPACE/test.txt" << EOF
This is a test file created by the AI workspace setup script.
If you can see this file, the AI workspace is working correctly.
EOF

echo "Done!"
