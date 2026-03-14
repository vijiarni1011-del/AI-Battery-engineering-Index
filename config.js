// ============================================================
// YANMAR DVP AUTOMATION — CONFIGURATION
// Edit this file with your own values before deploying
// ============================================================
window.DVP_CONFIG = {

  // n8n Webhook URL — replace with your WF-1 webhook trigger URL
  // In n8n: open WF-1 → change trigger from Manual to Webhook
  // Copy the "Production URL" shown in the Webhook node
  n8nWebhookUrl: 'https://YOUR-N8N-INSTANCE.app.n8n.cloud/webhook/dvp-intake',

  // Google Sheets ID for dashboard data
  // Create a Google Sheet, share it publicly (read-only)
  // Copy the ID from the URL: docs.google.com/spreadsheets/d/[THIS_ID]/
  googleSheetId: 'YOUR_GOOGLE_SHEET_ID',

  // Google Sheets API Key (free, read-only access)
  // Get from: console.cloud.google.com → APIs → Sheets API → Credentials
  googleApiKey: 'YOUR_GOOGLE_SHEETS_API_KEY',

  // Sheet tab names (must match exactly in your Google Sheet)
  sheetNames: {
    dvpItems:   'DVP_Items',    // All test items + status
    results:    'Results_Log',  // Pass/fail results per test
    projects:   'Projects'      // Project registry
  },

  // Approval webhook URL (for WF-2 approval form page)
  approvalWebhookUrl: 'https://YOUR-N8N-INSTANCE.app.n8n.cloud/webhook/dvp-approval',

  // Site metadata
  siteName:    'Yanmar DVP Automation',
  siteVersion: 'v2.0',
  company:     'Yanmar'

};
