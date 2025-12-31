import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import {
  Cpu, HardDrive, LayoutDashboard, Activity, Terminal, Shield, Wifi, Clock,
  Settings, Box, Server, Search, Bell, User, RefreshCw, StopCircle, PlayCircle,
  Menu, AlertTriangle, ListFilter, Trash2, BellOff, BarChart2, TrendingUp, Cloud,
  Zap, Sun, Moon, PieChart as PieIcon, LogOut, Monitor, Sparkles, Send, Calendar,
  Filter, X, Globe, MapPin, Download, ExternalLink, ChevronRight, ChevronLeft
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const SOCKET_SERVER = `${window.location.protocol}//${window.location.hostname}:3001`;

const vMain = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } }
};

const vItem = {
  hidden: { opacity: 0, y: 15, scale: 0.98, filter: 'blur(10px)' },
  show: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 100, damping: 20 } }
};

const vTab = {
  hidden: { opacity: 0, x: -10, filter: 'blur(8px)' },
  show: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: 'easeOut' } },
  exit: { opacity: 0, x: 10, filter: 'blur(8px)', transition: { duration: 0.3 } }
};

const App = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [chartMetric, setChartMetric] = useState('combined');
  const [chartType, setChartType] = useState('area');
  const [pieMetric, setPieMetric] = useState('memory');
  const [allocationSize, setAllocationSize] = useState('nano');
  const [networkSize, setNetworkSize] = useState('nano');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [uiStyle, setUiStyle] = useState('tactical'); // tactical, aura
  const [accentColor, setAccentColor] = useState('#6366F1');
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [kinesisData, setKinesisData] = useState([]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accentColor);
    document.documentElement.style.setProperty('--aura-accent', accentColor);
  }, [accentColor]);

  const colorPresets = [
    { name: 'Cobalt', value: '#6366F1' },
    { name: 'Cyan', value: '#06B6D4' },
    { name: 'Emerald', value: '#10B981' },
    { name: 'Amber', value: '#F59E0B' },
    { name: 'Rose', value: '#F43F5E' },
    { name: 'Amethyst', value: '#8B5CF6' }
  ];

  // Time Customization State
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [quickRange, setQuickRange] = useState('live');
  const [isHistoricalView, setIsHistoricalView] = useState(false);
  const [filteredHistory, setFilteredHistory] = useState([]);

  // New states for login
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Map Visualization State
  const [mapType, setMapType] = useState('radar'); // radar, satellite, hybrid, terrain
  const [mapZoom, setMapZoom] = useState(13);
  const [viewMode, setViewMode] = useState('target'); // target, self
  const [userCoords, setUserCoords] = useState(null);

  // AI Assistant State
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', content: 'CloudX Core initialized. I am ready to analyze your real-time infrastructure telemetry. What would you like to investigate?' }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const logEndRef = useRef(null);
  const socketRef = useRef(null);
  const lastStateRef = useRef({ pm2: {}, storage: {}, ram: false });

  // Toggle Theme Logic
  useEffect(() => {
    const root = window.document.documentElement;
    root.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Helper to add to alert history
  const addAlert = (type, title, message) => {
    const newAlert = {
      id: Date.now(),
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false
    };
    setAlerts(prev => [newAlert, ...prev].slice(0, 50));

    if (notificationsEnabled) {
      if (type === 'error') toast.error(title, { description: message });
      else if (type === 'warning') toast.warning(title, { description: message });
      else if (type === 'success') toast.success(title, { description: message });
      else toast.info(title, { description: message });
    }
  };

  useEffect(() => {
    const socket = io(SOCKET_SERVER, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      timeout: 10000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      addAlert('info', 'CloudX Linked', 'Encrypted connection established.');
    });

    socket.on('connect_error', (err) => {
      addAlert('error', 'Connection Lost', `Engine unreachable: ${err.message}`);
    });

    socket.on('disconnect', () => setIsConnected(false));

    socket.on('server_stats', (data) => {
      if (data.loading) return;
      setStats(data);

      data.pm2?.forEach(p => {
        const prevState = lastStateRef.current.pm2[p.name];
        if (prevState === 'online' && p.status !== 'online') {
          addAlert('error', `Service Critical: ${p.name}`, `State changed to ${p.status.toUpperCase()}`);
        } else if (prevState && prevState !== 'online' && p.status === 'online') {
          addAlert('success', `Service Restored: ${p.name}`, 'Process is back online.');
        }
        lastStateRef.current.pm2[p.name] = p.status;
      });

      data.storage?.forEach(d => {
        const prevUsage = lastStateRef.current.storage[d.drive] || 0;
        if (prevUsage <= 85 && d.percentage > 85) {
          addAlert('warning', `Low Disk: ${d.drive}`, `Threshold exceeded: ${d.percentage}%`);
        }
        lastStateRef.current.storage[d.drive] = d.percentage;
      });

      if (!lastStateRef.current.ram && data.memory?.percentage > 90) {
        addAlert('error', 'RAM Critical', `Usage at ${data.memory.percentage}%`);
        lastStateRef.current.ram = true;
      } else if (data.memory?.percentage < 85) {
        lastStateRef.current.ram = false;
      }

      setHistory(prev => {
        const newData = [...prev, {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          cpu: parseFloat(data.cpu?.usage || 0),
          memory: parseFloat(data.memory?.percentage || 0),
          rx: parseFloat(data.network?.[0]?.rx || 0),
          tx: parseFloat(data.network?.[0]?.tx || 0)
        }];
        return newData.slice(-30);
      });
    });

    socket.on('pm2_log', (data) => {
      setLogs(prev => [...prev, data].slice(-200));
      if (data.type === 'err') {
        addAlert('error', `Runtime Error: ${data.process}`, data.data.substring(0, 80));
      }
    });

    socket.on('kinesis_data', (data) => {
      setKinesisData(prev => [data, ...prev].slice(0, 100));
    });


    return () => socket.disconnect();
  }, [notificationsEnabled]);

  useEffect(() => {
    if (activeTab === 'logs') {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  useEffect(() => {
    if (activeTab === 'kinesis') {
      fetchKinesisHistory();
    }
  }, [activeTab]);

  const handlePM2Action = (action, name) => {
    if (socketRef.current) {
      socketRef.current.emit('pm2_action', { action, name });
      addAlert('info', 'Command Sent', `${action} signal for ${name}`);
    }
  };

  const handleAIQuery = (e) => {
    e.preventDefault();
    if (!aiInput.trim()) return;

    const userMsg = aiInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setAiInput('');
    setIsTyping(true);

    // Simulate AI analysis of current stats
    setTimeout(() => {
      let response = "I'm analyzing your CloudX enclave... ";
      const query = userMsg.toLowerCase();

      // Top Processes Analysis
      if (query.includes('process') || query.includes('running') || query.includes('task')) {
        const topProc = [...(stats?.processes || [])].sort((a, b) => b.cpu - a.cpu)[0];
        if (topProc) {
          response = `I see ${(stats?.processes || []).length} active threads on "${stats?.system?.hostname}". The peak process is "${topProc.name}" (PID: ${topProc.pid}) at ${topProc.cpu?.toFixed(1)}% CPU.`;
        } else {
          response = "No active process telemetry detected in the current buffer.";
        }
      }
      // Storage & Disk Analysis
      else if (query.includes('disk') || query.includes('storage') || query.includes('space')) {
        const disk = stats?.storage?.[0];
        if (disk) {
          response = `Target volume "${disk.drive}" is at ${disk.percentage}% capacity (${disk.used}GB of ${disk.total}GB used). Headroom is nominal.`;
        } else {
          response = "Storage telemetry is currently unavailable.";
        }
      }
      // CPU & Infrastructure
      else if (query.includes('cpu') || query.includes('processor') || query.includes('load')) {
        if (stats?.cpu) {
          response = `CPU load is at ${stats.cpu.usage}% across ${stats.cpu.cores} cores. Frequency is locked at ${stats.cpu.speed}GHz. Utilization is stable.`;
        } else {
          response = "CPU telemetry synchronization pending.";
        }
      }
      // Memory & RAM
      else if (query.includes('ram') || query.includes('memory') || query.includes('usage')) {
        if (stats?.memory) {
          response = `Real-time RAM usage is ${stats.memory.percentage}% (${stats.memory.used}GB allocated). System headroom: ${stats.memory.available || 'unknown'}GB.`;
        } else {
          response = "Memory pool telemetry synchronization pending.";
        }
      }
      // Network & Bandwidth
      else if (query.includes('network') || query.includes('internet') || query.includes('bandwidth')) {
        const net = stats?.network?.[0];
        if (net) {
          response = `Network interface "${net.iface}" is ${net.operstate?.toUpperCase()}. Throughput: RX ${net.rx} KB/s, TX ${net.tx} KB/s.`;
        } else {
          response = "Network ingress/egress telemetry pending.";
        }
      }
      // Fallback
      else {
        response = ` telemetry for "${stats?.system?.hostname || 'Target Enclave'}" is live. I can provide detailed analysis on CPU Load, Memory Allocation, Disk IO, or Active Threads.`;
      }

      setChatMessages(prev => [...prev, { role: 'ai', content: response }]);
      setIsTyping(false);
    }, 1500);
  };

  const handleTimeFilter = () => {
    if (!startTime || !endTime) {
      toast.error('Select Range', { description: 'Please define both start and end timestamps.' });
      return;
    }

    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    if (start >= end) {
      toast.error('Invalid Range', { description: 'End time must be after start time.' });
      return;
    }

    setIsHistoricalView(true);
    const filtered = history.filter(item => {
      const itemTime = new Date().setHours(...item.time.split(':').map(Number));
      return itemTime >= start && itemTime <= end;
    });

    // No matches found in buffer
    if (filtered.length === 0) {
      setFilteredHistory([]);
      toast.error('No Data Found', { description: `No telemetry matched the requested range in the local buffer.` });
    } else {
      setFilteredHistory(filtered);
      toast.success('Historical Sync', { description: `Extracted ${filtered.length} telemetry points.` });
    }
  };

  const setTimePreset = (minutes) => {
    const end = new Date();
    const start = new Date(end.getTime() - minutes * 60 * 1000);

    const formatToLocal = (date) => {
      const offset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - offset).toISOString().slice(0, 16);
    };

    setStartTime(formatToLocal(start));
    setEndTime(formatToLocal(end));
    setQuickRange(minutes);

    // Auto-trigger filter
    setTimeout(() => {
      handleTimeFilter();
    }, 100);
  };
  const handleLocateSelf = () => {
    if ("geolocation" in navigator) {
      toast.info('Requesting GPS...', { description: 'Synchronizing local coordinates.' });
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserCoords(coords);
          setViewMode('self');
          setMapZoom(16);
          setMapType('hybrid');
          toast.success('Self Located', { description: `Coordinates locked: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` });
        },
        (err) => {
          toast.error('GPS Link Failed', { description: err.message });
        }
      );
    } else {
      toast.error('Unsupported', { description: 'Geolocation API not available in this terminal.' });
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'admin' && password === 'admin123') {
      setIsLoggedIn(true);
      setLoginError('');
      addAlert('success', 'Access Granted', 'Welcome back, Administrator.');
    } else {
      setLoginError('Invalid security credentials');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
  };

  const renderLogin = () => (
    <div className="login-screen">
      <div className="login-panel">
        <div className="login-header">
          <div className="brand-logo" style={{ width: 60, height: 60, margin: '0 auto 1rem', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)', borderRadius: '16px' }}>
            <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
              <Cloud size={30} color="white" />
              <Zap size={15} color="#ffde59" style={{ position: 'absolute', bottom: -3, right: -3 }} />
            </div>
          </div>
          <h2 style={{ color: 'white', fontWeight: 800, fontSize: '1.75rem', letterSpacing: '-1px' }}>cloud<span style={{ color: '#3a7bd5' }}>X</span></h2>
          <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>Management Console</p>
        </div>

        <form onSubmit={handleLogin}>
          {loginError && <div className="login-error">{loginError}</div>}
          <div className="login-input-group">
            <label>Administrator ID</label>
            <input
              type="text"
              className="login-input"
              placeholder="Enter ID"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="login-input-group">
            <label>Security Key</label>
            <input
              type="password"
              className="login-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="login-button">
            Authenticate <Shield size={18} />
          </button>
        </form>
      </div>
    </div>
  );

  const renderLoader = () => (
    <div className="loader-container" style={{ height: '100vh', display: 'grid', placeItems: 'center', background: isDarkMode ? '#050507' : '#f1f5f9' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="brand-logo" style={{ width: 80, height: 80, margin: '0 auto 1.5rem', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)', borderRadius: '20px', boxShadow: '0 0 30px rgba(58, 123, 213, 0.3)' }}>
          <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
            <Cloud size={40} color="white" />
            <Zap size={20} color="#ffde59" style={{ position: 'absolute', bottom: -5, right: -5 }} />
          </div>
        </div>
        <h2 style={{ color: isDarkMode ? 'white' : '#0f172a', fontWeight: 800, fontSize: '2rem', letterSpacing: '-1px' }}>cloud<span style={{ color: '#3a7bd5' }}>X</span></h2>
        <p style={{ color: '#475569', marginTop: '0.5rem', fontWeight: 500 }}>Synchronizing Enclaves...</p>
      </div>
    </div>
  );

  const renderAIChat = () => (
    <div className="chat-container">
      <div className="chat-messages">
        {chatMessages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: msg.role === 'ai' ? 'flex-start' : 'flex-end' }}>
            {msg.role === 'ai' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px', marginBottom: '2px' }}>
                <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
                  <Cloud size={14} color="var(--accent)" />
                  <Sparkles size={8} style={{ position: 'absolute', top: -3, right: -3, color: '#ffde59' }} />
                </div>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>CloudX AI</span>
              </div>
            )}
            <div className={`message-bubble ${msg.role === 'ai' ? 'message-ai' : 'message-user'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="message-bubble message-ai" style={{ alignSelf: 'flex-start' }}>
            <div className="ai-typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={logEndRef} />
      </div>
      <form className="chat-input-area" onSubmit={handleAIQuery}>
        <input
          type="text"
          className="chat-input"
          placeholder="Ask AI about this system..."
          value={aiInput}
          onChange={(e) => setAiInput(e.target.value)}
        />
        <button type="submit" className="chat-send-btn">
          <Send size={18} />
        </button>
      </form>
    </div>
  );

  const renderOverview = () => {
    const sizeConfig = {
      nano: { height: '180px', inner: 45, outer: 65, labelSize: '1.1rem', subSize: '0.55rem', svgMax: '150px', telemetrySize: '1.1rem', telemetrySub: '0.55rem', padding: '0.75rem', gap: '0.5rem' },
      small: { height: '240px', inner: 60, outer: 80, labelSize: '1.4rem', subSize: '0.65rem', svgMax: '200px', telemetrySize: '1.4rem', telemetrySub: '0.65rem', padding: '1rem', gap: '0.75rem' },
      medium: { height: '300px', inner: 75, outer: 105, labelSize: '1.75rem', subSize: '0.7rem', svgMax: '260px', telemetrySize: '1.75rem', telemetrySub: '0.7rem', padding: '1.25rem', gap: '1rem' }
    };

    const aCfg = sizeConfig[allocationSize];
    const nCfg = sizeConfig[networkSize];

    const renderChart = () => {
      const dataToRender = isHistoricalView ? filteredHistory : history;
      const commonProps = {
        data: dataToRender,
        margin: { top: 10, right: 10, left: 0, bottom: 0 }
      };

      const ChartComponent = chartType === 'line' ? LineChart : chartType === 'bar' ? BarChart : AreaChart;
      const DataComponent = chartType === 'line' ? Line : chartType === 'bar' ? Bar : Area;
      const gridColor = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
      const textColor = isDarkMode ? '#475569' : '#94a3b8';

      return (
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent {...commonProps}>
            <defs>
              <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="time" stroke={textColor} fontSize={10} axisLine={false} tickLine={false} />
            <YAxis stroke={textColor} fontSize={10} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: isDarkMode ? '#1a1a1c' : '#ffffff', border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }}
              itemStyle={{ color: isDarkMode ? '#f8fafc' : '#0f172a', fontSize: '12px', fontWeight: 600 }}
              labelStyle={{ color: isDarkMode ? '#94a3b8' : '#64748b', marginBottom: '4px', fontSize: '11px' }}
            />

            {(chartMetric === 'combined' || chartMetric === 'cpu') && (
              <DataComponent type="monotone" dataKey="cpu" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCpu)" strokeWidth={2} name="CPU %" />
            )}
            {(chartMetric === 'combined' || chartMetric === 'memory') && (
              <DataComponent type="monotone" dataKey="memory" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorMem)" strokeWidth={2} name="RAM %" />
            )}
            {chartMetric === 'network' && (
              <>
                <DataComponent type="monotone" dataKey="rx" stroke="#10b981" fillOpacity={0} strokeWidth={2} name="RX KB/s" />
                <DataComponent type="monotone" dataKey="tx" stroke="#f59e0b" fillOpacity={0} strokeWidth={2} name="TX KB/s" />
              </>
            )}
          </ChartComponent>
        </ResponsiveContainer>
      );
    };

    const getPieData = () => {
      switch (pieMetric) {
        case 'memory':
          return [
            { name: 'Used', value: parseFloat(stats.memory?.used || 0), color: 'var(--ram)' },
            { name: 'Free', value: Math.max(0, parseFloat(stats.memory?.total || 1) - parseFloat(stats.memory?.used || 0)), color: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)' }
          ];
        case 'storage':
          const drive = stats.storage?.[0] || { total: 100, used: 0 };
          return [
            { name: 'Used', value: parseFloat(drive.used), color: 'var(--disk)' },
            { name: 'Free', value: Math.max(0, parseFloat(drive.total) - parseFloat(drive.used)), color: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)' }
          ];
        case 'pm2':
          const online = stats.pm2?.filter(p => p.status === 'online').length || 0;
          const others = (stats.pm2?.length || 0) - online;
          return [
            { name: 'Online', value: online, color: '#10b981' },
            { name: 'Offline/Stop', value: others, color: '#ef4444' }
          ];
        case 'cpu_dist':
          return (stats.processes || []).slice(0, 5).map((p, idx) => ({
            name: p.name.substring(0, 10),
            value: p.cpu,
            color: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'][idx % 5]
          }));
        default: return [];
      }
    };

    const pieData = getPieData();
    const centralLabel = pieMetric === 'memory' ? `${stats.memory?.percentage}%` :
      pieMetric === 'storage' ? `${stats.storage?.[0]?.percentage}%` :
        pieMetric === 'pm2' ? `${stats.pm2?.length || 0}` : 'Top 5';
    const subLabel = pieMetric === 'memory' ? 'RAM Used' :
      pieMetric === 'storage' ? 'Disk Used' :
        pieMetric === 'pm2' ? 'Procs' : 'CPU Dist';

    return (
      <>
        <div className="grid-stats">
          {uiStyle === 'tactical' ? (
            <>
              {/* CPU HUD */}
              <div className="hud-stat-card animate-in">
                <div className="hud-corner corner-tl"></div>
                <div className="hud-corner corner-tr"></div>
                <div className="hud-corner corner-bl"></div>
                <div className="hud-corner corner-br"></div>

                <div className="hud-stat-header">
                  <div className="hud-stat-info">
                    <span className="hud-metric-label">CPU_COMPUTE_LOAD</span>
                    <span className="hud-metric-value">{Math.round(stats.cpu?.usage || 0)}%</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`hud-status-tag ${parseFloat(stats.cpu?.usage || 0) > 85 ? 'critical' : parseFloat(stats.cpu?.usage || 0) > 70 ? 'warning' : 'active'}`}>
                        {parseFloat(stats.cpu?.usage || 0) > 85 ? 'CRITICAL_LOAD' : 'OPTIMAL_STATE'}
                      </span>
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', opacity: 0.6, fontFamily: 'monospace' }}>
                        SRC: {stats.system?.isFromDB ? 'CLOUD_DB_SYNC' : (stats.system?.hostname?.includes('dummy') ? 'PENDING_SIGNAL' : 'VM_AGENT')}
                      </span>
                    </div>
                  </div>
                  <div className="hud-stat-visual">
                    <svg width="60" height="60" viewBox="0 0 60 60">
                      <circle cx="30" cy="30" r="26" className="hud-arc-bg" />
                      <circle cx="30" cy="30" r="26" className="hud-arc-fill"
                        style={{
                          strokeDasharray: 163,
                          strokeDashoffset: 163 - (163 * (stats.cpu?.usage || 0)) / 100,
                          stroke: parseFloat(stats.cpu?.usage || 0) > 85 ? '#ef4444' : 'var(--accent)'
                        }}
                      />
                    </svg>
                    <Cpu size={18} className="stat-icon-integrated" />
                  </div>
                </div>
              </div>

              {/* MEMORY HUD */}
              <div className="hud-stat-card animate-in" style={{ animationDelay: '0.1s' }}>
                <div className="hud-corner corner-tl"></div>
                <div className="hud-corner corner-tr"></div>
                <div className="hud-corner corner-bl"></div>
                <div className="hud-corner corner-br"></div>

                <div className="hud-stat-header">
                  <div className="hud-stat-info">
                    <span className="hud-metric-label">RAM_MEMORY_POOL</span>
                    <span className="hud-metric-value">{Math.round(stats.memory?.percentage || 0)}%</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`hud-status-tag ${parseFloat(stats.memory?.percentage || 0) > 90 ? 'critical' : 'active'}`}>
                        {stats.memory?.used || 0} GB ALLOCATED
                      </span>
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', opacity: 0.6, fontFamily: 'monospace' }}>
                        SRC: {stats.system?.isFromDB ? 'CLOUD_DB_SYNC' : (stats.system?.hostname?.includes('dummy') ? 'PENDING_SIGNAL' : 'VM_AGENT')}
                      </span>
                    </div>
                  </div>
                  <div className="hud-stat-visual">
                    <svg width="60" height="60" viewBox="0 0 60 60">
                      <circle cx="30" cy="30" r="26" className="hud-arc-bg" />
                      <circle cx="30" cy="30" r="26" className="hud-arc-fill"
                        style={{
                          strokeDasharray: 163,
                          strokeDashoffset: 163 - (163 * (stats.memory?.percentage || 0)) / 100,
                          stroke: 'var(--ram)'
                        }}
                      />
                    </svg>
                    <Box size={18} className="stat-icon-integrated" style={{ color: 'var(--ram)', filter: 'none' }} />
                  </div>
                </div>
              </div>

              {/* DISK HUD */}
              <div className="hud-stat-card animate-in" style={{ animationDelay: '0.2s' }}>
                <div className="hud-corner corner-tl"></div>
                <div className="hud-corner corner-tr"></div>
                <div className="hud-corner corner-bl"></div>
                <div className="hud-corner corner-br"></div>

                <div className="hud-stat-header">
                  <div className="hud-stat-info">
                    <span className="hud-metric-label">DISK_STORAGE_ARRAY</span>
                    <span className="hud-metric-value">{Math.round(stats.storage?.[0]?.percentage || 0)}%</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`hud-status-tag ${stats.storage?.[0]?.percentage > 85 ? 'warning' : 'active'}`}>
                        {stats.storage?.[0]?.used || 0} GB CAPTURED
                      </span>
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', opacity: 0.6, fontFamily: 'monospace' }}>
                        SRC: {stats.system?.isFromDB ? 'CLOUD_DB_SYNC' : (stats.system?.hostname?.includes('dummy') ? 'PENDING_SIGNAL' : 'VM_AGENT')}
                      </span>
                    </div>
                  </div>
                  <div className="hud-stat-visual">
                    <svg width="60" height="60" viewBox="0 0 60 60">
                      <circle cx="30" cy="30" r="26" className="hud-arc-bg" />
                      <circle cx="30" cy="30" r="26" className="hud-arc-fill"
                        style={{
                          strokeDasharray: 163,
                          strokeDashoffset: 163 - (163 * (stats.storage?.[0]?.percentage || 0)) / 100,
                          stroke: 'var(--disk)'
                        }}
                      />
                    </svg>
                    <HardDrive size={18} className="stat-icon-integrated" style={{ color: 'var(--disk)', filter: 'none' }} />
                  </div>
                </div>
              </div>

              {/* NETWORK HUD */}
              <div className="hud-stat-card animate-in" style={{ animationDelay: '0.3s' }}>
                <div className="hud-corner corner-tl"></div>
                <div className="hud-corner corner-tr"></div>
                <div className="hud-corner corner-bl"></div>
                <div className="hud-corner corner-br"></div>

                <div className="hud-stat-header">
                  <div className="hud-stat-info">
                    <span className="hud-metric-label">NET_THROUGHPUT_X1</span>
                    <span className="hud-metric-value">
                      {stats.network?.[0]?.rx > 1024
                        ? `${(stats.network[0].rx / 1024).toFixed(1)}`
                        : `${Math.round(stats.network?.[0]?.rx || 0)}`}
                    </span>
                    <span className="hud-status-tag active">
                      {stats.network?.[0]?.rx > 1024 ? 'SYNC_ACTIVE [MB/s]' : 'SYNC_ACTIVE [KB/s]'}
                    </span>
                  </div>
                  <div className="hud-stat-visual">
                    <svg width="60" height="60" viewBox="0 0 60 60">
                      <circle cx="30" cy="30" r="26" className="hud-arc-bg" />
                      <circle cx="30" cy="30" r="26" className="hud-arc-fill"
                        style={{
                          strokeDasharray: 163,
                          strokeDashoffset: 163 - (163 * Math.min(100, (stats.network?.[0]?.rx / 1024) * 100)) / 100,
                          stroke: 'var(--online)'
                        }}
                      />
                    </svg>
                    <Wifi size={18} className="stat-icon-integrated" style={{ color: 'var(--online)', filter: 'none' }} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* AURA STYLE CARDS */}
              <div className="aura-card animate-in">
                <div className="aura-metric-wrap">
                  <span className="aura-label">Compute Core</span>
                  <span className="aura-value">{stats.cpu?.usage || 0}%</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div className="aura-badge">
                      <Cpu size={12} /> {stats.cpu?.cores} CORES
                    </div>
                    <div className={`aura-badge ${parseFloat(stats.cpu?.usage || 0) > 80 ? 'critical' : ''}`}>
                      <Activity size={12} /> {stats.cpu?.speed} GHZ
                    </div>
                  </div>
                </div>
              </div>

              <div className="aura-card animate-in" style={{ animationDelay: '0.1s' }}>
                <div className="aura-metric-wrap">
                  <span className="aura-label">System Memory</span>
                  <span className="aura-value">{stats.memory?.percentage || 0}%</span>
                  <div className="aura-badge">
                    <Box size={12} /> {stats.memory?.used} / {stats.memory?.total} GB
                  </div>
                </div>
              </div>

              <div className="aura-card animate-in" style={{ animationDelay: '0.2s' }}>
                <div className="aura-metric-wrap">
                  <span className="aura-label">Persistent Storage</span>
                  <span className="aura-value">{stats.storage?.[0]?.percentage || 0}%</span>
                  <div className="aura-badge">
                    <HardDrive size={12} /> {stats.storage?.[0]?.used} GB USED
                  </div>
                </div>
              </div>

              <div className="aura-card animate-in" style={{ animationDelay: '0.3s' }}>
                <div className="aura-metric-wrap">
                  <span className="aura-label">Network Interface</span>
                  <span className="aura-value">{stats.network?.[0]?.rx || 0}</span>
                  <div className="aura-badge">
                    <Wifi size={12} /> {stats.network?.[0]?.iface} [KB/s]
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="chart-section">
          <div className="panel animate-in">
            <div className="panel-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div className="panel-title" style={{ margin: 0 }}><Activity size={18} /> Performance Analysis</div>
                {isHistoricalView && (
                  <div className="status-indicator status-offline" style={{ fontSize: '0.65rem' }}>
                    Historical View Active
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                {/* DATE TIME PICKER */}
                <div className="timeline-controller animate-in">
                  <div className="quick-range-group">
                    <button className={`quick-chip ${!isHistoricalView ? 'active' : ''}`} onClick={() => { setIsHistoricalView(false); setQuickRange('live'); }}>Live</button>
                    <button className={`quick-chip ${quickRange === 15 ? 'active' : ''}`} onClick={() => setTimePreset(15)}>15m</button>
                    <button className={`quick-chip ${quickRange === 60 ? 'active' : ''}`} onClick={() => setTimePreset(60)}>1h</button>
                    <button className={`quick-chip ${quickRange === 1440 ? 'active' : ''}`} onClick={() => setTimePreset(1440)}>24h</button>
                  </div>

                  <div className="timeline-sep" style={{ margin: '0 0.5rem' }}>|</div>

                  <div className="timeline-chip">
                    <span className="timeline-label">Start</span>
                    <input
                      type="datetime-local"
                      className="timeline-input"
                      value={startTime}
                      onChange={(e) => { setStartTime(e.target.value); setQuickRange('custom'); }}
                    />
                  </div>
                  <div className="timeline-sep"><Calendar size={14} /></div>
                  <div className="timeline-chip">
                    <span className="timeline-label">End</span>
                    <input
                      type="datetime-local"
                      className="timeline-input"
                      value={endTime}
                      onChange={(e) => { setEndTime(e.target.value); setQuickRange('custom'); }}
                    />
                  </div>

                  {!isHistoricalView ? (
                    <button className="forensic-btn" onClick={handleTimeFilter}>
                      <Filter size={14} /> Analyze
                    </button>
                  ) : (
                    <button className="forensic-btn live" onClick={() => { setIsHistoricalView(false); setQuickRange('live'); }}>
                      <RefreshCw size={14} /> Live Stream
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', background: isDarkMode ? '#111' : '#f1f5f9', borderRadius: '8px', padding: '2px', border: '1px solid var(--border)' }}>
                  <button
                    onClick={() => setChartType('area')}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', background: chartType === 'area' ? 'var(--accent)' : 'transparent', color: chartType === 'area' ? '#fff' : '#64748b', cursor: 'pointer' }}
                    title="Area Chart"
                  >
                    <TrendingUp size={14} />
                  </button>
                  <button
                    onClick={() => setChartType('line')}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', background: chartType === 'line' ? 'var(--accent)' : 'transparent', color: chartType === 'line' ? '#fff' : '#64748b', cursor: 'pointer' }}
                    title="Line Chart"
                  >
                    <Activity size={14} />
                  </button>
                  <button
                    onClick={() => setChartType('bar')}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', background: chartType === 'bar' ? 'var(--accent)' : 'transparent', color: chartType === 'bar' ? '#fff' : '#64748b', cursor: 'pointer' }}
                    title="Bar Chart"
                  >
                    <BarChart2 size={14} />
                  </button>
                </div>

                <select
                  value={chartMetric}
                  onChange={(e) => setChartMetric(e.target.value)}
                  style={{ background: isDarkMode ? '#111' : '#fff', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="combined">Combined Stack</option>
                  <option value="cpu">CPU Load Only</option>
                  <option value="memory">RAM Usage Only</option>
                  <option value="network">Network Flux</option>
                </select>
              </div>
            </div>
            <div style={{ height: '350px' }}>
              {renderChart()}
            </div>
          </div>
        </div>

        <div className="allocation-grid" style={{ gap: '1rem' }}>
          <div className="panel animate-in" style={{ padding: aCfg.padding }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: aCfg.gap }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="panel-title" style={{ margin: 0, fontSize: '0.9rem', letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-primary)' }}><PieIcon size={14} style={{ color: 'var(--accent)' }} /> Allocation</div>
                <div className="forensic-size-picker">
                  {['nano', 'small', 'medium'].map(s => (
                    <button
                      key={s}
                      onClick={() => setAllocationSize(s)}
                      className={`size-btn ${allocationSize === s ? 'active' : ''}`}
                    >
                      {s[0]}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="polling-tag">POLLING: 1s</div>
                <select
                  value={pieMetric}
                  onChange={(e) => setPieMetric(e.target.value)}
                  className="forensic-dropdown"
                >
                  <option value="memory">MEMORY_MATRIX</option>
                  <option value="storage">STORAGE_ARRAY</option>
                  <option value="pm2">SERVICE_NODE_EXE</option>
                  <option value="cpu_dist">CORE_THREAD_ID</option>
                </select>
              </div>
            </div>
            <div style={{ height: aCfg.height, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  {/* Gauge Background Track */}
                  <Pie
                    data={[{ value: 100 }]}
                    innerRadius={aCfg.inner}
                    outerRadius={aCfg.outer}
                    startAngle={210}
                    endAngle={-30}
                    dataKey="value"
                    stroke="none"
                    fill={isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)'}
                    isAnimationActive={false}
                  />
                  <Pie
                    data={pieData}
                    innerRadius={aCfg.inner}
                    outerRadius={aCfg.outer}
                    startAngle={210}
                    endAngle={-30}
                    paddingAngle={0}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#000', border: '1px solid #333', borderRadius: '4px', padding: '6px 10px', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}
                    itemStyle={{ color: '#fff', fontSize: '0.75rem', fontFamily: 'monospace' }}
                    labelStyle={{ display: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', textAlign: 'center', top: '50%', transform: 'translateY(15%)' }}>
                <div style={{ fontSize: aCfg.labelSize, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'monospace', letterSpacing: '-1px' }}>{centralLabel}</div>
                <div style={{ fontSize: aCfg.subSize, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '2px', fontWeight: 800 }}>{subLabel}</div>
              </div>
            </div>
          </div>

          <div className="panel animate-in" style={{ animationDelay: '0.1s', padding: nCfg.padding }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: nCfg.gap }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="panel-title" style={{ margin: 0, fontSize: '0.9rem', letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-primary)' }}><Activity size={14} style={{ color: '#10b981' }} /> Network Throughput</div>
                <div className="forensic-size-picker">
                  {['nano', 'small', 'medium'].map(s => (
                    <button
                      key={s}
                      onClick={() => setNetworkSize(s)}
                      className={`size-btn ${networkSize === s ? 'active' : ''}`}
                    >
                      {s[0]}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="status-indicator status-online" style={{ fontSize: '0.55rem', letterSpacing: '1px', border: '1px solid rgba(16,185,129,0.3)' }}>LOCKED_FLUX</div>
              </div>
            </div>

            <div style={{ height: nCfg.height, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <svg viewBox="0 0 200 130" style={{ width: '100%', height: '100%', maxHeight: nCfg.svgMax, filter: 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.05))' }}>
                <defs>
                  <linearGradient id="meterGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8b0000" />
                    <stop offset="15%" stopColor="#ef4444" />
                    <stop offset="40%" stopColor="#f59e0b" />
                    <stop offset="60%" stopColor="#facc15" />
                    <stop offset="85%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                  <filter id="needleGlow">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="blur" />
                    <feFlood floodColor="white" floodOpacity="0.5" result="flood" />
                    <feComposite in="flood" in2="blur" operator="in" result="glow" />
                    <feMerge>
                      <feMergeNode in="glow" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Meter Scale Background */}
                <path
                  d="M 20 110 A 80 80 0 0 1 180 110"
                  fill="none"
                  stroke={isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)'}
                  strokeWidth="32"
                />

                <path
                  d="M 20 110 A 80 80 0 0 1 180 110"
                  fill="none"
                  stroke="url(#meterGradient)"
                  strokeWidth="28"
                  opacity="0.9"
                />

                {[0, 20, 40, 60, 80, 100].map((val) => {
                  const angle = (val / 100) * 180 - 180;
                  const rad = (angle * Math.PI) / 180;
                  const tx = 100 + 104 * Math.cos(rad);
                  const ty = 110 + 104 * Math.sin(rad);
                  return (
                    <text key={val} x={tx} y={ty} fontSize="6" fill="var(--text-secondary)" textAnchor="middle" alignmentBaseline="middle" fontWeight="900" style={{ fontFamily: 'monospace' }}>{val}</text>
                  );
                })}

                {(() => {
                  const speed = parseFloat(stats.network?.[0]?.rx || 0);
                  const valRel = Math.min(100, (speed / 2048) * 100);
                  const angle = (valRel / 100) * 180;
                  return (
                    <g style={{ transition: 'transform 1s cubic-bezier(0.34, 1.56, 0.64, 1)', transform: `rotate(${angle}deg)`, transformOrigin: '100px 110px' }} filter="url(#needleGlow)">
                      <line x1="100" y1="110" x2="25" y2="110" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                      <circle cx="100" cy="110" r="5" fill="#fff" />
                      <circle cx="100" cy="110" r="2" fill="#000" />
                    </g>
                  );
                })()}
              </svg>

              <div style={{ position: 'absolute', textAlign: 'center', top: '50%', transform: 'translateY(15%)' }}>
                <div style={{ fontSize: nCfg.telemetrySize, fontWeight: 900, color: '#fff', letterSpacing: '-1.5px', fontFamily: 'monospace' }}>
                  {stats.network?.[0]?.rx || 0} <small style={{ fontSize: nCfg.telemetrySub, opacity: 0.7, fontWeight: 700 }}>KB/s</small>
                </div>
                <div style={{ fontSize: nCfg.telemetrySub, color: '#10b981', textTransform: 'uppercase', letterSpacing: '3px', marginTop: '2px', fontWeight: 900 }}>
                  FLUX RATE
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel animate-in" style={{ animationDelay: '0.2s', padding: '1.25rem', marginTop: '1rem' }}>
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="panel-title" style={{ margin: 0, fontSize: '0.9rem', letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                <Globe size={14} style={{ color: '#3b82f6' }} /> Geospatial Trace
              </div>
              <div className="polling-tag" style={{ border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6' }}>GPS_LOCKED</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div className="forensic-size-picker" style={{ margin: 0 }}>
                <button
                  onClick={() => setViewMode('target')}
                  className={`size-btn ${viewMode === 'target' ? 'active' : ''}`}
                >
                  TARGET_BASE
                </button>
                <button
                  onClick={handleLocateSelf}
                  className={`size-btn ${viewMode === 'self' ? 'active' : ''}`}
                >
                  LOCATE_ME
                </button>
              </div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'monospace', borderLeft: '1px solid var(--border)', paddingLeft: '0.75rem' }}>
                MODE: {viewMode.toUpperCase()} | GPS: {viewMode === 'target' ? `${stats.geo?.lat}, ${stats.geo?.lng}` : userCoords ? `${userCoords.lat.toFixed(4)}, ${userCoords.lng.toFixed(4)}` : 'SCANNING...'}
              </div>
              <div className="forensic-size-picker" style={{ margin: 0 }}>
                {[
                  { id: 'radar', label: 'RADAR', t: 'm' },
                  { id: 'satellite', label: '3D_SAT', t: 'k' },
                  { id: 'hybrid', label: 'HYBRID', t: 'h' },
                  { id: 'terrain', label: 'TERRAIN', t: 'p' }
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMapType(m.id)}
                    className={`size-btn ${mapType === m.id ? 'active' : ''}`}
                    style={{ padding: '4px 10px', minWidth: '60px' }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="forensic-size-picker" style={{ margin: 0 }}>
                <button className="size-btn" onClick={() => setMapZoom(Math.max(1, mapZoom - 1))}>-</button>
                <div style={{ padding: '4px 8px', fontSize: '0.6rem', color: 'var(--text-primary)', fontWeight: 800, fontFamily: 'monospace' }}>Z:{mapZoom}</div>
                <button className="size-btn" onClick={() => setMapZoom(Math.min(21, mapZoom + 1))}>+</button>
              </div>
              <button
                className="forensic-btn"
                style={{ padding: '4px 8px', height: '26px' }}
                onClick={() => {
                  setMapZoom(16);
                  setMapType('hybrid');
                }}
              >
                <MapPin size={12} /> PINPOINT
              </button>
            </div>
          </div>

          <div style={{ height: '300px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', position: 'relative' }}>
            <iframe
              title="target-location"
              width="100%"
              height="100%"
              frameBorder="0"
              style={{
                border: 0,
                filter: mapType === 'radar' && isDarkMode ? 'grayscale(1) invert(0.9) contrast(1.2) opacity(0.8)' : 'none',
                transition: 'all 0.5s ease'
              }}
              src={`https://maps.google.com/maps?q=${viewMode === 'target' ? `${stats.geo?.lat},${stats.geo?.lng}` :
                userCoords ? `${userCoords.lat},${userCoords.lng}` : `${stats.geo?.lat},${stats.geo?.lng}`
                }&t=${mapType === 'radar' ? 'm' : mapType === 'satellite' ? 'k' : mapType === 'hybrid' ? 'h' : 'p'}&z=${mapZoom}&ie=UTF8&iwloc=&output=embed`}
              allowFullScreen
            ></iframe>
            <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', pointerEvents: 'none', textAlign: 'right' }}>
              <div style={{ background: 'rgba(0,0,0,0.8)', padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid var(--accent)', color: '#fff', fontSize: '0.6rem', fontFamily: 'monospace', backdropFilter: 'blur(5px)' }}>
                SIGNAL_PATH: ACTIVE_UPLINK<br />
                IP_RESOLVER: {stats.geo?.ip}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const fetchKinesisHistory = async () => {
    try {
      const response = await fetch(`${SOCKET_SERVER}/api/stream-data`);
      const data = await response.json();
      if (Array.isArray(data)) {
        // Map DynamoDB items back to the format the UI expects
        const mappedData = data.map(item => ({
          id: item.id.substring(0, 8),
          sequenceNumber: item.id,
          data: item.raw_data,
          approximateArrivalTimestamp: item.timestamp
        }));
        setKinesisData(prev => {
          const combined = [...mappedData, ...prev];
          const unique = Array.from(new Map(combined.map(item => [item.sequenceNumber, item])).values());
          return unique.slice(0, 100);
        });
        toast.success('Kinesis Sync', { description: `Retrieved ${data.length} historical records.` });
      }
    } catch (err) {
      console.error("API Error:", err);
      toast.error('Sync Failed', { description: 'Could not reach analytics API.' });
    }
  };



  const renderKinesisStream = () => (
    <div className="panel animate-in">
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="panel-title" style={{ margin: 0 }}><Zap size={18} style={{ color: '#ffde59' }} /> Live Kinesis Data Stream</div>
          <div className="status-badge online" style={{ fontSize: '0.7rem' }}>CLOUDX_INGRESS_ACTIVE</div>
          <button
            onClick={fetchKinesisHistory}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.6rem', cursor: 'pointer' }}
          >
            <RefreshCw size={10} style={{ marginRight: '4px' }} /> REFRESH_API
          </button>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
          Total Pulled: {kinesisData.length} records
        </div>
      </div>

      <div className="kinesis-feed-container" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto', paddingRight: '0.5rem' }}>
        {kinesisData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
            <RefreshCw className="animate-spin" size={32} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <p>Scanning Kinesis Shards...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {kinesisData.map((record, i) => (
              <motion.div
                key={record.sequenceNumber}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ position: 'absolute', top: 0, right: 0, padding: '2px 8px', fontSize: '0.6rem', background: 'var(--accent)', color: '#fff', borderRadius: '0 0 0 8px', fontFamily: 'monospace' }}>
                  {record.id}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ padding: '6px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '6px' }}>
                      <User size={14} style={{ color: 'var(--accent)' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{record.data.user}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{record.data.action.toUpperCase()}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{record.data.page}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{new Date(record.data.timestamp).toLocaleTimeString()}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                    <Globe size={10} /> {record.data.meta.browser}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                    <Monitor size={10} /> {record.data.meta.os}
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: '0.6rem', color: '#475569', fontFamily: 'monospace' }}>
                    SEQ: {record.sequenceNumber.substring(record.sequenceNumber.length - 12)}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="panel">
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="panel-title" style={{ margin: 0 }}><Bell size={18} /> Event History Log</div>
          <button
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            style={{ background: notificationsEnabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: notificationsEnabled ? '#10b981' : '#ef4444', border: '1px solid currentColor', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {notificationsEnabled ? <Bell size={14} /> : <BellOff size={14} />}
            {notificationsEnabled ? 'Alerts On' : 'Alerts Muted'}
          </button>
        </div>
        <button
          onClick={() => setAlerts([])}
          style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Trash2 size={14} /> Clear All
        </button>
      </div>

      {alerts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
          <Bell size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
          <p>No logged events captured yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {alerts.map(alert => (
            <div key={alert.id} style={{ display: 'flex', gap: '1.5rem', padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', borderLeft: `4px solid ${alert.type === 'error' ? '#ef4444' : alert.type === 'warning' ? '#f59e0b' : alert.type === 'success' ? '#10b981' : '#3b82f6'}` }}>
              <div style={{ color: alert.type === 'error' ? '#ef4444' : alert.type === 'warning' ? '#f59e0b' : alert.type === 'success' ? '#10b981' : '#3b82f6' }}>
                {alert.type === 'error' ? <AlertTriangle size={20} /> : alert.type === 'warning' ? <AlertTriangle size={20} /> : alert.type === 'success' ? <Shield size={20} /> : <Clock size={20} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <h4 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{alert.title}</h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{alert.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );


  if (!isLoggedIn) return renderLogin();
  if (!stats) return renderLoader();

  return (
    <div className={`app-shell ui-${uiStyle}`}>
      {uiStyle === 'aura' && (
        <div className="aura-mesh-bg">
          <div className="aura-blob"></div>
          <div className="aura-blob aura-blob-2"></div>
          <div className="aura-blob aura-blob-3"></div>
        </div>
      )}
      <div className="bg-watermark">
        <div style={{ position: 'relative' }}>
          <Cloud size={600} />
          <Zap size={200} style={{ position: 'absolute', bottom: '10%', right: '10%', color: '#ffde59', opacity: 0.2 }} />
        </div>
      </div>
      <Toaster theme={isDarkMode ? 'dark' : 'light'} position="top-right" closeButton richColors />
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo" style={{ display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)', width: 32, height: 32 }}>
            <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
              <Cloud size={18} color="white" />
              <Zap size={10} color="#ffde59" style={{ position: 'absolute', bottom: -2, right: -2 }} />
            </div>
          </div>
          <span className="brand-name" style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.5px' }}>cloud<span style={{ color: '#3a7bd5' }}>X</span></span>
        </div>

        <nav className="nav-group">
          <div className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            <LayoutDashboard size={18} /> <span>Overview</span>
          </div>
          <div className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
            <div style={{ position: 'relative' }}>
              {notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}
              {alerts.filter(a => !a.read).length > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, background: '#ef4444', borderRadius: '50%', border: '2px solid var(--sidebar)' }}></span>
              )}
            </div>
            <span>Notifications</span>
          </div>
          <div className={`nav-item ${activeTab === 'processes' ? 'active' : ''}`} onClick={() => setActiveTab('processes')}>
            <Activity size={18} /> <span>Processes</span>
          </div>
          <div className={`nav-item ${activeTab === 'network' ? 'active' : ''}`} onClick={() => setActiveTab('network')}>
            <Wifi size={18} /> <span>Network</span>
          </div>
          <div className={`nav-item ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>
            <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
              <Cloud size={18} />
              <Sparkles size={10} style={{ position: 'absolute', top: -4, right: -4, color: '#ffde59' }} />
            </div>
            <span>AI Assistant</span>
          </div>
          <div className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
            <Terminal size={18} /> <span>Terminal</span>
          </div>
          <div className={`nav-item ${activeTab === 'kinesis' ? 'active' : ''}`} onClick={() => setActiveTab('kinesis')}>
            <Zap size={18} /> <span>Kinesis Stream</span>
          </div>
          <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <Settings size={18} /> <span>Infrastructure</span>
          </div>
        </nav>

        <div className="sidebar-footer" onClick={handleLogout} style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: 'auto', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #00d2ff, #3a7bd5)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <User size={16} color="white" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Root Admin</div>
              <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>X-90 Security Console</div>
            </div>
            <div style={{ padding: '6px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', display: 'flex', alignItems: 'center', transition: 'var(--transition)' }}>
              <LogOut size={14} />
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-bar">
          <div className="search-bar" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.75rem', background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <Search size={16} color="var(--text-secondary)" />
            <input type="text" placeholder="Search CloudX resources..." style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.8125rem', width: '200px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div className="forensic-size-picker" style={{ margin: 0 }}>
              <button
                className={`size-btn ${uiStyle === 'tactical' ? 'active' : ''}`}
                onClick={() => setUiStyle('tactical')}
              >
                TACTICAL
              </button>
              <button
                className={`size-btn ${uiStyle === 'aura' ? 'active' : ''}`}
                onClick={() => setUiStyle('aura')}
              >
                AURA_GLOW
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: '100px', border: '1px solid var(--border)' }}>
              {colorPresets.map((color) => (
                <button
                  key={color.name}
                  onClick={() => setAccentColor(color.value)}
                  title={color.name}
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: color.value,
                    border: accentColor === color.value ? '2px solid white' : 'none',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={(e) => e.target.style.transform = 'scale(1.3)'}
                  onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                />
              ))}
            </div>

            <button className="theme-toggle" onClick={() => setIsDarkMode(!isDarkMode)}>
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-primary)', background: 'rgba(255,255,255,0.02)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <Clock size={20} className="glow-icon" style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'monospace', letterSpacing: '1px' }}>
                {new Date().toLocaleTimeString()}
              </span>
            </div>
            <div
              style={{ position: 'relative', cursor: 'pointer' }}
              onClick={() => setActiveTab('notifications')}
            >
              {notificationsEnabled ? <Bell size={18} color="var(--text-secondary)" /> : <BellOff size={18} color="#ef4444" />}
              {alerts.length > 0 && (
                <span style={{ position: 'absolute', top: -2, right: -2, width: 6, height: 6, background: '#ef4444', borderRadius: '50%' }}></span>
              )}
            </div>
            <div className={`status-badge ${isConnected ? 'online' : 'offline'}`} style={{ padding: '0.4rem 0.8rem', background: isConnected ? 'rgba(0, 210, 255, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: isConnected ? '#00d2ff' : '#ef4444', borderRadius: '4px', border: '1px solid currentColor', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="live-indicator" style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }}></div>
              {isConnected ? 'CLOUDX SYNC' : 'OFFLINE'}
            </div>
          </div>
        </header>

        <div className="content-area">
          <AnimatePresence mode="wait">
            {!stats ? (
              <motion.div
                key="loader"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
                style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'var(--text-secondary)' }}
              >
                <div style={{ position: 'relative' }}>
                  <RefreshCw className="animate-spin" size={48} style={{ color: 'var(--accent)', filter: 'drop-shadow(0 0 10px var(--accent))' }} />
                  <div style={{ position: 'absolute', inset: -10, border: '1px solid var(--accent)', borderRadius: '50%', opacity: 0.3, animation: 'pulse 2s infinite' }}></div>
                </div>
                <div style={{ fontSize: '0.9rem', letterSpacing: '4px', fontWeight: 900, fontFamily: 'monospace', textShadow: '0 0 10px rgba(59, 130, 246, 0.5)' }}>INITIALIZING_CLOUDX_CORE...</div>
                <div style={{ width: '200px', height: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '1px', marginTop: '1rem', overflow: 'hidden' }}>
                  <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                    style={{ width: '100%', height: '100%', background: 'var(--accent)' }}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                variants={vTab}
                initial="hidden"
                animate="show"
                exit="exit"
                style={{ height: '100%' }}
              >
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'notifications' && renderNotifications()}
                {activeTab === 'ai' && (
                  <div className="animate-in" style={{ height: 'calc(100vh - 180px)' }}>
                    {renderAIChat()}
                  </div>
                )}
                {activeTab === 'processes' && (
                  <div className="panel animate-in">
                    <div className="panel-title"><Activity size={18} /> Active System Threads</div>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>PID</th>
                          <th>Name</th>
                          <th>CPU %</th>
                          <th>RAM %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(stats.processes || []).map((p, i) => (
                          <tr key={i}>
                            <td style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{p.pid}</td>
                            <td style={{ fontWeight: 600 }}>{p.name}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                                  <div style={{ height: '100%', width: `${p.cpu}%`, background: p.cpu > 70 ? '#ef4444' : '#3b82f6', borderRadius: 2 }}></div>
                                </div>
                                <span style={{ fontSize: '0.75rem', minWidth: '35px' }}>{p.cpu}%</span>
                              </div>
                            </td>
                            <td>{p.mem} MB</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {activeTab === 'network' && (
                  <div className="panel animate-in">
                    <div className="panel-title"><Wifi size={18} /> Network Interfaces</div>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Interface</th>
                          <th>Status</th>
                          <th>Download Speed</th>
                          <th>Upload Speed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(stats.network || []).map((n, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{n.iface}</td>
                            <td>
                              <span className={`status-indicator ${(n.operstate || '').toLowerCase() === 'up' ? 'status-online' : 'status-offline'}`}>
                                {(n.operstate || 'unknown').toUpperCase()}
                              </span>
                            </td>
                            <td>{n.rx} KB/s</td>
                            <td>{n.tx} KB/s</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {activeTab === 'logs' && (
                  <div className="terminal animate-in">
                    <div className="terminal-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Terminal size={16} color="#94a3b8" />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#94a3b8' }}>Service Logs</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#475569' }}>Host: {stats.system?.hostname || 'unknown'}</div>
                    </div>
                    <div className="terminal-body">
                      {logs.length === 0 && <div style={{ color: '#475569' }}>Awaiting log output...</div>}
                      {logs.map((log, i) => (
                        <div key={i} className="log-line">
                          <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                          <span className="log-proc">[{log.process}]</span>
                          <span className={`log-msg ${log.type === 'err' ? 'status-offline' : ''}`}>{log.data}</span>
                        </div>
                      ))}
                      <div ref={logEndRef} />
                    </div>
                  </div>
                )}
                {activeTab === 'kinesis' && renderKinesisStream()}
                {activeTab === 'settings' && (
                  <div className="panel animate-in">
                    <div className="panel-header">
                      <div className="panel-title"><Server size={20} /> System Architecture</div>
                    </div>
                    <div className="info-grid">
                      <div className="info-card">
                        <div className="info-section-title"><User size={14} /> Host Identity</div>
                        <div className="info-row">
                          <div className="info-label"><Monitor size={16} /> Operating System</div>
                          <div className="info-value">{stats.system?.distro || 'Windows'}</div>
                        </div>
                        <div className="info-row">
                          <div className="info-label"><Shield size={16} /> Architecture</div>
                          <div className="info-value">{stats.system?.platform || 'win64'}</div>
                        </div>
                        <div className="info-row">
                          <div className="info-label"><Activity size={16} /> Host Name</div>
                          <div className="info-value">{stats.system?.hostname || 'unknown'}</div>
                        </div>
                      </div>

                      <div className="info-card">
                        <div className="info-section-title"><Cpu size={14} /> Core Logic</div>
                        <div className="info-row">
                          <div className="info-label"><Box size={16} /> CPU Cores</div>
                          <div className="info-value">{stats.cpu?.cores || 0} Physical</div>
                        </div>
                        <div className="info-row">
                          <div className="info-label"><TrendingUp size={16} /> Clock Speed</div>
                          <div className="info-value">{stats.cpu?.speed || 0} GHz</div>
                        </div>
                        <div className="info-row">
                          <div className="info-label"><Clock size={16} /> Session Uptime</div>
                          <div className="info-value">{(stats.system?.uptime / 3600 || 0).toFixed(2)} Hrs</div>
                        </div>
                      </div>

                      <div className="info-card" style={{ gridColumn: 'span 2' }}>
                        <div className="info-section-title"><Activity size={14} /> VM Signal Intelligence (Metric Mapping)</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
                          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div style={{ fontWeight: 800, color: 'var(--accent)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>CPU_TELEMETRY</div>
                            <ul style={{ listStyle: 'none', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <li>• Usage: Real-time load across all logic cores</li>
                              <li>• Model: {stats.system?.cpu_model || 'Detecting...'}</li>
                              <li>• Frequency: Clock speed tracking (GHz)</li>
                              <li>• Hierarchy: Physical cores vs Logical threads</li>
                            </ul>
                          </div>
                          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div style={{ fontWeight: 800, color: 'var(--ram)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>MEMORY_POOL</div>
                            <ul style={{ listStyle: 'none', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <li>• Capacity: Physical RAM registered in BIOS</li>
                              <li>• Allocation: Active memory footprint (MB/GB)</li>
                              <li>• Availability: Headroom for new buffer sets</li>
                              <li>• Swap/Virtual: Paging file utilization (auto-scaling)</li>
                            </ul>
                          </div>
                          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div style={{ fontWeight: 800, color: 'var(--online)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>NETWORK_INGRESS</div>
                            <ul style={{ listStyle: 'none', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <li>• Throughput: Bitrate sync for primary NIC</li>
                              <li>• Flux: Upload vs Download variance</li>
                              <li>• State: Operational status (UP/DOWN/STALLED)</li>
                              <li>• Latency: Packet delivery time (estimated)</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* AI POPUP UI */}
      <div className={`ai-popup ${isAIChatOpen ? 'open' : ''}`}>
        <div className="ai-popup-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
              <Cloud size={18} color="white" />
              <Sparkles size={10} style={{ position: 'absolute', top: -4, right: -4, color: '#ffde59' }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>CloudX Intelligence</span>
          </div>
          <button onClick={() => setIsAIChatOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>×</button>
        </div>
        <div className="ai-popup-body">
          {renderAIChat()}
        </div>
      </div>

      <button className={`ai-trigger ${isAIChatOpen ? 'active' : ''}`} onClick={() => setIsAIChatOpen(!isAIChatOpen)}>
        <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
          <Cloud size={28} />
          <Sparkles size={16} style={{ position: 'absolute', top: -10, right: -10, color: '#ffde59' }} />
        </div>
      </button>
    </div >
  );
};

export default App;
