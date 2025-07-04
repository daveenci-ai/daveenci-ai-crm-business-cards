#!/bin/bash

# Business Card Image Processing Script
# This script is called by the GitHub webhook when new images are uploaded
# Usage: ./process-image.sh "path/to/image.jpg"

IMAGE_PATH=$1

# Configuration
IMAGE_REPO="daveenci-ai/daveenci-ai-crm-business-card-images"
LOG_FILE="/tmp/image-processing.log"

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_message "🚀 Processing script started for: $IMAGE_PATH"

# Validate input
if [ -z "$IMAGE_PATH" ]; then
    log_message "❌ Error: No image path provided"
    exit 1
fi

# Construct the URL to the raw image file on GitHub
RAW_URL="https://raw.githubusercontent.com/${IMAGE_REPO}/main/${IMAGE_PATH}"
log_message "📡 Raw image URL: $RAW_URL"

# Create a temporary directory on the server to work in
TEMP_DIR=$(mktemp -d)
FILENAME=$(basename "$IMAGE_PATH")
LOCAL_FILE_PATH="$TEMP_DIR/$FILENAME"

log_message "📁 Temp directory: $TEMP_DIR"
log_message "📄 Local file path: $LOCAL_FILE_PATH"

# Download the image
log_message "⬇️  Downloading image from GitHub..."
curl -L -o "$LOCAL_FILE_PATH" "$RAW_URL" --max-time 30

# Check if download was successful
if [ ! -f "$LOCAL_FILE_PATH" ]; then
    log_message "❌ Error: Failed to download image from $RAW_URL"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Check file size
FILE_SIZE=$(stat -c%s "$LOCAL_FILE_PATH" 2>/dev/null || stat -f%z "$LOCAL_FILE_PATH" 2>/dev/null)
log_message "📊 Downloaded file size: $FILE_SIZE bytes"

if [ "$FILE_SIZE" -lt 1000 ]; then
    log_message "❌ Error: Downloaded file is too small (likely failed download)"
    rm -rf "$TEMP_DIR"
    exit 1
fi

log_message "✅ Image downloaded successfully"

# --- BUSINESS CARD PROCESSING LOGIC ---
# This is where you would integrate with your business card processing system

log_message "🤖 Starting business card processing..."

# Option 1: If you have a Python OCR script
# python3 /path/to/your/ocr_script.py --input "$LOCAL_FILE_PATH" --output-format json

# Option 2: If you have a Node.js processing script
# node /path/to/your/card-processor.js "$LOCAL_FILE_PATH"

# Option 3: Call your existing API endpoint with the image
# This would require encoding the image and sending it to your /process-card endpoint

# For now, we'll create a placeholder that simulates processing
log_message "🔄 Simulating business card OCR processing..."
sleep 2

# Simulate extracted data (in real implementation, this would come from OCR)
EXTRACTED_DATA='{
    "name": "John Smith",
    "company": "Tech Corp",
    "email": "john@techcorp.com",
    "phone": "555-123-4567",
    "industry": "Technology",
    "website": "techcorp.com",
    "source": "GitHub Image Upload",
    "notes": "Processed from: '"$IMAGE_PATH"'"
}'

log_message "📋 Extracted data: $EXTRACTED_DATA"

# Send to your process-card endpoint
# Note: You'll need to configure the API endpoint and authentication
API_ENDPOINT="https://your-app-url.com/process-card"
JWT_TOKEN="your-jwt-token-here"

log_message "📤 Sending extracted data to CRM..."

# Uncomment and configure this section when ready to use
# curl -X POST "$API_ENDPOINT" \
#   -H "Content-Type: application/json" \
#   -H "Authorization: Bearer $JWT_TOKEN" \
#   -d "$EXTRACTED_DATA" \
#   --max-time 30

log_message "✅ Business card processing completed"

# --- END OF PROCESSING LOGIC ---

# Clean up temporary files
rm -rf "$TEMP_DIR"
log_message "🧹 Cleaned up temporary files"

log_message "🎉 Processing finished successfully for: $IMAGE_PATH"

# Optional: Send notification about completion
if [ ! -z "$TELEGRAM_BOT_TOKEN" ] && [ ! -z "$TELEGRAM_CHAT_ID" ]; then
    MESSAGE="✅ Business card processed successfully!\n\n📁 File: $IMAGE_PATH\n🤖 Extracted contact data and saved to CRM\n\n⏰ $(date)"
    curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
        -d "chat_id=$TELEGRAM_CHAT_ID" \
        -d "text=$MESSAGE" \
        -d "parse_mode=HTML" > /dev/null
fi

exit 0 