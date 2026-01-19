#!/bin/bash

# APK Generator Web Setup Script
echo "🚀 Setting up APK Generator Web..."

# Check Node.js version
NODE_VERSION=$(node --version)
if [[ $NODE_VERSION != v18.* ]] && [[ $NODE_VERSION != v16.* ]] && [[ $NODE_VERSION != v14.* ]]; then
    echo "⚠️  Warning: Node.js version should be 14, 16, or 18"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check for required system tools
echo "🔧 Checking system requirements..."

# Check Git
if command -v git &> /dev/null; then
    echo "✓ Git is installed"
else
    echo "✗ Git is not installed. Please install Git first."
    exit 1
fi

# Check Java
if command -v java &> /dev/null; then
    echo "✓ Java is installed"
    java -version
else
    echo "⚠️  Java is not installed. APK builds may fail."
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p uploads builds downloads templates

# Set permissions
echo "🔐 Setting permissions..."
chmod -R 755 uploads builds downloads

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
PORT=3000
NODE_ENV=production
MAX_FILE_SIZE=52428800
UPLOAD_DIR=./uploads
BUILD_DIR=./builds
DOWNLOAD_DIR=./downloads
EOF
fi

echo "✅ Setup completed!"
echo ""
echo "To start the application:"
echo "1. Run: npm start"
echo "2. Open: http://localhost:3000"
echo ""
echo "For development:"
echo "1. Run: npm run dev"
echo ""
