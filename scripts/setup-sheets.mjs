// Setup script: creates the Google Sheet and Drive folder for SHD Kanban
// Run with: node scripts/setup-sheets.mjs

import fs from 'fs'
import https from 'https'

const CREDENTIALS_PATH = 'C:/Users/shdop/.config/google-drive-mcp/gcp-oauth.keys.json'
const TOKENS_PATH      = 'C:/Users/shdop/.config/google-drive-mcp/tokens.json'

const creds  = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8')).installed
const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'))

// ── HTTP helper ───────────────────────────────────────────────────────────────
function request(method, hostname, path, body, accessToken) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null
    const options = {
      method, hostname, path,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }
    const req = https.request(options, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data))
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        }
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

// ── Refresh token if expired ──────────────────────────────────────────────────
async function getAccessToken() {
  const now = Date.now()
  if (tokens.expiry_date && tokens.expiry_date > now + 60000) {
    return tokens.access_token
  }
  console.log('Refreshing access token...')
  const body = new URLSearchParams({
    client_id:     creds.client_id,
    client_secret: creds.client_secret,
    refresh_token: tokens.refresh_token,
    grant_type:    'refresh_token',
  }).toString()

  const refreshed = await new Promise((resolve, reject) => {
    const req = https.request({
      method: 'POST',
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(JSON.parse(data)))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })

  tokens.access_token = refreshed.access_token
  tokens.expiry_date  = Date.now() + (refreshed.expires_in * 1000)
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2))
  return tokens.access_token
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const token = await getAccessToken()

  // 1. Create the spreadsheet with 4 sheets
  console.log('Creating spreadsheet...')
  const spreadsheet = await request(
    'POST', 'sheets.googleapis.com', '/v4/spreadsheets', {
      properties: { title: 'SHD Kanban - Project Tracker' },
      sheets: [
        { properties: { title: 'Projects',  sheetId: 0 } },
        { properties: { title: 'Subtasks',  sheetId: 1 } },
        { properties: { title: 'Images',    sheetId: 2 } },
        { properties: { title: 'Config',    sheetId: 3 } },
      ],
    }, token
  )
  const spreadsheetId = spreadsheet.spreadsheetId
  console.log(`✓ Spreadsheet created: https://docs.google.com/spreadsheets/d/${spreadsheetId}`)

  // 2. Write headers to each sheet
  console.log('Writing headers...')
  const headers = {
    'Projects!A1:R1': [[
      'projectId','stage','customerName','projectTitle','phone','email',
      'projectType','description','notes',
      'quotedAmount','depositPaid','balanceDue',
      'dateReceived','startDate','targetDate','lastUpdated',
      'assignee','sortOrder',
    ]],
    'Subtasks!A1:H1': [[
      'subtaskId','projectId','title','status','assignee','dueDate','createdAt','lastUpdated',
    ]],
    'Images!A1:G1': [[
      'imageId','projectId','fileName','driveUrl','driveFileId','uploadedAt','uploadedBy',
    ]],
    'Config!A1:B1': [['key','value']],
  }

  await request(
    'POST',
    'sheets.googleapis.com',
    `/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      valueInputOption: 'RAW',
      data: Object.entries(headers).map(([range, values]) => ({ range, values })),
    },
    token
  )
  console.log('✓ Headers written')

  // 3. Add Config seed data
  console.log('Adding config rows...')
  await request(
    'POST',
    'sheets.googleapis.com',
    `/v4/spreadsheets/${spreadsheetId}/values/Config!A2:B3:append?valueInputOption=RAW`,
    { values: [['driveFolderId','REPLACE_WITH_FOLDER_ID'], ['version','1.0']] },
    token
  )

  // 4. Bold and freeze header rows
  console.log('Formatting headers...')
  const sheetIds = { Projects: 0, Subtasks: 1, Images: 2, Config: 3 }
  const requests = Object.values(sheetIds).flatMap(sheetId => [
    // Freeze row 1
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    // Bold row 1
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: 'userEnteredFormat.textFormat.bold',
      },
    },
  ])

  await request(
    'POST',
    'sheets.googleapis.com',
    `/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    { requests },
    token
  )
  console.log('✓ Headers formatted and frozen')

  // 5. Create Google Drive folder
  console.log('Creating Drive folder...')
  const folder = await request(
    'POST', 'www.googleapis.com', '/drive/v3/files',
    { name: 'SHD-Kanban-Images', mimeType: 'application/vnd.google-apps.folder' },
    token
  )
  const folderId = folder.id
  console.log(`✓ Drive folder created (ID: ${folderId})`)

  // 6. Write folder ID into Config sheet
  await request(
    'PUT',
    'sheets.googleapis.com',
    `/v4/spreadsheets/${spreadsheetId}/values/Config!B2?valueInputOption=RAW`,
    { values: [[folderId]] },
    token
  )
  console.log('✓ Folder ID saved to Config tab')

  console.log('\n════════════════════════════════════════')
  console.log('✅ Setup complete!')
  console.log(`📊 Spreadsheet: https://docs.google.com/spreadsheets/d/${spreadsheetId}`)
  console.log(`📁 Drive folder ID: ${folderId}`)
  console.log('════════════════════════════════════════')
  console.log('\nNext steps:')
  console.log('1. Open the spreadsheet and verify the tabs look correct')
  console.log('2. Paste Code.gs into Apps Script from the sheet (Extensions → Apps Script)')
  console.log('3. Deploy as Web App and copy the URL')
}

main().catch(console.error)
