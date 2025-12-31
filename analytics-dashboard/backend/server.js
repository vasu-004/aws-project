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

// AWS Configuration
AWS.config.update({
    region: 'ap-south-1',
    accessKeyId: 'AKIA2S2Y4JEZ5DPEZZLI',
    secretAccessKey: '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'
});
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
                const log = {
                    process: data.process.name,
                    data: data.data,
                    type: 'out',
                    timestamp: new Date().toISOString()
                };
                logBuffer.push(log);
                if (logBuffer.length > 100) logBuffer.shift();
                io.emit('pm2_log', log);
            });

            bus.on('log:err', (data) => {
                const log = {
                    process: data.process.name,
                    data: data.data,
                    type: 'err',
                    timestamp: new Date().toISOString()
                };
                logBuffer.push(log);
                if (logBuffer.length > 100) logBuffer.shift();
                io.emit('pm2_log', log);
            });
        });
    });
};

initPM2Bus();

// --- NEW: DynamoDB Polling for Real-Time Dashboard Updates ---
let lastProcessedTime = new Date().toISOString();

const pollDynamoDB = async () => {
    try {
        const params = {
            TableName: 'AnalyticsData',
            Limit: 10,
            ScanIndexForward: false // Newest first
        };

        const data = await dynamodb.scan(params).promise();

        if (data.Items && data.Items.length > 0) {
            // Find items newer than lastProcessedTime
            const newItems = data.Items.filter(item => item.timestamp > lastProcessedTime);

            if (newItems.length > 0) {
                console.log(`✨ Found ${newItems.length} new records in DynamoDB`);

                // Emit each new item as a Kinesis event for the frontend
                newItems.forEach(item => {
                    io.emit('kinesis_data', {
                        id: item.id.substring(0, 8),
                        sequenceNumber: item.id,
                        data: item.raw_data,
                        timestamp: item.timestamp
                    });
                });

                // --- NEW: Map DB Record to Overview Stats ---
                const latestItem = newItems[0];
                if (latestItem.raw_data && latestItem.raw_data.raw_metrics) {
                    const mappedStats = {
                        system: {
                            hostname: latestItem.raw_data.user,
                            platform: "aws-lambda-tracked",
                            isFromDB: true
                        },
                        cpu: {
                            usage: latestItem.raw_data.raw_metrics.cpu,
                            cores: "VCORE",
                            speed: "SCALABLE"
                        },
                        memory: {
                            percentage: latestItem.raw_data.raw_metrics.memory_pct,
                            used: latestItem.raw_data.raw_metrics.memory_used_gb,
                            total: "DYNAMIC"
                        },
                        storage: [
                            { drive: "Cloud-Volume", percentage: 43, used: 3.67, total: 100 }
                        ],
                        network: [
                            { iface: "kinesis-sync", rx: 512, tx: 128 }
                        ],
                        timestamp: latestItem.timestamp
                    };

                    globalStats = mappedStats;
                    io.emit('server_stats', mappedStats);
                }
                // --------------------------------------------

                // Update lastProcessedTime to the newest item found
                lastProcessedTime = data.Items[0].timestamp;
            }
        }
    } catch (err) {
        console.error("⚠️ DynamoDB Poll Error:", err.message);
    }

    // Poll every 3 seconds for better real-time feel
    setTimeout(pollDynamoDB, 3000);
};

// Start polling
pollDynamoDB();
// -----------------------------------------------------------

// Endpoint for Direct Agent (Legacy/Testing - Disabled to focus on Kinesis)
app.post('/agent_data', (req, res) => {
    // We intentionally ignore this to force all data to come via Kinesis->Lambda->DB
    res.status(200).send('Ignored - Using Cloud DB Sync');
});

// Global state for real-time metrics and log buffer
let globalStats = null;
let logBuffer = [];

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Initial sync
    if (globalStats) {
        socket.emit('server_stats', globalStats);
    }

    // Send historical logs to new client
    if (logBuffer.length > 0) {
        logBuffer.forEach(log => socket.emit('pm2_log', log));
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
