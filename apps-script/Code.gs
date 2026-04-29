// SHD Kanban - Google Apps Script Backend
// Deploy as: Web App > Execute as: Me > Anyone can access

var SS = SpreadsheetApp.getActiveSpreadsheet();

function getSheet(name) {
  return SS.getSheetByName(name);
}

function getConfig(key) {
  var sheet = getSheet('Config');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return null;
}

function makeUuid(prefix) {
  var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var id = prefix + '_';
  for (var i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function doGet(e) {
  var action = e.parameter.action;
  var result;
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
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ error: 'Invalid JSON body' });
  }
  var result;
  try {
    var action = body.action;
    if      (action === 'createProject')  result = createProject(body);
    else if (action === 'updateProject')  result = updateProject(body);
    else if (action === 'deleteProject')  result = deleteProject(body.projectId);
    else if (action === 'createSubtask')  result = createSubtask(body);
    else if (action === 'updateSubtask')  result = updateSubtask(body);
    else if (action === 'deleteSubtask')  result = deleteSubtask(body.subtaskId);
    else if (action === 'uploadImage')    result = uploadImage(body);
    else if (action === 'deleteImage')    result = deleteImageRecord(body.imageId);
    else result = { error: 'Unknown action: ' + action };
  } catch (err) {
    result = { error: err.message };
  }
  return jsonResponse(result);
}

function jsonResponse(data) {
  var success = !data.error;
  var payload = success
    ? { success: true, data: data }
    : { success: false, error: data.error };
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- PROJECTS ---

var PROJECT_COLS = [
  'projectId','stage','customerName','projectTitle','phone','email',
  'projectType','description','notes',
  'quotedAmount','depositPaid','balanceDue',
  'dateReceived','startDate','targetDate','lastUpdated',
  'assignee','sortOrder',
  'invoiced','invoiceAmount','invoiceNumber',
  'closingNotes'
];

// Format a cell value that may be a Date object into a YYYY-MM-DD string.
// input type="date" requires exactly this format; ISO strings with time components are rejected.
function formatDateCell(val) {
  if (!val) return '';
  if (val instanceof Date) {
    var y = val.getFullYear();
    var m = ('0' + (val.getMonth() + 1)).slice(-2);
    var d = ('0' + val.getDate()).slice(-2);
    return y + '-' + m + '-' + d;
  }
  // Already a string — strip any trailing time component just in case
  return String(val).split('T')[0];
}

function rowToProject(row) {
  var obj = {};
  for (var i = 0; i < PROJECT_COLS.length; i++) {
    obj[PROJECT_COLS[i]] = row[i] !== undefined ? row[i] : '';
  }
  obj.quotedAmount  = parseFloat(obj.quotedAmount)  || 0;
  obj.depositPaid   = parseFloat(obj.depositPaid)   || 0;
  obj.balanceDue    = parseFloat(obj.balanceDue)    || 0;
  obj.sortOrder     = parseInt(obj.sortOrder)        || 0;
  obj.invoiced      = obj.invoiced === true || obj.invoiced === 'TRUE';
  obj.invoiceAmount = parseFloat(obj.invoiceAmount) || 0;
  // Ensure date fields are always YYYY-MM-DD strings, never raw Date objects
  obj.dateReceived  = formatDateCell(obj.dateReceived);
  obj.startDate     = formatDateCell(obj.startDate);
  obj.targetDate    = formatDateCell(obj.targetDate);
  obj.lastUpdated   = obj.lastUpdated ? String(obj.lastUpdated) : '';
  return obj;
}

function getProjects() {
  var sheet = getSheet('Projects');
  var values = sheet.getDataRange().getValues().slice(1);
  var subtaskValues = getSheet('Subtasks').getDataRange().getValues().slice(1);
  var imageValues   = getSheet('Images').getDataRange().getValues().slice(1);

  var subtaskCounts = {};
  for (var i = 0; i < subtaskValues.length; i++) {
    var pid = subtaskValues[i][1];
    subtaskCounts[pid] = (subtaskCounts[pid] || 0) + 1;
  }
  var imageCounts = {};
  for (var j = 0; j < imageValues.length; j++) {
    var ipid = imageValues[j][1];
    imageCounts[ipid] = (imageCounts[ipid] || 0) + 1;
  }

  var projects = [];
  for (var k = 0; k < values.length; k++) {
    if (!values[k][0]) continue;
    var p = rowToProject(values[k]);
    p.subtaskCount = subtaskCounts[p.projectId] || 0;
    p.imageCount   = imageCounts[p.projectId]   || 0;
    projects.push(p);
  }
  return projects;
}

function getProject(projectId) {
  var sheet = getSheet('Projects');
  var values = sheet.getDataRange().getValues().slice(1);
  var row = null;
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] === projectId) { row = values[i]; break; }
  }
  if (!row) throw new Error('Project not found: ' + projectId);

  var project = rowToProject(row);

  var subtaskValues = getSheet('Subtasks').getDataRange().getValues().slice(1);
  project.subtasks = [];
  for (var j = 0; j < subtaskValues.length; j++) {
    if (subtaskValues[j][1] === projectId) {
      project.subtasks.push({
        subtaskId: subtaskValues[j][0], projectId: subtaskValues[j][1],
        title: subtaskValues[j][2], status: subtaskValues[j][3],
        assignee: subtaskValues[j][4], dueDate: subtaskValues[j][5],
        createdAt: subtaskValues[j][6], lastUpdated: subtaskValues[j][7]
      });
    }
  }

  var imageValues = getSheet('Images').getDataRange().getValues().slice(1);
  project.images = [];
  for (var k = 0; k < imageValues.length; k++) {
    if (imageValues[k][1] === projectId) {
      project.images.push({
        imageId: imageValues[k][0], projectId: imageValues[k][1],
        fileName: imageValues[k][2], driveUrl: imageValues[k][3],
        driveFileId: imageValues[k][4], uploadedAt: imageValues[k][5]
      });
    }
  }

  return project;
}

function createProject(body) {
  var sheet = getSheet('Projects');
  var now = new Date().toISOString();
  var projectId = makeUuid('proj');
  var quotedAmount = parseFloat(body.quotedAmount) || 0;
  var depositPaid  = parseFloat(body.depositPaid)  || 0;
  var row = [
    projectId,
    body.stage        || 'Lead / Inquiry',
    body.customerName || '',
    body.projectTitle || '',
    body.phone        || '',
    body.email        || '',
    body.projectType  || '',
    body.description  || '',
    body.notes        || '',
    quotedAmount,
    depositPaid,
    quotedAmount - depositPaid,
    body.dateReceived || '',
    body.startDate    || '',
    body.targetDate   || '',
    now,
    body.assignee      || '',
    sheet.getLastRow(),
    body.invoiced      ? true : false,
    parseFloat(body.invoiceAmount) || 0,
    body.invoiceNumber || '',
    body.closingNotes  || ''
  ];
  sheet.appendRow(row);
  return rowToProject(row);
}

function updateProject(body) {
  var sheet = getSheet('Projects');
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === body.projectId) {
      var rowNum = i + 1;
      var updatable = [
        'stage','customerName','projectTitle','phone','email',
        'projectType','description','notes',
        'quotedAmount','depositPaid','dateReceived',
        'startDate','targetDate','assignee','sortOrder',
        'invoiced','invoiceAmount','invoiceNumber',
        'closingNotes'
      ];
      for (var u = 0; u < updatable.length; u++) {
        var key = updatable[u];
        if (body[key] !== undefined) {
          var col = PROJECT_COLS.indexOf(key) + 1;
          if (col > 0) sheet.getRange(rowNum, col).setValue(body[key]);
        }
      }
      var q = parseFloat(body.quotedAmount !== undefined ? body.quotedAmount : values[i][9]) || 0;
      var d = parseFloat(body.depositPaid  !== undefined ? body.depositPaid  : values[i][10]) || 0;
      sheet.getRange(rowNum, PROJECT_COLS.indexOf('balanceDue') + 1).setValue(q - d);
      sheet.getRange(rowNum, PROJECT_COLS.indexOf('lastUpdated') + 1).setValue(new Date().toISOString());
      return rowToProject(sheet.getRange(rowNum, 1, 1, PROJECT_COLS.length).getValues()[0]);
    }
  }
  throw new Error('Project not found: ' + body.projectId);
}

function deleteProject(projectId) {
  var sheet = getSheet('Projects');
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === projectId) { sheet.deleteRow(i + 1); break; }
  }
  var subtaskSheet = getSheet('Subtasks');
  var subtaskValues = subtaskSheet.getDataRange().getValues();
  for (var j = subtaskValues.length - 1; j >= 1; j--) {
    if (subtaskValues[j][1] === projectId) subtaskSheet.deleteRow(j + 1);
  }
  var imageSheet = getSheet('Images');
  var imageValues = imageSheet.getDataRange().getValues();
  for (var k = imageValues.length - 1; k >= 1; k--) {
    if (imageValues[k][1] === projectId) {
      try { DriveApp.getFileById(imageValues[k][4]).setTrashed(true); } catch(e) {}
      imageSheet.deleteRow(k + 1);
    }
  }
  return { deleted: true };
}

// --- SUBTASKS ---

function createSubtask(body) {
  var sheet = getSheet('Subtasks');
  var now = new Date().toISOString();
  var subtaskId = makeUuid('sub');
  var row = [subtaskId, body.projectId, body.title || '', body.status || 'To Do', body.assignee || '', body.dueDate || '', now, now];
  sheet.appendRow(row);
  return { subtaskId: subtaskId, projectId: body.projectId, title: body.title, status: body.status || 'To Do', assignee: body.assignee || '', dueDate: body.dueDate || '', createdAt: now, lastUpdated: now };
}

function updateSubtask(body) {
  var sheet = getSheet('Subtasks');
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === body.subtaskId) {
      var rowNum = i + 1;
      if (body.title    !== undefined) sheet.getRange(rowNum, 3).setValue(body.title);
      if (body.status   !== undefined) sheet.getRange(rowNum, 4).setValue(body.status);
      if (body.assignee !== undefined) sheet.getRange(rowNum, 5).setValue(body.assignee);
      if (body.dueDate  !== undefined) sheet.getRange(rowNum, 6).setValue(body.dueDate);
      sheet.getRange(rowNum, 8).setValue(new Date().toISOString());
      var updated = sheet.getRange(rowNum, 1, 1, 8).getValues()[0];
      return { subtaskId: updated[0], projectId: updated[1], title: updated[2], status: updated[3], assignee: updated[4], dueDate: updated[5], createdAt: updated[6], lastUpdated: updated[7] };
    }
  }
  throw new Error('Subtask not found: ' + body.subtaskId);
}

function deleteSubtask(subtaskId) {
  var sheet = getSheet('Subtasks');
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === subtaskId) { sheet.deleteRow(i + 1); return { deleted: true }; }
  }
  throw new Error('Subtask not found: ' + subtaskId);
}

// --- IMAGES ---

function uploadImage(body) {
  var folderId = getConfig('driveFolderId');
  if (!folderId) throw new Error('driveFolderId not set in Config tab');
  var parentFolder = DriveApp.getFolderById(folderId);
  var projectFolder;
  var folders = parentFolder.getFoldersByName(body.projectId);
  if (folders.hasNext()) {
    projectFolder = folders.next();
  } else {
    projectFolder = parentFolder.createFolder(body.projectId);
  }
  var ext = body.fileName.split('.').pop();
  var baseName = body.fileName.replace(/\.[^.]+$/, '');
  var timestampedName = baseName + '_' + Date.now() + '.' + ext;
  var blob = Utilities.newBlob(Utilities.base64Decode(body.base64Data), body.mimeType, timestampedName);
  var file = projectFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var fileId = file.getId();
  var driveUrl = 'https://drive.google.com/file/d/' + fileId + '/view';
  var now = new Date().toISOString();
  var imageId = makeUuid('img');
  getSheet('Images').appendRow([imageId, body.projectId, timestampedName, driveUrl, fileId, now]);
  return { imageId: imageId, projectId: body.projectId, fileName: timestampedName, driveUrl: driveUrl, driveFileId: fileId, uploadedAt: now };
}

function deleteImageRecord(imageId) {
  var sheet = getSheet('Images');
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === imageId) {
      try { DriveApp.getFileById(values[i][4]).setTrashed(true); } catch(e) {}
      sheet.deleteRow(i + 1);
      return { deleted: true };
    }
  }
  throw new Error('Image not found: ' + imageId);
}
