#!/bin/bash

# Prompt user for new project prefix
read -rp "Enter the new project prefix: " input_prefix

# Normalize the prefix: replace spaces and dashes with underscores, then convert to uppercase
new_prefix=$(echo "$input_prefix" | tr '[:lower:]' '[:upper:]' | sed -E 's/[ -]+/_/g')

# Check if the prefix is non-empty after normalization
if [ -z "$new_prefix" ]; then
  echo "Error: Prefix cannot be empty."
  exit 1
fi

# Define files to modify
files=(".env-dist" "Makefile" "docker-compose.yaml")

# Replace the string FLASK_TEMPLATE_ with the new prefix in each file
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    sed -i "s/FLASK_TEMPLATE_/${new_prefix}/g" "$file"
    echo "Updated $file"
  else
    echo "Error: $file not found. Aborting."
    exit 1
  fi
done

echo "Prefix replacement complete. Removing setup script."

# Remove the script itself after successful execution
rm -- "$0"
