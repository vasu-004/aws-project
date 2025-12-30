const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const AWS = require('aws-sdk');

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

// New Endpoint for Real Agent Data
app.post('/agent_data', (req, res) => {
    const stats = req.body;
    globalStats = stats;
    io.emit('server_stats', stats);
    res.status(200).send('OK');
});

// Global state for real-time metrics
let globalStats = null;

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send the latest known real stats immediately upon connection
    if (globalStats) {
        socket.emit('server_stats', globalStats);
    }

    socket.on('agent_metrics', (data) => {
        console.log(`📡 Real telemetry received from agent: ${data.system?.hostname}`);
        globalStats = data;
        io.emit('server_stats', data);
    });

    socket.on('pm2_action', (data) => {
        console.log('PM2 Control Signal Received:', data);
        // Here you would integrate with PM2 API if needed locally
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// SPA Fallback: Serve index.html for any other route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Simulate Kinesis Data Stream
const actions = ['login', 'purchase', 'view_item', 'logout', 'signup', 'click_ad'];
const pages = ['/home', '/products', '/cart', '/checkout', '/profile', '/settings'];
const users = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank'];
const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
const oss = ['Windows', 'macOS', 'Linux', 'iOS', 'Android'];

setInterval(() => {
    const kRecord = {
        id: Math.random().toString(36).substring(2, 10).toUpperCase(),
        sequenceNumber: Date.now().toString() + Math.random().toString().substring(2, 8),
        data: {
            user: users[Math.floor(Math.random() * users.length)],
            action: actions[Math.floor(Math.random() * actions.length)],
            page: pages[Math.floor(Math.random() * pages.length)],
            timestamp: new Date().toISOString(),
            meta: {
                browser: browsers[Math.floor(Math.random() * browsers.length)],
                os: oss[Math.floor(Math.random() * oss.length)]
            }
        },
        approximateArrivalTimestamp: new Date().toISOString()
    };
    
    // console.log("🔥 Emitting simulated Kinesis record:", kRecord.id);
    io.emit('kinesis_data', kRecord);
}, 5000);

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CloudX Backend running on port ${PORT}`);
});
