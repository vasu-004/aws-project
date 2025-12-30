const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const AWS = require('aws-sdk');
const pm2 = require('pm2');

const app = express();
const path = require('path');
app.use(cors());
app.use(express.json());

// Serve Static Frontend (Production Build)
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// AWS Configuration (assuming env vars or local config)
AWS.config.update({ region: 'ap-south-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const kinesis = new AWS.Kinesis();

// HTTP Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', mode: 'lambda-integrated', timestamp: new Date().toISOString() });
});

// API: Fetch historical records from DynamoDB (the processed stream)
app.get('/api/stream-data', async (req, res) => {
    try {
        const params = {
            TableName: 'AnalyticsData',
            Limit: 50,
            ScanIndexForward: false
        };
        const data = await dynamodb.scan(params).promise();
        res.json(data.Items);
    } catch (err) {
        console.error("DynamoDB Error:", err);
        res.status(500).json({ error: "Could not fetch stream data", details: err.message });
    }
});

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

// PM2 Log Streaming Logic (Enhanced for Reliability)
const initPM2Bus = () => {
    pm2.connect((err) => {
        if (err) {
            console.error('PM2 Connection Error:', err);
            // Retry connection after 5 seconds
            setTimeout(initPM2Bus, 5000);
            return;
        }

        pm2.launchBus((err, bus) => {
            if (err) {
                console.error('PM2 Bus Error:', err);
                return;
            }

            console.log('🚀 PM2 Log Bus Connected');

            // Diagnostic Log to verify connection in Dashboard
            io.emit('pm2_log', {
                process: 'SYSTEM',
                data: 'CloudX Log Streaming Subsystem Initialized: ACTIVE',
                type: 'out',
                timestamp: new Date().toISOString()
            });

            bus.on('log:out', (data) => {
                io.emit('pm2_log', {
                    process: data.process.name,
                    data: data.data,
                    type: 'out',
                    timestamp: new Date().toISOString()
                });
            });

            bus.on('log:err', (data) => {
                io.emit('pm2_log', {
                    process: data.process.name,
                    data: data.data,
                    type: 'err',
                    timestamp: new Date().toISOString()
                });
            });
        });
    });
};

initPM2Bus();

// New Endpoint for Real Agent Data (Robust Handling)
app.post('/agent_data', (req, res) => {
    let statsData = req.body.stats || (req.body.cpu ? req.body : null);
    let kEvent = req.body.kinesis_event || null;

    // 1. Process System Stats (Overview Tab)
    if (statsData) {
        globalStats = statsData;
        io.emit('server_stats', statsData);
    }

    // 2. Process Real Kinesis Event (Stream Tab)
    if (kEvent) {
        io.emit('kinesis_data', kEvent);
    }

    // 3. Emit Log for Terminal View
    let logMsg = '';
    if (kEvent) {
        logMsg = `✅ Pushed to Kinesis: ${kEvent.data?.user || 'Unknown'} -> ${kEvent.data?.action || 'Unknown'}`;
    } else if (statsData) {
        logMsg = `📡 Heartbeat: CPU: ${statsData.cpu?.usage || 0}% | RAM: ${statsData.memory?.percentage || 0}%`;
    }

    if (logMsg) {
        io.emit('agent_log', {
            timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
            message: logMsg
        });
    }

    res.status(200).send('OK');
});

// Global state for real-time metrics
let globalStats = null;

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    if (globalStats) {
        socket.emit('server_stats', globalStats);
    }

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = 3001;

// SPA Fallback: Serve index.html for any other route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CloudX Backend running on port ${PORT}`);
});
