#!/bin/bash
# AERA Phase 1 Security Fixes - Deployment Script
# This script automates the deployment of Phase 1 security fixes

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }

# Banner
echo "=================================================="
echo "  AERA Phase 1: Critical Security Fixes"
echo "  Deployment Script v1.0"
echo "=================================================="
echo ""

# Step 1: Check prerequisites
info "Step 1: Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    error "Node.js is not installed"
    exit 1
fi
success "Node.js found: $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    error "npm is not installed"
    exit 1
fi
success "npm found: $(npm --version)"

# Check if we're in the right directory
if [ ! -f "server.js" ]; then
    error "server.js not found. Are you in the correct directory?"
    exit 1
fi
success "Project directory verified"

# Step 2: Backup existing files
info "Step 2: Creating backups..."

BACKUP_DIR="backups/phase1-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

cp server.js "$BACKUP_DIR/server.js.bak"
cp package.json "$BACKUP_DIR/package.json.bak"
cp models/user.js "$BACKUP_DIR/user.js.bak"

success "Backups created in $BACKUP_DIR"

# Step 3: Install new dependencies
info "Step 3: Installing security dependencies..."

npm install zod express-mongo-sanitize express-rate-limit --save

if [ $? -eq 0 ]; then
    success "Dependencies installed successfully"
else
    error "Failed to install dependencies"
    exit 1
fi

# Step 4: Check JWT_SECRET
info "Step 4: Checking JWT_SECRET..."

if [ -z "$JWT_SECRET" ]; then
    warning "JWT_SECRET not set in environment"
    info "Generating JWT_SECRET..."
    
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    
    echo ""
    echo "=================================================="
    echo "  IMPORTANT: Save this JWT_SECRET securely!"
    echo "=================================================="
    echo "JWT_SECRET=$JWT_SECRET"
    echo "=================================================="
    echo ""
    
    warning "Add this to your .env file before starting the server"
    
    # Optionally add to .env
    read -p "Add JWT_SECRET to .env file? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -f ".env" ]; then
            # Check if JWT_SECRET already exists
            if grep -q "JWT_SECRET=" .env; then
                warning "JWT_SECRET already exists in .env, not overwriting"
            else
                echo "" >> .env
                echo "# Phase 1 Security Fix - Added $(date)" >> .env
                echo "JWT_SECRET=$JWT_SECRET" >> .env
                success "JWT_SECRET added to .env"
            fi
        else
            echo "# AERA Environment Variables" > .env
            echo "JWT_SECRET=$JWT_SECRET" >> .env
            success ".env file created with JWT_SECRET"
        fi
    fi
else
    # Check length
    SECRET_LENGTH=${#JWT_SECRET}
    if [ $SECRET_LENGTH -lt 32 ]; then
        error "JWT_SECRET is too short ($SECRET_LENGTH chars). Minimum 32 characters required."
        info "Generate a new one with:"
        echo "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
        exit 1
    fi
    success "JWT_SECRET found and validated (length: $SECRET_LENGTH)"
fi

# Step 5: Deploy new server
info "Step 5: Deploying new server implementation..."

if [ -f "server-new.js" ]; then
    cp server-new.js server.js
    success "server.js updated with secured implementation"
else
    error "server-new.js not found!"
    info "Restoring from backup..."
    cp "$BACKUP_DIR/server.js.bak" server.js
    exit 1
fi

# Step 6: Verify file structure
info "Step 6: Verifying file structure..."

REQUIRED_FILES=(
    "middleware/auth.js"
    "middleware/validate.js"
    "validation/schemas.js"
    "models/user.js"
)

ALL_FILES_EXIST=true
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        error "Required file missing: $file"
        ALL_FILES_EXIST=false
    fi
done

if [ "$ALL_FILES_EXIST" = true ]; then
    success "All required files present"
else
    error "Some files are missing. Deployment incomplete."
    exit 1
fi

# Step 7: Run basic syntax check
info "Step 7: Running syntax check..."

node -c server.js
if [ $? -eq 0 ]; then
    success "server.js syntax valid"
else
    error "Syntax error in server.js"
    exit 1
fi

# Step 8: Display next steps
echo ""
echo "=================================================="
success "Phase 1 deployment preparation complete!"
echo "=================================================="
echo ""
info "Next steps:"
echo ""
echo "1. Review environment variables:"
echo "   - Ensure JWT_SECRET is set (32+ characters)"
echo "   - Verify MONGODB_URI is configured"
echo "   - Check FRONTEND_ORIGIN for CORS"
echo ""
echo "2. Start the server:"
echo "   npm run server"
echo ""
echo "3. Run the test suite:"
echo "   bash PHASE1_TEST_PLAN.md"
echo ""
echo "4. Monitor for these messages on startup:"
echo "   ✅ JWT_SECRET validated"
echo "   ✅ MongoDB connected"
echo "   ✅ AERA API listening"
echo ""
info "If any issues occur, restore from backup:"
echo "   cp $BACKUP_DIR/server.js.bak server.js"
echo "   cp $BACKUP_DIR/package.json.bak package.json"
echo "   cp $BACKUP_DIR/user.js.bak models/user.js"
echo ""
info "Documentation:"
echo "   - Implementation: PHASE1_IMPLEMENTATION_PLAN.md"
echo "   - Testing: PHASE1_TEST_PLAN.md"
echo "   - Deployment: PHASE1_DEPLOYMENT_CHECKLIST.md"
echo ""
echo "=================================================="

# Optional: Start server if user wants
echo ""
read -p "Start server now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    info "Starting server..."
    npm run server
fi
