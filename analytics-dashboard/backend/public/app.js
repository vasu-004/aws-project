
const socket = io();

// DOM Elements
const cpuVal = document.getElementById('cpu-val');
const cpuBar = document.getElementById('cpu-bar');
const memVal = document.getElementById('mem-val');
const memBar = document.getElementById('mem-bar');
const memDetail = document.getElementById('mem-detail');
const diskVal = document.getElementById('disk-val');
const diskBar = document.getElementById('disk-bar');
const diskDetail = document.getElementById('disk-detail');
const vmStatus = document.getElementById('vm-status');
const uptimeEl = document.getElementById('uptime');
const eventsList = document.getElementById('events-list');

// Chart Setup
const ctx = document.getElementById('cpuChart').getContext('2d');
const cpuChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'CPU Usage %',
            data: [],
            borderColor: '#58a6ff',
            backgroundColor: 'rgba(88, 166, 255, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 0
        }]
    },
    options: {
        responsive: true,
        plugins: {
            legend: { display: false }
        },
        scales: {
            x: {
                grid: { color: '#30363d' },
                ticks: { color: '#8b949e' }
            },
            y: {
                beginAtZero: true,
                max: 100,
                grid: { color: '#30363d' },
                ticks: { color: '#8b949e' }
            }
        },
        animation: { duration: 0 }
    }
});

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
}

// Track last event timestamp to avoid duplicates if polling is aggressive
let lastEventId = null;

socket.on('analytics_update', (data) => {
    // Update VM Stats
    if (data.vm) {
        const vm = data.vm;
        const cpuUsage = Math.round(vm.cpu_usage || 0);
        cpuVal.textContent = cpuUsage + '%';
        cpuBar.style.width = cpuUsage + '%';

        const memPercent = vm.memory_percent || 0;
        memVal.textContent = memPercent + '%';
        memBar.style.width = memPercent + '%';
        memDetail.textContent = `${formatBytes(vm.memory_used)} / ${formatBytes(vm.memory_total)}`;

        const diskPercent = vm.disk_percent || 0;
        diskVal.textContent = diskPercent + '%';
        diskBar.style.width = diskPercent + '%';
        diskDetail.textContent = `${formatBytes(vm.disk_used)} / ${formatBytes(vm.disk_total)}`;

        // Uptime (approximate from boot_time)
        const uptimeSeconds = (Date.now() / 1000) - vm.boot_time;
        const uptimeHrs = Math.floor(uptimeSeconds / 3600);
        const uptimeMins = Math.floor((uptimeSeconds % 3600) / 60);
        uptimeEl.textContent = `Uptime: ${uptimeHrs}h ${uptimeMins}m`;

        // Update Chart
        const timeLabel = formatTime(vm.timestamp);

        // Prevent duplicate points if timestamp hasn't changed
        const lastLabel = cpuChart.data.labels[cpuChart.data.labels.length - 1];
        if (lastLabel !== timeLabel) {
            if (cpuChart.data.labels.length > 20) {
                cpuChart.data.labels.shift();
                cpuChart.data.datasets[0].data.shift();
            }
            cpuChart.data.labels.push(timeLabel);
            cpuChart.data.datasets[0].data.push(cpuUsage);
            cpuChart.update();
        }
    }

    // Update Events
    if (data.events && data.events.length > 0) {
        // Clear skeleton loader if first load
        if (eventsList.querySelector('.skeleton')) {
            eventsList.innerHTML = '';
        }

        // Process new events (assuming sorted newest first)
        // We only append events that are newer than what we have, 
        // OR we just rebuild the list if simple. 
        // Simple approach: Rebuild top 10 list to ensure order.

        eventsList.innerHTML = ''; // Clear current

        data.events.forEach(event => {
            const div = document.createElement('div');
            // Determine class based on action
            let typeClass = 'click';
            if (event.action === 'login') typeClass = 'login';
            if (event.action === 'logout') typeClass = 'logout';
            if (event.action === 'purchase') typeClass = 'purchase';

            div.className = `event-item ${typeClass}`;
            div.innerHTML = `
                <div>
                    <span class="event-user">${event.user}</span>
                    <span class="event-action">${event.action} ${event.page ? 'on ' + event.page : ''}</span>
                </div>
                <div class="event-time">${formatTime(event.timestamp)}</div>
            `;
            eventsList.appendChild(div);
        });
    }
});
