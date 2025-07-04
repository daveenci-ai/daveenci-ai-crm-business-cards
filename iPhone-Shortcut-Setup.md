# 📱 iPhone Shortcut Setup Guide

## Overview
This guide shows you how to create an iPhone shortcut that captures business card images and uploads them to your GitHub repository, triggering the automated processing pipeline.

## Prerequisites
- GitHub Personal Access Token (PAT)
- GitHub repository for business card images
- Vercel serverless function deployed

## Step 1: Create GitHub Personal Access Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a name like "Business Card Upload"
4. Select scopes:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
5. Click "Generate token"
6. **Copy the token** - you'll need it for the shortcut

## Step 2: Create the iPhone Shortcut

### Basic Version (Simple Upload)

1. **Open Shortcuts app** on your iPhone
2. **Create New Shortcut**
3. **Add Actions** in this order:

#### Action 1: Take Photo
- Search for "Take Photo"
- Set options:
  - Camera: Back
  - Show Camera Roll: On
  - Show Preview: On

#### Action 2: Get Current Date
- Search for "Get Current Date"
- Format: Custom
- Format String: `yyyy-MM-dd-HH-mm-ss`

#### Action 3: Text
- Add this text:
```
{
  "message": "New business card added via iPhone shortcut",
  "content": ""
}
```

#### Action 4: Encode Media
- Input: Photo from Action 1
- Encoding: Base64

#### Action 5: Set Variable
- Name: `imageBase64`
- Value: Encoded Media from Action 4

#### Action 6: Set Variable
- Name: `timestamp`
- Value: Current Date from Action 2

#### Action 7: Get Contents of URL
- URL: `https://api.github.com/repos/YOUR_USERNAME/YOUR_REPO/contents/cards/{{timestamp}}.jpg`
- Method: PUT
- Headers:
  - `Authorization`: `token YOUR_GITHUB_PAT`
  - `Content-Type`: `application/json`
- Request Body: Text
- Body content:
```json
{
  "message": "New business card added via iPhone shortcut",
  "content": "{{imageBase64}}"
}
```

#### Action 8: Show Result
- Input: Contents of URL from Action 7

### Advanced Version (With Error Handling)

Add these additional actions after Action 7:

#### Action 8: If
- Input: Contents of URL from Action 7
- Condition: Has Any Value

#### Action 9: Show Alert
- Title: "Success!"
- Message: "Business card uploaded successfully. Processing will begin shortly."

#### Action 10: Otherwise
- (This runs if Action 8 fails)

#### Action 11: Show Alert
- Title: "Upload Failed"
- Message: "Failed to upload business card. Please try again."

## Step 3: Configure Your Repository

Replace these placeholders in the shortcut:

- `YOUR_USERNAME`: Your GitHub username
- `YOUR_REPO`: Your repository name (e.g., `daveenci-ai-crm-business-card-images`)
- `YOUR_GITHUB_PAT`: Your GitHub Personal Access Token

## Step 4: Test the Shortcut

1. **Run the shortcut**
2. **Take a photo** of a business card
3. **Check your GitHub repository** - you should see the image in the `cards/` folder
4. **Check your Telegram** - you should receive a notification with research

## Step 5: Add to Home Screen (Optional)

1. **Long press** the shortcut
2. **Select "Share"**
3. **Choose "Add to Home Screen"**
4. **Customize the icon and name**

## Troubleshooting

### Common Issues

1. **"Bad credentials" error**
   - Check your GitHub PAT is correct
   - Ensure the token has `repo` permissions

2. **"Repository not found" error**
   - Verify your repository name is correct
   - Ensure the repository exists and is accessible

3. **"Content already exists" error**
   - The timestamp ensures unique filenames
   - If this happens, try again (new timestamp will be generated)

4. **No Telegram notification**
   - Check your Vercel function is deployed
   - Verify webhook is configured in GitHub
   - Check Vercel logs for errors

### Debugging

1. **Check GitHub API response** in the shortcut result
2. **Monitor Vercel function logs** in your Vercel dashboard
3. **Check GitHub webhook deliveries** in repository settings

## Alternative: Manual Upload

If you prefer not to use the shortcut, you can:

1. **Take photos** with your camera
2. **Upload manually** to your GitHub repository
3. **Place images** in the `cards/` folder
4. **Commit and push** - this will trigger the webhook

## Security Notes

- **Keep your GitHub PAT secure** - don't share it
- **Use repository-specific tokens** if possible
- **Regularly rotate your tokens** for security
- **Monitor webhook deliveries** for any suspicious activity

## Next Steps

Once your shortcut is working:

1. **Test with real business cards**
2. **Monitor the research quality**
3. **Adjust Gemini prompts** if needed
4. **Customize Telegram notifications**
5. **Set up monitoring and alerts**

Your automated business card processing pipeline is now complete! 🚀 