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

// New Endpoint for Real Agent Data (Combined Metrics & Kinesis Flow)
app.post('/agent_data', (req, res) => {
    const { stats, kinesis_event } = req.body;

    // 1. Process System Stats (Overview Tab)
    if (stats) {
        globalStats = stats;
        io.emit('server_stats', stats);
    }

    // 2. Process Real Kinesis Event (Stream Tab)
    if (kinesis_event) {
        // console.log("📡 Real Stream Event from Agent:", kinesis_event.id);
        io.emit('kinesis_data', kinesis_event);
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
