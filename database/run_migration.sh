#!/bin/bash

# ShopCore MySQL Migration Runner
# Single command to run the complete database migration

# Database Configuration - Update these values
DB_HOST="localhost"
DB_PORT="3306"
DB_NAME="shopcore"
DB_USER="root"
DB_PASSWORD=""

# Schema File
SCHEMA_FILE="$(dirname "$0")/mysql_schema.sql"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "ShopCore MySQL Migration Runner"
echo "=========================================="
echo ""

# Check if schema file exists
if [ ! -f "$SCHEMA_FILE" ]; then
    echo -e "${RED}Error: Schema file not found at $SCHEMA_FILE${NC}"
    exit 1
fi

# Check if MySQL client is installed
if ! command -v mysql &> /dev/null; then
    echo -e "${RED}Error: MySQL client not found. Please install MySQL client.${NC}"
    exit 1
fi

# Prompt for database password if not set
if [ -z "$DB_PASSWORD" ]; then
    echo -e "${YELLOW}Enter MySQL password for user $DB_USER:${NC}"
    read -s DB_PASSWORD
    echo ""
fi

echo -e "${YELLOW}Running migration...${NC}"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "Schema File: $SCHEMA_FILE"
echo ""

# Run the migration
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$SCHEMA_FILE"

# Check exit status
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Migration completed successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Verify tables were created: mysql -u $DB_USER -p $DB_NAME -e 'SHOW TABLES;'"
    echo "2. Check seed data: mysql -u $DB_USER -p $DB_NAME -e 'SELECT COUNT(*) FROM public_subscription_plan_catalog;'"
    echo "3. Test application connectivity"
else
    echo ""
    echo -e "${RED}✗ Migration failed. Please check the error above.${NC}"
    exit 1
fi
