const { app, BrowserWindow } = require('electron');
function createWindow(){ new BrowserWindow({width:800,height:600}).loadURL('http://localhost:5173'); }
app.whenReady().then(createWindow);
