const {app,BrowserWindow}=require('electron');
app.whenReady().then(()=>{const w=new BrowserWindow({width:1500,height:960,minWidth:1000,minHeight:700,backgroundColor:'#080a0b',autoHideMenuBar:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});w.loadFile('src/index.html');w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',e=>e.preventDefault());});
app.on('window-all-closed',()=>app.quit());
