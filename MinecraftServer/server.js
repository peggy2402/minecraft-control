const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const port = 3000;
let mcProcess = null;
let playitProcess = null;
let playitIP = "Chưa khởi động";
let logs = [];

// Hàm loại bỏ mã màu terminal
const stripAnsi = str => str.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');

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

        // Bắt domain đầy đủ kể cả nhiều cấp
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

app.listen(port, () => {
    console.log(`Web điều khiển chạy tại: http://localhost:${port}`);
});
