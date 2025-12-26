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
cp $SERVER_DIR/dns.js $DEPLOY_DIR/
cp $SERVER_DIR/cpanel_dns.js $DEPLOY_DIR/
cp $SERVER_DIR/sync_all_dns.js $DEPLOY_DIR/

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

# 5. Create .htaccess
echo "📝 Creating .htaccess..."
# Note: cPanel's Node.js selector creates its own rules, but this ensures HTTPS
cat > $DEPLOY_DIR/.htaccess << EOL
<IfModule mod_rewrite.c>
  RewriteEngine On
  
  # Force HTTPS
  RewriteCond %{HTTPS} off
  RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

  # Security Headers
  <IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
    Header set X-XSS-Protection "1; mode=block"
  </IfModule>
</IfModule>
EOL

echo "✅ Preparation Complete!"
echo "---------------------------------------------------"
echo "Instructions:"
echo "1. Go to the '$DEPLOY_DIR' folder."
echo "2. Compress all files inside it (Zip the *contents*, not the folder itself)."
echo "3. Upload the zip to your domain folder on Namecheap."
echo "4. Follow the instructions in 'deployment_instructions.md'."
echo "---------------------------------------------------"
