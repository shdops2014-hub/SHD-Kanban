// ════════════════════════════════════════════════════════════════════════════
// SHD Kanban — Google Apps Script Backend
// Deploy as: Web App > Execute as: Me > Anyone can access
// ════════════════════════════════════════════════════════════════════════════

const SS = SpreadsheetApp.getActiveSpreadsheet();

// ── Sheets ───────────────────────────────────────────────────────────────────
function getSheet(name) { return SS.getSheetByName(name); }

// ── Config ────────────────────────────────────────────────────────────────────
function getConfig(key) {
  const sheet = getSheet('Config');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return null;
}

// ── UUID generator ────────────────────────────────────────────────────────────
function uuid(prefix) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = prefix + '_';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────
function doGet(e) {
  const action = e.parameter.action;
  let result;
  try {
    if (action === 'getProjects') result = getProjects();
    else if (action === 'getProject') result = getProject(e.parameter.projectId);
    else if (action === 'ping') result = { status: 'ok', timestamp: new Date().toISOString() };
    else result = { error: 'Unknown action: ' + action };
  } catch (err) {
    result = { error: err.message };
  }
  return jsonResponse(result);
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return jsonResponse({ error: 'Invalid JSON body' }); }

  let result;
  try {
    const action = body.action;
    if      (action === 'createProject')  result = createProject(body);
    else if (action === 'updateProject')  result = updateProject(body);
    else if (action === 'deleteProject')  result = deleteProject(body.projectId);
    else if (action === 'createSubtask')  result = createSubtask(body);
    else if (action === 'updateSubtask')  result = updateSubtask(body);
    else if (action === 'deleteSubtask')  result = deleteSubtask(body.subtaskId);
    else if (action === 'uploadImage')    result = uploadImage(body);
    else if (action === 'deleteImage')    result = deleteImageAction(body.imageId);
    else result = { error: 'Unknown action: ' + action };
  } catch (err) {
    result = { error: err.message };
  }
  return jsonResponse(result);
}

function jsonResponse(data) {
  const success = !data.error;
  const payload = success ? { success: true, data: data } : { success: false, error: data.error };
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// ════════════════════════════════════════════════════════════════════════════
// PROJECTS
// ════════════════════════════════════════════════════════════════════════════

const PROJECT_COLS = [
  'projectId','stage','customerName','projectTitle','phone','email',
  'projectType','description','notes',
  'quotedAmount','depositPaid','balanceDue',
  'dateReceived','startDate','targetDate','lastUpdated',
  'assignee','sortOrder'
];

function rowToProject(row) {
  const obj = {};
  PROJECT_COLS.forEach((col, i) => { obj[col] = row[i] !== undefined ? row[i] : ''; });
  obj.quotedAmount = parseFloat(obj.quotedAmount) || 0;
  obj.depositPaid  = parseFloat(obj.depositPaid)  || 0;
  obj.balanceDue   = parseFloat(obj.balanceDue)   || 0;
  obj.sortOrder    = parseInt(obj.sortOrder)       || 0;
  return obj;
}

function getProjects() {
  const sheet = getSheet('Projects');
  const values = sheet.getDataRange().getValues().slice(1); // skip header
  const subtaskSheet = getSheet('Subtasks');
  const imageSheet   = getSheet('Images');

  const subtaskValues = subtaskSheet.getDataRange().getValues().slice(1);
  const imageValues   = imageSheet.getDataRange().getValues().slice(1);

  // Count subtasks and images per project
  const subtaskCounts = {};
  subtaskValues.forEach(r => {
    const pid = r[1];
    subtaskCounts[pid] = (subtaskCounts[pid] || 0) + 1;
  });
  const imageCounts = {};
  imageValues.forEach(r => {
    const pid = r[1];
    imageCounts[pid] = (imageCounts[pid] || 0) + 1;
  });

  return values
    .filter(r => r[0]) // skip empty rows
    .map(r => {
      const p = rowToProject(r);
      p.subtaskCount = subtaskCounts[p.projectId] || 0;
      p.imageCount   = imageCounts[p.projectId]   || 0;
      return p;
    });
}

function getProject(projectId) {
  const sheet = getSheet('Projects');
  const values = sheet.getDataRange().getValues().slice(1);
  const row = values.find(r => r[0] === projectId);
  if (!row) throw new Error('Project not found: ' + projectId);

  const project = rowToProject(row);

  // Subtasks
  const subtaskSheet = getSheet('Subtasks');
  const subtaskValues = subtaskSheet.getDataRange().getValues().slice(1);
  project.subtasks = subtaskValues
    .filter(r => r[1] === projectId)
    .map(r => ({
      subtaskId: r[0], projectId: r[1], title: r[2],
      status: r[3], assignee: r[4], dueDate: r[5],
      createdAt: r[6], lastUpdated: r[7]
    }));

  // Images
  const imageSheet = getSheet('Images');
  const imageValues = imageSheet.getDataRange().getValues().slice(1);
  project.images = imageValues
    .filter(r => r[1] === projectId)
    .map(r => ({
      imageId: r[0], projectId: r[1], fileName: r[2],
      driveUrl: r[3], driveFileId: r[4], uploadedAt: r[5]
    }));

  return project;
}

function createProject(body) {
  const sheet = getSheet('Projects');
  const now = new Date().toISOString();
  const projectId = uuid('proj');
  const quotedAmount = parseFloat(body.quotedAmount) || 0;
  const depositPaid  = parseFloat(body.depositPaid)  || 0;
  const balanceDue   = quotedAmount - depositPaid;

  const row = [
    projectId,
    body.stage || 'Lead / Inquiry',
    body.customerName || '',
    body.projectTitle || '',
    body.phone || '',
    body.email || '',
    body.projectType || '',
    body.description || '',
    body.notes || '',
    quotedAmount,
    depositPaid,
    balanceDue,
    body.dateReceived || '',
    body.startDate || '',
    body.targetDate || '',
    now,
    body.assignee || '',
    sheet.getLastRow(), // sortOrder
  ];
  sheet.appendRow(row);
  return rowToProject(row);
}

function updateProject(body) {
  const sheet = getSheet('Projects');
  const values = sheet.getDataRange().getValues();
  const header = values[0];

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === body.projectId) {
      const rowNum = i + 1;
      const updatable = [
        'stage','customerName','projectTitle','phone','email',
        'projectType','description','notes',
        'quotedAmount','depositPaid','dateReceived',
        'startDate','targetDate','assignee','sortOrder'
      ];
      updatable.forEach(key => {
        if (body[key] !== undefined) {
          const col = PROJECT_COLS.indexOf(key) + 1;
          if (col > 0) sheet.getRange(rowNum, col).setValue(body[key]);
        }
      });
      // Recalculate balanceDue
      const quotedAmount = parseFloat(body.quotedAmount !== undefined ? body.quotedAmount : values[i][9]) || 0;
      const depositPaid  = parseFloat(body.depositPaid  !== undefined ? body.depositPaid  : values[i][10]) || 0;
      sheet.getRange(rowNum, PROJECT_COLS.indexOf('balanceDue') + 1).setValue(quotedAmount - depositPaid);
      // lastUpdated
      sheet.getRange(rowNum, PROJECT_COLS.indexOf('lastUpdated') + 1).setValue(new Date().toISOString());

      return rowToProject(sheet.getRange(rowNum, 1, 1, PROJECT_COLS.length).getValues()[0]);
    }
  }
  throw new Error('Project not found: ' + body.projectId);
}

function deleteProject(projectId) {
  // Delete project row
  const sheet = getSheet('Projects');
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === projectId) { sheet.deleteRow(i + 1); break; }
  }

  // Delete subtasks
  const subtaskSheet = getSheet('Subtasks');
  const subtaskValues = subtaskSheet.getDataRange().getValues();
  for (let i = subtaskValues.length - 1; i >= 1; i--) {
    if (subtaskValues[i][1] === projectId) subtaskSheet.deleteRow(i + 1);
  }

  // Delete images from Drive + Sheets
  const imageSheet = getSheet('Images');
  const imageValues = imageSheet.getDataRange().getValues();
  for (let i = imageValues.length - 1; i >= 1; i--) {
    if (imageValues[i][1] === projectId) {
      const fileId = imageValues[i][4];
      try { DriveApp.getFileById(fileId).setTrashed(true); } catch(e) {}
      imageSheet.deleteRow(i + 1);
    }
  }

  return { deleted: true };
}

// ════════════════════════════════════════════════════════════════════════════
// SUBTASKS
// ════════════════════════════════════════════════════════════════════════════

function createSubtask(body) {
  const sheet = getSheet('Subtasks');
  const now = new Date().toISOString();
  const subtaskId = uuid('sub');
  const row = [
    subtaskId, body.projectId, body.title || '',
    body.status || 'To Do', body.assignee || '',
    body.dueDate || '', now, now
  ];
  sheet.appendRow(row);
  return { subtaskId, projectId: body.projectId, title: body.title, status: body.status || 'To Do', assignee: body.assignee || '', dueDate: body.dueDate || '', createdAt: now, lastUpdated: now };
}

function updateSubtask(body) {
  const sheet = getSheet('Subtasks');
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === body.subtaskId) {
      const rowNum = i + 1;
      if (body.title    !== undefined) sheet.getRange(rowNum, 3).setValue(body.title);
      if (body.status   !== undefined) sheet.getRange(rowNum, 4).setValue(body.status);
      if (body.assignee !== undefined) sheet.getRange(rowNum, 5).setValue(body.assignee);
      if (body.dueDate  !== undefined) sheet.getRange(rowNum, 6).setValue(body.dueDate);
      sheet.getRange(rowNum, 8).setValue(new Date().toISOString());
      const updated = sheet.getRange(rowNum, 1, 1, 8).getValues()[0];
      return { subtaskId: updated[0], projectId: updated[1], title: updated[2], status: updated[3], assignee: updated[4], dueDate: updated[5], createdAt: updated[6], lastUpdated: updated[7] };
    }
  }
  throw new Error('Subtask not found: ' + body.subtaskId);
}

function deleteSubtask(subtaskId) {
  const sheet = getSheet('Subtasks');
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === subtaskId) { sheet.deleteRow(i + 1); return { deleted: true }; }
  }
  throw new Error('Subtask not found: ' + subtaskId);
}

// ════════════════════════════════════════════════════════════════════════════
// IMAGES
// ════════════════════════════════════════════════════════════════════════════

function uploadImage(body) {
  const folderId = getConfig('driveFolderId');
  if (!folderId) throw new Error('driveFolderId not set in Config tab');

  const parentFolder = DriveApp.getFolderById(folderId);

  // Get or create project subfolder
  let projectFolder;
  const folders = parentFolder.getFoldersByName(body.projectId);
  if (folders.hasNext()) {
    projectFolder = folders.next();
  } else {
    projectFolder = parentFolder.createFolder(body.projectId);
  }

  // Timestamp the filename to avoid collisions
  const ext = body.fileName.split('.').pop();
  const baseName = body.fileName.replace(/\.[^.]+$/, '');
  const timestampedName = `${baseName}_${Date.now()}.${ext}`;

  // Decode base64 and create file
  const blob = Utilities.newBlob(
    Utilities.base64Decode(body.base64Data),
    body.mimeType,
    timestampedName
  );
  const file = projectFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();
  const driveUrl = `https://drive.google.com/file/d/${fileId}/view`;
  const now = new Date().toISOString();
  const imageId = uuid('img');

  // Save to Images sheet
  const sheet = getSheet('Images');
  sheet.appendRow([imageId, body.projectId, timestampedName, driveUrl, fileId, now]);

  return { imageId, projectId: body.projectId, fileName: timestampedName, driveUrl, driveFileId: fileId, uploadedAt: now };
}

function deleteImageAction(imageId) {
  const sheet = getSheet('Images');
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === imageId) {
      const fileId = values[i][4];
      try { DriveApp.getFileById(fileId).setTrashed(true); } catch(e) {}
      sheet.deleteRow(i + 1);
      return { deleted: true };
    }
  }
  throw new Error('Image not found: ' + imageId);
}
