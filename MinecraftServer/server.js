const express = require('express');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const app = express();
const port = 3000;
let mcProcess = null;
let playitProcess = null;
let playitIP = "Chưa khởi động";
let logs = [];

// Đọc lệnh từ file input và gửi vào server
function checkServerInput() {
  const filePath = path.join(__dirname, 'server_input.txt');
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (content) {
      mcProcess.stdin.write(content + '\n');
      fs.writeFileSync(filePath, ''); // Xóa sau khi thực thi
      console.log(`📥 Đã gửi lệnh vào server: ${content}`);
    }
  }
}

// Hàm loại bỏ mã màu terminal
const stripAnsi = str => str.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');

// Hàm chạy autosave.bat nếu tồn tại
function startAutoSaveBat() {
  const vbsPath = path.join(__dirname, 'run_autosave.vbs');
  if (fs.existsSync(vbsPath)) {
    spawn('wscript.exe', [vbsPath], {
      cwd: __dirname,
      detached: true,
      stdio: 'ignore'
    }).unref();
    console.log("✅ Đã chạy autosave.bat thông qua .vbs (ẩn hoàn toàn)");
  } else {
    console.warn("⚠ Không tìm thấy file run_autosave.vbs. Bỏ qua!");
  }
}


app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// SSE gửi log liên tục
app.get('/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify(logs)}\n\n`);

  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify(logs)}\n\n`);
  }, 1000);

  req.on('close', () => clearInterval(interval));
});

// API lấy IP Playit.gg
app.get('/public-ip', (req, res) => {
  res.json({ ip: playitIP });
});

// Start server
app.get('/start-server', (req, res) => {
  if (mcProcess) return res.send('⚠ Server đã chạy rồi!');

  logs = [];
  playitIP = "Đang khởi tạo...";

  // 1. Chạy Minecraft server
  mcProcess = spawn('java', [
    '-Xmx1024M',
    '-Xms1024M',
    '-jar',
    'paper-1.21.8-21.jar',
    '--nogui'
  ], { cwd: __dirname });
// 2. Chạy auto-save.bat ngầm
    const autosaveProcess = spawn('cmd.exe', ['/c', 'start', '/min', 'autosave.bat'], {
        cwd: __dirname,
        detached: true,
        stdio: 'ignore'
    });
    autosaveProcess.unref();

  mcProcess.stdout.on('data', data => {
    const line = stripAnsi(data.toString().trim());
    console.log(`[MC] ${line}`);
    logs.push(line);
  });

  mcProcess.stderr.on('data', data => {
    const line = stripAnsi(data.toString().trim());
    console.error(`[MC-ERR] ${line}`);
    logs.push(line);
  });

  mcProcess.on('close', code => {
    logs.push(`Minecraft server đã tắt (code ${code})`);
    mcProcess = null;
  });

  // 2. Chạy Playit.gg
  playitProcess = spawn('./Playit.exe', [], { cwd: __dirname });

  playitProcess.stdout.on('data', data => {
    const text = stripAnsi(data.toString().trim());
    console.log(`[Playit] ${text}`);
    logs.push(`[Playit] ${text}`);

    const domainMatch = text.match(/([a-zA-Z0-9.-]+\.(?:playit\.gg|joinmc\.link))/);
    if (domainMatch && domainMatch[1]) {
      playitIP = domainMatch[1].trim();
      console.log(`🌍 Domain: ${playitIP}`);
    }
  });

  playitProcess.stderr.on('data', data => {
    const line = stripAnsi(data.toString().trim());
    console.error(`[Playit-ERR] ${line}`);
    logs.push(`[Playit-ERR] ${line}`);
  });

  playitProcess.on('close', code => {
    logs.push(`Playit.gg đã tắt (code ${code})`);
    playitProcess = null;
  });

  // 3. Khởi chạy autosave.bat
  startAutoSaveBat();

  res.send('✅ Server đang khởi động...');
});

// Stop server
app.get('/stop-server', (req, res) => {
  if (!mcProcess) return res.send('⚠ Server chưa chạy!');
  mcProcess.stdin.write('stop\n');
  if (playitProcess) playitProcess.kill();
  res.send('🛑 Đang tắt server...');
});

// Gửi lệnh từ web vào Minecraft
app.post('/command', (req, res) => {
  if (!mcProcess) return res.send('⚠ Server chưa chạy!');
  const { cmd } = req.body;
  if (cmd && cmd.trim() !== '') {
    mcProcess.stdin.write(cmd.trim() + '\n');
    logs.push(`> ${cmd.trim()}`);
    return res.send(`✅ Đã gửi lệnh: ${cmd.trim()}`);
  }
  res.send('⚠ Lệnh rỗng!');
});

// Gọi checkServerInput() liên tục mỗi giây
setInterval(() => {
  if (mcProcess) checkServerInput();
}, 1000);

app.listen(port, () => {
  console.log(`Web điều khiển chạy tại: http://localhost:${port}`);
});
