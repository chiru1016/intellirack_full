# IntelliRack - Smart Inventory Management System

A comprehensive IoT-based smart shelf system for real-time inventory tracking, monitoring, and management using ESP32, load cell sensors, NFC tags, and cloud connectivity.

## 🚀 Features

### Core Functionality

- **Real-time Weight Monitoring** - Precise weight measurements with instant updates
- **NFC Tag Integration** - Automatic ingredient identification via NFC tags
- **OLED Display** - Clear visual feedback with 128x64 OLED screen
- **LED Status Indicators** - Color-coded stock level indicators
- **WiFi Connectivity** - Easy WiFi setup with web configuration portal
- **MQTT Cloud Integration** - Real-time data streaming and remote control
- **Web Dashboard** - Remote monitoring and control interface

### Advanced Features

- **Configuration Management** - Persistent settings stored in flash memory
- **Remote Control** - Complete device control via MQTT commands
- **Auto-Tare Functionality** - Automatic zeroing for drift correction
- **Multi-point Calibration** - Advanced scale calibration
- **NFC Tag Programming** - Remote writing of ingredient data to tags
- **Factory Reset** - Complete system reset capability
- **Device-Specific Addressing** - Individual device control in multi-device setups

### New Enhanced Features (v2.0)

#### 📊 Analytics & Insights

- **Real-time Charts** - Usage trends, ingredient breakdown, device health
- **Interactive Dashboards** - Customizable widgets and metrics
- **Usage Analytics** - Historical data analysis and patterns
- **Stock Level Visualization** - Pie charts and bar graphs
- **Device Health Monitoring** - Uptime and performance tracking

#### 🔔 Smart Alert System

- **Priority-based Alerts** - High, Medium, Low priority classification
- **Alert Acknowledgment** - Mark alerts as read/acknowledged
- **Filtering & Sorting** - Filter by type, status, and priority
- **Alert Statistics** - Real-time alert counts and trends
- **Bulk Operations** - Acknowledge all alerts at once

#### 📈 Enhanced Logging

- **Advanced Search** - Search by ingredient, device, or tag UID
- **Filtering Options** - Filter by status, date range, device
- **Export Functionality** - Export logs as CSV for analysis
- **Log Statistics** - Comprehensive log analytics
- **Data Cleanup** - Automatic cleanup of old logs

#### ⚙️ User Settings & Preferences

- **Notification Preferences** - Email, push, and alert settings
- **Display Settings** - Theme, language, timezone configuration
- **Data Management** - Backup frequency and retention settings
- **Alert Thresholds** - Customizable stock level alerts
- **Export & Backup** - Data export and backup functionality

#### 🎨 Modern UI/UX

- **Glass Morphism Design** - Beautiful glass-like interface
- **Responsive Layout** - Works on all devices and screen sizes
- **Real-time Updates** - Live data updates via WebSocket
- **Interactive Components** - Hover effects and smooth animations
- **Dark/Light Theme** - Theme switching capability

## 🛠️ Tech Stack

### Frontend

- **Next.js 14** - React framework with App Router
- **Tailwind CSS** - Utility-first CSS framework
- **Recharts** - Interactive charts and data visualization
- **Socket.io Client** - Real-time communication
- **Glass Morphism** - Modern UI design patterns

### Backend

- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **Socket.io** - Real-time bidirectional communication
- **MQTT** - IoT messaging protocol
- **JWT** - Authentication and authorization

### Hardware

- **ESP32** - Microcontroller with WiFi and Bluetooth
- **HX711** - Load cell amplifier
- **Load Cell** - Weight sensor (5kg recommended)
- **PN532** - NFC/RFID module
- **SSD1306** - OLED display (128x64)
- **WS2812B** - Addressable RGB LED strip

## 📋 Installation & Setup

### Prerequisites

- Node.js 18+ and npm
- MongoDB database
- MQTT broker (Mosquitto recommended)
- Arduino IDE 2.0+
- ESP32 development board

### Backend Setup

```bash
cd intelliRack-server
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

### Frontend Setup

```bash
cd intelliRack-web
npm install
cp .env.example .env
# Edit .env with your API URL
npm run dev
```

### Hardware Setup

1. Connect components according to pin diagram
2. Install required Arduino libraries
3. Upload firmware to ESP32
4. Configure WiFi and MQTT settings

## 🔧 Configuration

### MQTT Topics

- `intellirack/{deviceId}/command` - Device-specific commands
- `intellirack/broadcast/command` - Broadcast commands
- `intellirack/{deviceId}/data` - Device data publishing
- `intellirack/{deviceId}/response` - Command responses
- `intellirack/{deviceId}/heartbeat` - Device heartbeat

### API Endpoints

#### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

#### Devices

- `GET /api/devices/my` - Get user's devices
- `POST /api/devices/register` - Register new device
- `GET /api/devices/:rackId` - Get specific device
- `GET /api/devices/status` - Get device status

#### Logs

- `GET /api/logs` - Get logs with filtering
- `GET /api/logs/stats` - Get log statistics
- `GET /api/logs/export` - Export logs as CSV
- `GET /api/logs/device/:deviceId` - Get device logs
- `DELETE /api/logs/cleanup` - Clean up old logs

#### Alerts

- `GET /api/alerts` - Get alerts with filtering
- `PATCH /api/alerts/:alertId/acknowledge` - Acknowledge alert
- `PATCH /api/alerts/acknowledge-all` - Acknowledge all alerts
- `GET /api/alerts/stats` - Get alert statistics
- `DELETE /api/alerts/:alertId` - Delete alert
- `DELETE /api/alerts/clear-acknowledged` - Clear acknowledged alerts

## 🎯 Usage Examples

### Device Commands

```javascript
// Tare the scale
socket.emit("sendCommand", {
	deviceId: "rack_001",
	command: "tare",
});

// Set configuration
socket.emit("sendCommand", {
	deviceId: "rack_001",
	command: "set_config",
	settings: {
		ledEnabled: true,
		soundEnabled: false,
		autoTare: true,
		mqttPublishInterval: 5000,
	},
	weightThresholds: {
		min: 5.0,
		low: 100.0,
		moderate: 200.0,
		good: 500.0,
		max: 5000.0,
	},
});

// Broadcast command to all devices
socket.emit("sendCommand", {
	deviceId: "broadcast",
	command: "broadcast",
	broadcastCommand: "restart",
});
```

### Data Export

```javascript
// Export logs as CSV
fetch("/api/logs/export?format=csv&startDate=2024-01-01&endDate=2024-01-31", {
	headers: { Authorization: `Bearer ${token}` },
});

// Export user data
const data = {
	user: userData,
	settings: userSettings,
	exportDate: new Date().toISOString(),
};
const blob = new Blob([JSON.stringify(data, null, 2)], {
	type: "application/json",
});
```

## 🔒 Security Features

- **JWT Authentication** - Secure token-based authentication
- **User Isolation** - Users can only access their own devices
- **Input Validation** - Server-side validation for all inputs
- **CORS Protection** - Cross-origin resource sharing protection
- **Rate Limiting** - API rate limiting (can be implemented)
- **Data Encryption** - Sensitive data encryption (can be implemented)

## 📊 Monitoring & Analytics

### Real-time Metrics

- Device online/offline status
- Weight measurements and trends
- Stock level indicators
- Alert generation and acknowledgment
- Usage patterns and consumption

### Historical Data

- Weight history over time
- Ingredient consumption patterns
- Device performance metrics
- Alert frequency and types
- User interaction patterns

## 🚀 Deployment

### Docker Deployment

```bash
# Backend
cd intelliRack-server
docker build -t intellirack-server .
docker run -p 3001:3001 intellirack-server

# Frontend
cd intelliRack-web
docker build -t intellirack-web .
docker run -p 3000:3000 intellirack-web
```

### Environment Variables

```bash
# Backend (.env)
MONGO_URI=mongodb://localhost:27017/intellirack
JWT_SECRET=your-secret-key
MQTT_BROKER=mqtt://localhost:1883
PORT=3001

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

- Create an issue on GitHub
- Check the documentation
- Review the troubleshooting guide

## 🔮 Roadmap

### Future Features

- **Mobile App** - Native iOS/Android applications
- **Machine Learning** - Predictive analytics and smart recommendations
- **Multi-language Support** - Internationalization
- **Advanced Notifications** - Push notifications and email alerts
- **API Documentation** - Swagger/OpenAPI documentation
- **Unit Tests** - Comprehensive test coverage
- **Performance Optimization** - Database indexing and caching
- **Backup & Recovery** - Automated backup systems

---

**IntelliRack v2.0** - Smart Inventory Management for the Modern World
