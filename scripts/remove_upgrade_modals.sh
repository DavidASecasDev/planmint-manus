#!/bin/bash
# Remove UpgradeModal imports and JSX from settings components
# This is a batch operation - we'll use sed to remove the patterns

FILES=(
  "client/src/components/settings/AuditLogsSection.tsx"
  "client/src/components/settings/DataExportSection.tsx"
  "client/src/components/settings/IntegrationSettingsSection.tsx"
  "client/src/components/settings/NotificationPreferencesSection.tsx"
  "client/src/components/settings/RolesSection.tsx"
  "client/src/components/settings/SecuritySettingsSection.tsx"
  "client/src/components/settings/SessionsSection.tsx"
)

for f in "${FILES[@]}"; do
  echo "Processing: $f"
  # Remove import line for UpgradeModal
  sed -i "/import.*UpgradeModal.*from/d" "$f"
  # Remove import of useSubscription
  sed -i "/import.*useSubscription.*from/d" "$f"
  # Remove import of PlanType
  sed -i "/import.*PlanType.*from.*subscription/d" "$f"
done

echo "Done removing imports"
