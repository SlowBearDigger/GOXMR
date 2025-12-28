#!/bin/bash

# Configuration
DEPLOY_DIR="deploy"
SERVER_DIR="server"

echo "🚀 Starting Deployment Preparation..."

# 1. Clean previous build
echo "🧹 Cleaning up..."
rm -rf $DEPLOY_DIR
mkdir $DEPLOY_DIR

# 2. Build Frontend
echo "🏗️  Building Frontend..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed."
    exit 1
fi

# 3. Copy Server Files
echo "📂 Copying Server Files..."
cp $SERVER_DIR/package.json $DEPLOY_DIR/
cp $SERVER_DIR/index.js $DEPLOY_DIR/
cp $SERVER_DIR/db.js $DEPLOY_DIR/
cp $SERVER_DIR/monero_monitor.js $DEPLOY_DIR/
cp $SERVER_DIR/migrate*.js $DEPLOY_DIR/

# Create a clean .env file (DO NOT COPY LOCAL SECRETS)
echo "🔒 Creating template .env..."
cat > $DEPLOY_DIR/.env << EOL
NODE_ENV=production
PORT=3000
# JWT_SECRET=  <-- Add this in cPanel
# MONERO_WALLET_RPC_URL= <-- Add this in cPanel
EOL

# 4. Copy Frontend Build
echo "📦 Copying Frontend Assets..."
cp -r dist $DEPLOY_DIR/dist

# 5. Zip everything
echo "🤐 Creating Deployment Zip..."
cd $DEPLOY_DIR
zip -r ../goxmr_deploy_v1.zip .
cd ..

echo "✅ Preparation Complete!"
echo "---------------------------------------------------"
echo "Instructions for Shared Hosting (Namecheap):"
echo "1. DELETE ALL FILES in your domain folder on the server (inc. hidden files)."
echo "2. Upload 'goxmr_deploy_v1.zip' and Extract it."
echo "3. Go to cPanel -> Setup Node.js App."
echo "4. Application Startup File: index.js"
echo "5. Click 'Run NPM Install' and then 'Restart'."
echo "---------------------------------------------------"
