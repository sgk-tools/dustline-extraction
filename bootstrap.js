document.getElementById('start').disabled=true;document.getElementById('start').textContent='任務データを準備中…';
try {
 await import('./engine.js?v=04');
 await import('./models.js?v=04');
 await import('./soldier.js?v=05');
 await import('./robots.js?v=05');
 await import('./game.js?v=04');
 if(new URLSearchParams(location.search).has('measure'))await import('./measure.js?v=05');
 if(document.getElementById('startupError').style.display!=='block'){document.getElementById('start').disabled=false;document.getElementById('start').textContent='任務を開始 →';}
} catch(error) {
 console.error(error);
 const box=document.getElementById('startupError');box.style.display='block';
 box.textContent='読み込みに失敗しました。通信を確認してページを再読み込みしてください。'+error.message;
 document.getElementById('start').disabled=true;
}
