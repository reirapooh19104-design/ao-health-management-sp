// ============================================================
// Google Apps Script コード
// このファイルの内容を Google Apps Script エディタに貼り付けてください
// ============================================================

const SHEET_NAME = 'data';

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  return sheet;
}

// 全データ取得（GET リクエスト）
function doGet(e) {
  const sheet = getOrCreateSheet();
  const result = {};
  const lastRow = sheet.getLastRow();
  if (lastRow > 0) {
    const rows = sheet.getRange(1, 1, lastRow, 2).getValues();
    rows.forEach(([key, value]) => {
      if (key) {
        try { result[key] = JSON.parse(value); } catch { result[key] = value; }
      }
    });
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// データ保存（POST リクエスト）
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const { key, value } = body;
  const sheet = getOrCreateSheet();
  const lastRow = sheet.getLastRow();
  let foundRow = -1;
  if (lastRow > 0) {
    const keys = sheet.getRange(1, 1, lastRow, 1).getValues();
    for (let i = 0; i < keys.length; i++) {
      if (keys[i][0] === key) { foundRow = i + 1; break; }
    }
  }
  const serialized = JSON.stringify(value);
  if (foundRow > 0) {
    sheet.getRange(foundRow, 2).setValue(serialized);
  } else {
    sheet.appendRow([key, serialized]);
  }
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}
