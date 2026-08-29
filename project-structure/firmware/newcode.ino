#include <Arduino.h>
#include "HX711.h"
#include <Wire.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_GFX.h>
#include <PN532_HSU.h>
#include <PN532.h>
#include <NfcAdapter.h>
#include <NdefMessage.h>
#include <NdefRecord.h>
#include <Adafruit_NeoPixel.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <PubSubClient.h>
#include <SPIFFS.h>
#include <ArduinoJson.h>
#include <WiFiClientSecure.h>
#include <ArduinoOTA.h>

// Forward declarations - must be before any function definitions
void handleJSONCommand(String jsonCommand, bool isBroadcast);
void handleSetConfig(JsonDocument& doc);
void handleSetThresholds(JsonDocument& doc);
void handleSetDevice(JsonDocument& doc);
void handleSetMQTT(JsonDocument& doc);
void startCalibration();
void clearNFCTag();
void factoryReset();
void publishConfiguration();
void publishMQTTResponse(String command, String response);
void writeIngredient();
void clearCard();
void printStatus();
void printWiFiStatus();
void resetWiFi();
void printMQTTStatus();
void printDeviceInfo();
void printHelp();
void setupWiFi();
void loadConfiguration();
void saveConfiguration();
void generateDeviceID();
void publishMQTTData();
void publishDeviceInfo();
void publishHeartbeat();
void updateDisplay();
void safeDisplayUpdate();
void performTare();
void calibrateScale();
void calibrateScaleAuto(float knownWeight = 100.0);
void handleNFCReadAPI();
void handleNFCWriteAPI();
void handleNFCClearAPI();
void handleNFCStatusAPI();
void formatNFCTag();
void testLEDs();
void attemptNFCRecovery();

// HX711 circuit wiring
const int LOADCELL_DOUT_PIN = 5;
const int LOADCELL_SCK_PIN = 15;
HX711 scale;
float calibration_factor = 113.81;

// WS2812B LED Setup
#define LED_PIN     13
#define NUM_LEDS    32
Adafruit_NeoPixel strip(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);

// OLED Display Setup
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
bool displayAvailable = false;

// NFC setup
HardwareSerial mySerial(2);
PN532_HSU pn532hsu(mySerial);
PN532 nfc(pn532hsu);
NfcAdapter nfcAdapter(pn532hsu);

// WiFi Manager
WiFiManager wifiManager;
WebServer server(80);
bool wifiConnected = false;

// MQTT Client (for cloud connectivity)
WiFiClientSecure espClient;

PubSubClient mqtt(espClient);
bool mqttEnabled = false;
const char* mqtt_server = "3ea321c1c4114effa6530718d7b7c468.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_user = "intellirack";
const char* mqtt_pass = "intellirack@123";
String mqttTopic;

// CA certificate for mqtt.judesonleo.app
const char* ca_cert = 
"-----BEGIN CERTIFICATE-----\n" \
"MIIDvDCCAqSgAwIBAgIUBi18zLjZumqI6PCT3zewTeMST6wwDQYJKoZIhvcNAQEL\n" \
"BQAwbzELMAkGA1UEBhMCSU4xCzAJBgNVBAgMAlROMRAwDgYDVQQHDAdDaGVubmFp\n" \
"MRQwEgYDVQQKDAtJbnRlbGxpUmFjazENMAsGA1UECwwETVFUVDEcMBoGA1UEAwwT\n" \
"bXF0dC5qdWRlc29ubGVvLmFwcDAeFw0yNTA3MjIwODU1NTJaFw0yODA1MTEwODU1\n" \
"NTJaMG8xCzAJBgNVBAYTAklOMQswCQYDVQQIDAJUTjEQMA4GA1UEBwwHQ2hlbm5h\n" \
"aTEUMBIGA1UECgwLSW50ZWxsaVJhY2sxDTALBgNVBAsMBE1RVFQxHDAaBgNVBAMM\n" \
"E21xdHQuanVkZXNvbmxlby5hcHAwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEK\n" \
"AoIBAQCtKj8OH0B5hYSnZvk2LSwDTfO3aui4ON7Wc3O6r7QJn6PLw8Eznbalo0Cl\n" \
"yIEvzo8PVK7wQ/mSJpy8x9eN1qGsFtpBMGMJnCAK6azYJ20HOxqM8rhHSqJEXp+c\n" \
"znTEJZCnyulnHwrxzbnow9gjUWgDcDD6qx32JHd0fadxZ12O515rKtTLloQS0/Nw\n" \
"DtKRm2C9JXxKu2gjVudI+DQwtGM7xArgSWvfTQevHJOmyiPQUH0YdE9F6g2ji1vh\n" \
"L/CUXsb+E0m0Ib7s9b0CT5VfWrLyvqYCHZ5vYSuD/E9KJyWY9Zyaf0G8nic2VU3M\n" \
"Jhs7NcZKa68CwAmdvkwHRk8Kx+15AgMBAAGjUDBOMB0GA1UdDgQWBBQCg+aLOG9z\n" \
"QNal538J3R7miKM1cTAfBgNVHSMEGDAWgBQCg+aLOG9zQNal538J3R7miKM1cTAM\n" \
"BgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQBT2I9BiOFgbPZ+QzEOgedt\n" \
"zc/qFkYyO0vo1x1zQRHwbECKRoD4Vn5X6NBkHVUJSFuhbnApImoortdz0wyRQGSA\n" \
"mgDpHZPNMSq04N4z/hUlk3VPDb7m6BmtpRZAZsDqlPFeHKGZ0SU/TC7nBtjIua4g\n" \
"FI/EEaOJdj2TXqKtnfMjDmJiyOGlaGdlviJIMr+hU0V6STSiBRHIZrDJ5nEPH4dq\n" \
"JQQOLHp1Ua77nKK7x0DfAXsXZdFK85kg+Pu+EtIUoMBlRia5+L2yM0vW1dltMHNO\n" \
"YmWc+YVtPJ9wIDp0VZA1n4E/PqxQH36d3F8g0vHt7kZMNFa5Iy79MJO5ocKqO5jl\n" \
"-----END CERTIFICATE-----\n";

// Device ID will be auto-generated or loaded from config
String DEVICE_ID = ""; 
int SLOT_ID = 1; 

// Dynamic topic generation (will be set after DEVICE_ID is determined)
String MQTT_BASE_TOPIC = ""; 

// Configuration file
const char* CONFIG_FILE = "/config.json";

// Weight thresholds (configurable)
float WEIGHT_THRESHOLD_MIN = 5.0;
float WEIGHT_LOW = 100.0;
float WEIGHT_MODERATE = 200.0;
float WEIGHT_GOOD = 500.0;
float WEIGHT_MAX = 5000.0;

// System settings
bool LED_ENABLED = true;
bool SOUND_ENABLED = false;
int MQTT_PUBLISH_INTERVAL = 1000; // 1 second
bool AUTO_TARE = false;
float TARE_THRESHOLD = -20.0;

// Discovery settings
const char* MDNS_NAME = "intellirack";
const char* DISCOVERY_SERVICE = "_intellirack._tcp";
const int DISCOVERY_PORT = 80;

// Heartbeat settings
unsigned long lastHeartbeat = 0;
const int HEARTBEAT_INTERVAL = 10000; // 1 second
const int MQTT_RECONNECT_INTERVAL = 5000; // 5 seconds
unsigned long lastMqttReconnect = 0;

String lastTagUID = "";
bool tagPresent = false;
String currentIngredient = "";
float lastWeight = 0;
unsigned long lastMqttPublish = 0;

// Command variables
String pendingIngredientWrite = "";
bool calibrationMode = false;

// Error handling and status variables
bool nfcAvailable = false;
bool spiffsAvailable = false;
bool weightPreservedAtStartup = false;
unsigned long lastNFCCheck = 0;
const unsigned long NFC_CHECK_INTERVAL = 5000; // Check NFC every 5 seconds
unsigned long systemErrors = 0;
unsigned long lastErrorReset = 0;

void setup() {
  Serial.begin(115200);
  mySerial.begin(115200, SERIAL_8N1, 16, 17);

  // Initialize SPIFFS with graceful fallback
  if (!SPIFFS.begin(true)) {
    Serial.println("SPIFFS Mount Failed - continuing without persistent config");
    spiffsAvailable = false;
  } else {
    Serial.println("SPIFFS mounted successfully");
    spiffsAvailable = true;
  }

  // Load configuration (this will also set up DEVICE_ID and MQTT_BASE_TOPIC)
  loadConfiguration();

  // Set device-specific MQTT data topic
  mqttTopic = MQTT_BASE_TOPIC + "/data";
  Serial.println("MQTT Data Topic set to: " + mqttTopic);

  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("SSD1306 allocation failed"));
    Serial.println(F("Continuing without display..."));
    displayAvailable = false;
  } else {
    displayAvailable = true;
    display.display();
    delay(2000); // Pause for 2 seconds
    display.clearDisplay();

    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println("Starting...");
    display.display();
  }

  strip.begin();
  strip.setBrightness(100); // Set brightness to reasonable level (100) to prevent power issues
  strip.show();
  
  // Test LED strip initialization
  Serial.println("Testing LED strip at safe brightness...");
  
  // Brief LED test - cycle through colors at full brightness
  for (int i = 0; i < NUM_LEDS; i++) {
    strip.setPixelColor(i, strip.Color(255, 0, 0)); // Red at full brightness
  }
  strip.show();
  delay(500);
  
  for (int i = 0; i < NUM_LEDS; i++) {
    strip.setPixelColor(i, strip.Color(0, 255, 0)); // Green at full brightness
  }
  strip.show();
  delay(500);
  
  for (int i = 0; i < NUM_LEDS; i++) {
    strip.setPixelColor(i, strip.Color(0, 0, 255)); // Blue at full brightness
  }
  strip.show();
  delay(500);
  
  // Turn off all LEDs after test
  for (int i = 0; i < NUM_LEDS; i++) {
    strip.setPixelColor(i, strip.Color(0, 0, 0));
  }
  strip.show();
  
  Serial.println("LED test complete. LED_ENABLED: " + String(LED_ENABLED));

  // Setup WiFi Manager
  setupWiFi();
  
  // Setup OTA after WiFi is connected
  if (wifiConnected) {
    setupOTA();
  }

  // Initialize scale with smart startup weight detection
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  scale.set_scale(calibration_factor);
  
  // Check for pre-existing weight before taring
  Serial.println("Checking for pre-existing weight on scale...");
  delay(1000); // Let scale stabilize
  
  float preStartupWeight = scale.get_units(10); // Take 10 readings for accuracy
  Serial.println("Pre-startup raw reading: " + String(preStartupWeight, 2) + "g");
  
  if (abs(preStartupWeight) > WEIGHT_THRESHOLD_MIN) {
    // Weight detected - preserve it and continue normally!
    lastWeight = preStartupWeight; // Use the detected weight
    weightPreservedAtStartup = true; // Mark for status tracking
    Serial.println("✅ WEIGHT DETECTED ON SCALE: " + String(preStartupWeight, 1) + "g");
    Serial.println("✅ Preserving weight measurement - continuing normal operation");
    Serial.println("✅ Skipping auto-tare to maintain accuracy");
    
    if (displayAvailable) {
      display.clearDisplay();
      display.setCursor(0, 0);
      display.println("WEIGHT PRESERVED");
      display.setCursor(0, 10);
      display.println("Detected:");
      display.setCursor(0, 20);
      display.println(formatWeight(preStartupWeight));
      display.setCursor(0, 30);
      display.println("Status: " + getStockStatus(preStartupWeight));
      display.setCursor(0, 50);
      display.println("Continuing...");
      display.display();
      delay(3000); // Show status for 3 seconds
    }
  } else {
    // No significant weight - safe to tare
    Serial.println("✅ No significant weight detected - performing auto-tare");
    scale.tare();
    lastWeight = 0.0; // Start from zero
  }

  // Initialize NFC with error handling
  Serial.println("Initializing PN532 NFC module...");
  try {
    nfc.begin();
    uint32_t versiondata = nfc.getFirmwareVersion();
    if (versiondata) {
      Serial.print("Found PN532 chip with firmware version: ");
      Serial.println(versiondata, HEX);
      nfc.SAMConfig();
      nfcAvailable = true;
      Serial.println("PN532 NFC module initialized successfully");
    } else {
      Serial.println("PN532 not found - continuing without NFC functionality");
      nfcAvailable = false;
    }
  } catch (...) {
    Serial.println("PN532 initialization failed - continuing without NFC functionality");
    nfcAvailable = false;
  }

  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Ready");
  display.display();
  
  // Report startup weight status via MQTT if weight was detected
  if (abs(preStartupWeight) > WEIGHT_THRESHOLD_MIN && mqttEnabled) {
    delay(2000); // Give MQTT time to establish
    publishMQTTResponse("startup_info", "Weight preserved at startup: " + formatWeight(preStartupWeight) + "g. Status: " + getStockStatus(preStartupWeight) + ". Auto-tare skipped.");
    publishMQTTData(); // Send the current weight data immediately
  }
}

void loadConfiguration() {
  bool deviceIdFromConfig = false;
  
  // Skip SPIFFS operations if not available
  if (!spiffsAvailable) {
    Serial.println("SPIFFS not available - using default configuration");
  } else if (SPIFFS.exists(CONFIG_FILE)) {
    File file = SPIFFS.open(CONFIG_FILE, "r");
    if (file) {
      DynamicJsonDocument doc(1024);
      DeserializationError error = deserializeJson(doc, file);
      file.close();
      
      if (!error) {
        // Load device ID from config if it exists
        String configDeviceId = doc["deviceId"] | "";
        if (configDeviceId.length() > 0) {
          DEVICE_ID = configDeviceId;
          deviceIdFromConfig = true;
          Serial.println("Device ID loaded from config: " + DEVICE_ID);
        }
        
        SLOT_ID = doc["slotId"] | 1;
        calibration_factor = doc["calibrationFactor"] | 113.81;
        Serial.println("Loaded calibration factor: " + String(calibration_factor, 2));
        WEIGHT_THRESHOLD_MIN = doc["weightThresholdMin"] | 5.0;
        WEIGHT_LOW = doc["weightLow"] | 100.0;
        WEIGHT_MODERATE = doc["weightModerate"] | 200.0;
        WEIGHT_GOOD = doc["weightGood"] | 500.0;
        WEIGHT_MAX = doc["weightMax"] | 5000.0;
        LED_ENABLED = doc["ledEnabled"] | true;
        SOUND_ENABLED = doc["soundEnabled"] | false;
        MQTT_PUBLISH_INTERVAL = doc["mqttPublishInterval"] | 5000;
        AUTO_TARE = doc["autoTare"] | false;
        TARE_THRESHOLD = doc["tareThreshold"] | -20.0;
        
        Serial.println("Configuration loaded successfully");
      } else {
        Serial.println("Failed to parse config file");
      }
    }
  }
  
  // Generate device ID if not loaded from config
  if (!deviceIdFromConfig || DEVICE_ID.length() == 0) {
    Serial.println("No device ID in config, generating new one...");
    generateDeviceID();
    saveConfiguration(); // Save the newly generated device ID
  }
  
  // Set up dynamic topics now that we have the device ID
  MQTT_BASE_TOPIC = "intellirack/" + DEVICE_ID;
  Serial.println("Final Device ID: " + DEVICE_ID);
  Serial.println("MQTT Base Topic: " + MQTT_BASE_TOPIC);
}

void saveConfiguration() {
  // Skip save if SPIFFS not available
  if (!spiffsAvailable) {
    Serial.println("SPIFFS not available - configuration not saved persistently");
    return;
  }
  
  DynamicJsonDocument doc(1024);
  
  doc["deviceId"] = DEVICE_ID;
  doc["slotId"] = SLOT_ID;
  doc["calibrationFactor"] = calibration_factor;
  doc["weightThresholdMin"] = WEIGHT_THRESHOLD_MIN;
  doc["weightLow"] = WEIGHT_LOW;
  doc["weightModerate"] = WEIGHT_MODERATE;
  doc["weightGood"] = WEIGHT_GOOD;
  doc["weightMax"] = WEIGHT_MAX;
  doc["ledEnabled"] = LED_ENABLED;
  doc["soundEnabled"] = SOUND_ENABLED;
  doc["mqttPublishInterval"] = MQTT_PUBLISH_INTERVAL;
  doc["autoTare"] = AUTO_TARE;
  doc["tareThreshold"] = TARE_THRESHOLD;
  
  File file = SPIFFS.open(CONFIG_FILE, "w");
  if (file) {
    serializeJson(doc, file);
    file.close();
    Serial.println("Configuration saved successfully");
  } else {
    Serial.println("Failed to save configuration");
  }
}

void generateDeviceID() {
  // Always use chip ID for device generation to avoid WiFi dependency issues
  uint64_t chipid = ESP.getEfuseMac();
  String chipStr = String((uint32_t)(chipid >> 32), HEX) + String((uint32_t)chipid, HEX);
  chipStr.toLowerCase();
  String chipSuffix = chipStr.substring(chipStr.length() - 6);
  DEVICE_ID = "rack_" + chipSuffix;
  
  Serial.println("Generated Device ID from Chip ID: " + DEVICE_ID);
  Serial.println("Chip ID: " + chipStr);
  
  // Try to get MAC address for additional info (non-critical)
  WiFi.mode(WIFI_STA);
  delay(100);
  String mac = WiFi.macAddress();
  if (mac != "00:00:00:00:00:00" && mac.length() > 0) {
    Serial.println("MAC Address: " + mac);
  } else {
    Serial.println("MAC Address not available at this time");
  }
}

void setupWiFi() {
  // Safety check: Ensure DEVICE_ID is not empty
  if (DEVICE_ID.length() == 0) {
    Serial.println("ERROR: DEVICE_ID is empty, using fallback for WiFi setup");
    DEVICE_ID = "fallback_device";
  }
  
  // Create unique AP name using device ID
  String apName = "IntelliRack_" + DEVICE_ID;
  String apPassword = "intellirack123";
  
  if (displayAvailable) {
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("WiFi Setup");
    display.setCursor(0, 10);
    display.println("Connect to:");
    display.setCursor(0, 20);
    // Truncate AP name if too long for display
    String displayName = apName.length() > 16 ? apName.substring(0, 16) + "..." : apName;
    display.println(displayName);
    display.setCursor(0, 30);
    display.println("Password:");
    display.setCursor(0, 40);
    display.println(apPassword);
    display.setCursor(0, 50);
    display.println("IP: 192.168.4.1");
    display.display();
  }

  // WiFi Manager Configuration
  wifiManager.setConfigPortalTimeout(180); // 3 minutes timeout
  wifiManager.setAPCallback(configModeCallback);
  
  // Create custom parameters with device info (using static char array to avoid crash)
  static char customHTMLBuffer[512];
  String mac = WiFi.macAddress();
  snprintf(customHTMLBuffer, sizeof(customHTMLBuffer), 
           "<p><strong>IntelliRack Device: %s</strong></p><p>MAC Address: %s</p><p>Configure WiFi settings below:</p>",
           DEVICE_ID.c_str(), mac.c_str());
  WiFiManagerParameter custom_text(customHTMLBuffer);
  wifiManager.addParameter(&custom_text);

  // Start configuration portal with device-specific AP name
  Serial.println("Starting WiFi AP: " + apName);
  if (!wifiManager.autoConnect(apName.c_str(), apPassword.c_str())) {
    Serial.println("Failed to connect and hit timeout");
    if (displayAvailable) {
      display.clearDisplay();
      display.setCursor(0, 0);
      display.println("WiFi Failed");
      display.setCursor(0, 10);
      display.println("Restarting...");
      display.display();
    }
    delay(3000);
    ESP.restart();
  }

  // WiFi connected
  wifiConnected = true;
  Serial.println("WiFi connected");
  Serial.println("IP address: " + WiFi.localIP().toString());

  // Setup mDNS with device-specific name
  String mDNSDeviceName = DEVICE_ID; // Use device ID directly as mDNS name
  if (MDNS.begin(mDNSDeviceName.c_str())) {
    Serial.println("MDNS responder started");
    Serial.println("Device discoverable as: " + mDNSDeviceName + ".local");
    
    // Add service for discovery
    MDNS.addService(DISCOVERY_SERVICE, "tcp", DISCOVERY_PORT);
    MDNS.addServiceTxt(DISCOVERY_SERVICE, "tcp", "deviceId", DEVICE_ID);
    MDNS.addServiceTxt(DISCOVERY_SERVICE, "tcp", "slotId", String(SLOT_ID));
    MDNS.addServiceTxt(DISCOVERY_SERVICE, "tcp", "firmwareVersion", "v2.0");
    MDNS.addServiceTxt(DISCOVERY_SERVICE, "tcp", "type", "IntelliRack");
    MDNS.addServiceTxt(DISCOVERY_SERVICE, "tcp", "macAddress", WiFi.macAddress());
  }

  // Setup MQTT
  setupMQTT();

  // Setup web server
  setupWebServer();
  server.begin();
  Serial.println("HTTP server started");

  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("WiFi Connected!");
  display.setCursor(0, 10);
  display.println("ID: " + DEVICE_ID);
  display.setCursor(0, 20);
  display.println("IP: " + WiFi.localIP().toString());
  display.setCursor(0, 30);
  String webUrl = mDNSDeviceName + ".local";
  String displayUrl = webUrl.length() > 18 ? webUrl.substring(0, 15) + "..." : webUrl;
  display.println("Web: " + displayUrl);
  display.setCursor(0, 40);
  display.println("MQTT: " + String(mqttEnabled ? "ON" : "OFF"));
  display.display();
  delay(3000); // Show longer to read device ID
}

void configModeCallback(WiFiManager *myWiFiManager) {
  String apName = "IntelliRack_" + DEVICE_ID;
  String displayName = apName.length() > 16 ? apName.substring(0, 16) + "..." : apName;
  
  if (displayAvailable) {
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("Config Mode");
    display.setCursor(0, 10);
    display.println("Device: " + DEVICE_ID);
    display.setCursor(0, 20);
    display.println("SSID: " + displayName);
    display.setCursor(0, 30);
    display.println("Pass: intellirack123");
    display.setCursor(0, 40);
    display.println("Visit: 192.168.4.1");
    display.display();
  }
}

void setupWebServer() {
  // Enable CORS for all routes
  server.enableCORS(true);
  
  // Add global CORS headers
  server.on("/", HTTP_OPTIONS, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    server.send(200, "text/plain", "");
  });
  
  // Add OPTIONS handlers for all API routes
  server.on("/api/weight", HTTP_OPTIONS, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    server.send(200, "text/plain", "");
  });
  
  server.on("/api/status", HTTP_OPTIONS, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    server.send(200, "text/plain", "");
  });
  
  server.on("/api/discovery", HTTP_OPTIONS, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    server.send(200, "text/plain", "");
  });
  
  server.on("/", handleRoot);
  server.on("/api/weight", handleWeightAPI);
  server.on("/api/status", handleStatusAPI);
  server.on("/api/tare", handleTareAPI);
  server.on("/api/calibrate", handleCalibrateAPI);
  server.on("/api/discovery", handleDiscoveryAPI); // New discovery endpoint
  server.on("/api/nfc/read", handleNFCReadAPI); // NFC read endpoint
  server.on("/api/nfc/write", handleNFCWriteAPI); // NFC write endpoint
  server.on("/api/nfc/clear", handleNFCClearAPI); // NFC clear endpoint
  server.on("/api/nfc/status", handleNFCStatusAPI); // NFC status endpoint
  server.onNotFound(handleNotFound);
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<title>IntelliRack Dashboard</title>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<style>";
  html += "body{font-family:Arial;margin:20px;background:#f0f0f0;}";
  html += ".card{background:white;padding:20px;margin:10px;border-radius:10px;box-shadow:0 2px 5px rgba(0,0,0,0.1);}";
  html += ".weight{font-size:48px;text-align:center;color:#2196F3;margin:20px 0;}";
  html += ".status{font-size:18px;text-align:center;color:#666;}";
  html += ".button{background:#2196F3;color:white;padding:10px 20px;border:none;border-radius:5px;cursor:pointer;margin:5px;}";
  html += ".button:hover{background:#1976D2;}";
  html += ".info{background:#e3f2fd;padding:10px;border-radius:5px;margin:10px 0;}";
  html += "</style></head><body>";
  html += "<div class='card'><h1>IntelliRack Dashboard</h1></div>";
  html += "<div class='card'><div id='weight' class='weight'>--</div><div id='status' class='status'>--</div></div>";
  html += "<div class='card'><button class='button' onclick='tare()'>Tare</button>";
  html += "<button class='button' onclick='calibrate()'>Calibrate</button></div>";
  html += "<div class='card'><h3>Device Information</h3>";
  html += "<div class='info'>";
  html += "<strong>Device ID:</strong> " + DEVICE_ID + "<br>";
  html += "<strong>MAC Address:</strong> " + WiFi.macAddress() + "<br>";
  html += "<strong>IP Address:</strong> " + WiFi.localIP().toString() + "<br>";
  html += "<strong>MQTT Topic:</strong> " + mqttTopic + "<br>";
  html += "<strong>MQTT Broker:</strong> mqtt.judesonleo.app:8883<br>";
  html += "</div></div>";
  html += "<script>";
  html += "function updateData(){fetch('/api/weight').then(r=>r.json()).then(data=>{";
  html += "document.getElementById('weight').innerHTML=data.weight;";
  html += "document.getElementById('status').innerHTML=data.status;";
  html += "});}";
  html += "function tare(){fetch('/api/tare').then(r=>r.text()).then(r=>alert(r));}";
  html += "function calibrate(){fetch('/api/calibrate').then(r=>r.text()).then(r=>alert(r));}";
  html += "setInterval(updateData,1000);updateData();";
  html += "</script></body></html>";
  server.send(200, "text/html", html);
}

void handleWeightAPI() {
  String json = "{\"weight\":\"" + formatWeight(lastWeight) + "\",";
  json += "\"status\":\"" + getStockStatus(lastWeight) + "\",";
  json += "\"ingredient\":\"" + (tagPresent ? currentIngredient : "None") + "\"}";
  server.send(200, "application/json", json);
}

void handleStatusAPI() {
  String json = "{\"wifi\":\"" + String(wifiConnected ? "Connected" : "Disconnected") + "\",";
  json += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
  json += "\"tag\":\"" + String(tagPresent ? "Present" : "None") + "\"}";
  server.send(200, "application/json", json);
}

void handleTareAPI() {
  scale.tare();
  server.send(200, "text/plain", "Scale tared successfully");
}

void handleCalibrateAPI() {
  server.send(200, "text/plain", "Calibration started. Check serial monitor for instructions.");
  // Note: Full calibration requires serial interaction
}

void handleDiscoveryAPI() {
  // Return device information for discovery
  String json = "{";
  json += "\"deviceId\":\"" + DEVICE_ID + "\",";
  json += "\"slotId\":" + String(SLOT_ID) + ",";
  json += "\"name\":\"IntelliRack " + DEVICE_ID + "\",";
  json += "\"type\":\"IntelliRack\",";
  json += "\"firmwareVersion\":\"v2.0\",";
  json += "\"ipAddress\":\"" + WiFi.localIP().toString() + "\",";
  json += "\"macAddress\":\"" + WiFi.macAddress() + "\",";
  json += "\"ssid\":\"" + WiFi.SSID() + "\",";
  json += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  json += "\"uptime\":" + String(millis()) + ",";
  json += "\"freeHeap\":" + String(ESP.getFreeHeap()) + ",";
  json += "\"mqttConnected\":" + String(mqttEnabled ? "true" : "false") + ",";
  json += "\"currentWeight\":" + String(lastWeight, 2) + ",";
  json += "\"currentStatus\":\"" + getStockStatus(lastWeight) + "\",";
  json += "\"tagPresent\":" + String(tagPresent ? "true" : "false") + ",";
  json += "\"currentIngredient\":\"" + (tagPresent ? currentIngredient : "") + "\",";
  json += "\"discoveryTime\":" + String(millis());
  json += "}";
  
  server.send(200, "application/json", json);
}

void handleNFCReadAPI() {
  String json = "{";
  json += "\"tagPresent\":" + String(tagPresent ? "true" : "false") + ",";
  json += "\"tagUID\":\"" + lastTagUID + "\",";
  json += "\"ingredient\":\"" + currentIngredient + "\",";
  json += "\"timestamp\":" + String(millis());
  json += "}";
  
  server.send(200, "application/json", json);
}

void handleNFCWriteAPI() {
  if (server.hasArg("plain")) {
    String ingredient = server.arg("plain");
    ingredient.trim();
    
    if (ingredient.length() > 0) {
      pendingIngredientWrite = ingredient;
      server.send(200, "application/json", "{\"status\":\"ready\",\"message\":\"Ready to write '" + ingredient + "'. Tap NFC tag.\"}");
    } else {
      server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"No ingredient specified\"}");
    }
  } else {
    server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"No data provided\"}");
  }
}

void handleNFCClearAPI() {
  clearNFCTag();
  server.send(200, "application/json", "{\"status\":\"ready\",\"message\":\"Ready to clear tag. Tap NFC tag.\"}");
}

void handleNFCStatusAPI() {
  String json = "{";
  json += "\"tagPresent\":" + String(tagPresent ? "true" : "false") + ",";
  json += "\"tagUID\":\"" + lastTagUID + "\",";
  json += "\"ingredient\":\"" + currentIngredient + "\",";
  json += "\"nfcEnabled\":true,";
  json += "\"lastRead\":" + String(millis());
  json += "}";
  
  server.send(200, "application/json", json);
}

void handleNotFound() {
  server.send(404, "text/plain", "Not found");
}

void loop() {
  float weight = scale.get_units(5);
  
  if (abs(weight - lastWeight) > 0.5) {
    lastWeight = weight;
    updateDisplay();
    if(mqttEnabled) {
      publishMQTTData();
      lastMqttPublish = millis();
    }
  }
  
  // Ensure display updates on first loop if weight was preserved at startup
  static bool firstLoop = true;
  if (firstLoop && abs(lastWeight) > WEIGHT_THRESHOLD_MIN) {
    updateDisplay();
    firstLoop = false;
  }

  updateLEDs(lastWeight, tagPresent);
  handleNFCTag();
  handleSerialCommands();
  
  // Handle web server requests
  if (wifiConnected) {
    server.handleClient();
    ArduinoOTA.handle(); // Handle OTA updates
    
    // Handle MQTT
    if (mqttEnabled) {
      mqtt.loop();
      
      // Publish data periodically
      if (millis() - lastMqttPublish > MQTT_PUBLISH_INTERVAL) {
        publishMQTTData();
        lastMqttPublish = millis();
      }
      
      // Send heartbeat
      if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
        publishHeartbeat();
        lastHeartbeat = millis();
      }
    } else {
      // Try to reconnect MQTT
      if (millis() - lastMqttReconnect > MQTT_RECONNECT_INTERVAL) {
        reconnectMQTT();
        lastMqttReconnect = millis();
      }
    }
  }
  
  // System health monitoring and error recovery
  static unsigned long lastDebugPrint = 0;
  if (millis() - lastDebugPrint > 10000) {
    Serial.println("ESP32 alive - MQTT: " + String(mqttEnabled ? "Connected" : "Disconnected") + 
                   ", Weight: " + String(lastWeight, 1) + "g" +
                   ", NFC: " + String(nfcAvailable ? "OK" : "ERROR") +
                   ", Display: " + String(displayAvailable ? "OK" : "ERROR") +
                   ", SPIFFS: " + String(spiffsAvailable ? "OK" : "ERROR") +
                   ", Errors: " + String(systemErrors));
    lastDebugPrint = millis();
    
    // Reset error count every 10 minutes and try to recover NFC
    if (millis() - lastErrorReset > 600000) { // 10 minutes
      Serial.println("System recovery - resetting error counters");
      systemErrors = 0;
      lastErrorReset = millis();
      
      // Try to re-initialize NFC if it was disabled
      if (!nfcAvailable) {
        Serial.println("Attempting NFC recovery...");
        try {
          nfc.begin();
          uint32_t versiondata = nfc.getFirmwareVersion();
          if (versiondata) {
            nfc.SAMConfig();
            nfcAvailable = true;
            Serial.println("NFC recovery successful!");
          }
        } catch (...) {
          Serial.println("NFC recovery failed - will retry in 10 minutes");
        }
      }
    }
  }
  
  // Watchdog-like behavior - restart if too many errors
  if (systemErrors > 50) {
    Serial.println("Too many system errors detected - performing controlled restart");
    Serial.println("⚠️  Current weight: " + formatWeight(lastWeight) + " - this will be lost after restart");
    Serial.println("⚠️    Remove items from scale before restart to avoid measurement errors");
    
    if (spiffsAvailable) saveConfiguration();
    
    // Publish warning about restart
    if (mqttEnabled) {
      publishMQTTResponse("system_restart", "Critical restart due to errors. Current weight: " + formatWeight(lastWeight) + "g. Remove items from scale.");
      delay(2000); // Give time for message to send
    }
    
    if (displayAvailable) {
      display.clearDisplay();
      display.setCursor(0, 0);
      display.println("CRITICAL RESTART");
      display.setCursor(0, 10);
      display.println("Remove items!");
      display.setCursor(0, 20);
      display.println("Weight: " + formatWeight(lastWeight));
      display.setCursor(0, 30);
      display.println("Restarting in 5s");
      display.display();
      delay(5000);
    }
    
    ESP.restart();
  }
  
  delay(50);
}

void updateDisplay() {
  if (!displayAvailable) {
    return; // Skip display updates if display is not available
  }
  
  display.clearDisplay();
  
  // Header line
  display.drawLine(0, 0, 127, 0, SSD1306_WHITE);
  
  // Ingredient name (top section)
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 2);
  
  if (tagPresent && currentIngredient.length() > 0) {
    if (currentIngredient.length() > 20) {
      display.print(currentIngredient.substring(0, 17) + "...");
    } else {
      display.print(currentIngredient);
    }
  } else {
    display.print("No ingredient");
  }
  
  // Weight display (large text, center)
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  String weightStr = formatWeight(lastWeight);
  int16_t x1, y1;
  uint16_t w, h;
  display.getTextBounds(weightStr, 0, 0, &x1, &y1, &w, &h);
  display.setCursor((SCREEN_WIDTH - w) / 2, 20);
  display.print(weightStr);
  
  // Stock level indicator (bottom)
  display.setTextSize(1);
  String status = getStockStatus(lastWeight);
  display.getTextBounds(status, 0, 0, &x1, &y1, &w, &h);
  display.setCursor((SCREEN_WIDTH - w) / 2, 50);
  display.print(status);
  
  // Status indicators
  if (tagPresent) {
    display.fillCircle(120, 8, 3, SSD1306_WHITE); // Tag indicator
  }
  
  display.display();
}

void updateLEDs(float weight, bool hasTag) {
  // Check if LEDs are enabled
  if (!LED_ENABLED) {
    setAllLEDs(strip.Color(0, 0, 0)); // Turn off all LEDs
    return;
  }
  
  Serial.println("LED Update - Weight: " + String(weight) + "g, HasTag: " + String(hasTag) + ", LED_ENABLED: " + String(LED_ENABLED));
  
  if (weight < WEIGHT_THRESHOLD_MIN) {
    Serial.println("LED Mode: Standby (dim white)");
    setAllLEDs(strip.Color(20, 20, 20)); // Very dim white (standby)
  } else if (!hasTag) {
    Serial.println("LED Mode: No tag (blinking cyan)");
    blinkLEDs(strip.Color(0, 255, 255)); // Blinking cyan - unrecognized item
  } else {
    if (weight > WEIGHT_MAX) {
      Serial.println("LED Mode: Overweight (blinking magenta)");
      blinkLEDs(strip.Color(255, 0, 255)); // Blinking magenta - overweight
    } else if (weight >= WEIGHT_GOOD) {
      Serial.println("LED Mode: Good stock (green)");
      setAllLEDs(strip.Color(0, 255, 0)); // Green - good stock
    } else if (weight >= WEIGHT_MODERATE) {
      Serial.println("LED Mode: Moderate stock (yellow)");
      setAllLEDs(strip.Color(255, 255, 0)); // Yellow - moderate stock
    } else if (weight >= WEIGHT_LOW) {
      Serial.println("LED Mode: Low stock (orange)");
      setAllLEDs(strip.Color(255, 165, 0)); // Orange - low stock
    } else {
      Serial.println("LED Mode: Very low stock (red)");
      setAllLEDs(strip.Color(255, 0, 0)); // Red - very low stock
    }
  }
}

void handleNFCTag() {
  // Skip NFC operations if not available or recently checked
  if (!nfcAvailable) return;
  
  // Limit NFC checks to prevent system overload
  if (millis() - lastNFCCheck < NFC_CHECK_INTERVAL) return;
  lastNFCCheck = millis();
  
  // Try NFC operations with error handling
  try {
    if (nfcAdapter.tagPresent()) {
    NfcTag tag = nfcAdapter.read();
    String uid = tag.getUidString();

    if (uid != lastTagUID) {
      lastTagUID = uid;
      tagPresent = true;

      // Handle pending write operation
      if (pendingIngredientWrite.length() > 0) {
        writeIngredientToTag(pendingIngredientWrite);
        pendingIngredientWrite = "";
        return;
      }

      // Enhanced NFC tag reading with better error handling
      Serial.println("NFC Tag detected - UID: " + uid);
      Serial.println("Tag type: " + tag.getTagType());
      
      if (tag.hasNdefMessage()) {
        NdefMessage message = tag.getNdefMessage();
        int recordCount = message.getRecordCount();
        
        Serial.println("NDEF message found with " + String(recordCount) + " records");
        
        if (recordCount > 0) {
          NdefRecord record = message.getRecord(0);
          currentIngredient = parsePayload(record);
          
          // Publish NFC read event
          publishMQTTResponse("nfc_read", "Tag read: " + currentIngredient + " (UID: " + uid + ")");
          
          // Log to serial for debugging
          Serial.println("NFC Tag Read - UID: " + uid + ", Ingredient: " + currentIngredient);
        } else {
          currentIngredient = "Empty Tag";
          Serial.println("NFC Tag Read - UID: " + uid + ", No records found");
          publishMQTTResponse("nfc_read", "Empty tag detected (UID: " + uid + ")");
        }
      } else {
        currentIngredient = "Unknown Tag";
        Serial.println("NFC Tag Read - UID: " + uid + ", No NDEF message");
        publishMQTTResponse("nfc_read", "Unknown tag type (UID: " + uid + ")");
      }
      
      updateDisplay();
      if(mqttEnabled) {
        publishMQTTData();
        lastMqttPublish = millis();
      }

    }
  } else {
    if (tagPresent) {
      tagPresent = false;
      lastTagUID = "";
      currentIngredient = "";
      updateDisplay();
      if(mqttEnabled) {
        publishMQTTResponse("nfc_removed", "Tag removed");
        lastMqttPublish = millis();
      }
      Serial.println("NFC Tag Removed");
    }
    }
  } catch (...) {
    Serial.println("NFC error detected - temporarily disabling NFC");
    nfcAvailable = false;
    systemErrors++;
    // Re-enable NFC check after 30 seconds
    lastNFCCheck = millis() + 25000; // Add 25s to the 5s interval = 30s total
  }
}

void writeIngredientToTag(String ingredient) {
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Writing to Tag");
  display.setCursor(0, 10);
  display.println("Ingredient: " + ingredient);
  display.display();

  // Wait for tag to be present
  unsigned long timeout = millis() + 10000; // 10 second timeout
  while (!nfcAdapter.tagPresent() && millis() < timeout) {
    delay(100);
  }
  
  if (millis() >= timeout) {
    publishMQTTResponse("nfc_write", "Error: No NFC tag present. Please place a tag on the reader.");
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("Write Timeout!");
    display.setCursor(0, 10);
    display.println("No tag detected");
    display.display();
    delay(2000);
    updateDisplay();
    return;
  }

  NfcTag tag = nfcAdapter.read();
  String uid = tag.getUidString();
  
  Serial.println("Writing to tag - UID: " + uid);
  Serial.println("Tag type: " + tag.getTagType());
  
  // First, clear the tag completely to remove any previous data
  Serial.println("Clearing tag before writing...");
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Clearing tag...");
  display.display();
  
  NdefMessage emptyMessage;
  bool clearSuccess = nfcAdapter.write(emptyMessage);
  
  if (clearSuccess) {
    Serial.println("Tag cleared successfully");
  } else {
    Serial.println("Warning: Failed to clear tag, but continuing with write...");
  }
  
  // Wait a moment for the clear operation to complete
  delay(500);
  
  // Now write the new ingredient data
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Writing new data...");
  display.setCursor(0, 10);
  display.println("Ingredient: " + ingredient);
  display.display();
  
  NdefMessage message;
  message.addTextRecord(ingredient);
  bool success = nfcAdapter.write(message);

  if (success) {
    publishMQTTResponse("nfc_write", "Successfully wrote '" + ingredient + "' to tag (UID: " + uid + ")");
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("Write Success!");
    display.setCursor(0, 10);
    display.println("Ingredient: " + ingredient);
    display.setCursor(0, 20);
    display.println("UID: " + uid.substring(0, 8) + "...");
    display.display();
    delay(2000);
    
    Serial.println("NFC Write Success - UID: " + uid + ", Ingredient: " + ingredient);
    
    // Verify the write by reading back
    delay(500);
    if (nfcAdapter.tagPresent()) {
      NfcTag verifyTag = nfcAdapter.read();
      if (verifyTag.hasNdefMessage()) {
        NdefMessage verifyMessage = verifyTag.getNdefMessage();
        if (verifyMessage.getRecordCount() > 0) {
          NdefRecord verifyRecord = verifyMessage.getRecord(0);
          String verifyIngredient = parsePayload(verifyRecord);
          Serial.println("Write verification - Read back: " + verifyIngredient);
          currentIngredient = verifyIngredient;
          updateDisplay();
        }
      }
    }
  } else {
    publishMQTTResponse("nfc_write", "Failed to write to tag (UID: " + uid + ")");
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("Write Failed!");
    display.setCursor(0, 10);
    display.println("Check tag type");
    display.display();
    delay(2000);
    
    Serial.println("NFC Write Failed - UID: " + uid + ", Ingredient: " + ingredient);
  }
  
  updateDisplay();
}

String formatWeight(float weight) {
  if (abs(weight) < 0.1) return "0.0g";
  if (weight >= 1000.0) return String(weight / 1000.0, 2) + "kg";
  if (weight >= 10.0) return String(weight, 0) + "g";
  return String(weight, 1) + "g";
}

String getStockStatus(float weight) {
  if (weight > WEIGHT_MAX) return "MAX!";
  else if (weight >= WEIGHT_GOOD) return "GOOD";
  else if (weight >= WEIGHT_MODERATE) return "OK";
  else if (weight >= WEIGHT_LOW) return "LOW";
  else if (weight >= WEIGHT_THRESHOLD_MIN) return "VLOW";
  else return "EMPTY";
}

String parsePayload(NdefRecord record) {
  String payload = "";
  byte len = record.getPayloadLength();
  byte bytes[len];
  record.getPayload(bytes);

  if (record.getTnf() == TNF_WELL_KNOWN && record.getType() == "T") {
    int langLen = bytes[0];
    for (int i = langLen + 1; i < len; i++) {
      payload += (char)bytes[i];
    }
  } else {
    for (int i = 0; i < len; i++) {
      payload += (char)bytes[i];
    }
  }
  return payload;
}

void handleSerialCommands() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    cmd.toLowerCase();
    
    if (cmd == "tare") {
      performTare();
      if(mqttEnabled) {
        publishMQTTResponse("tare", "Scale tared successfully");
        lastMqttPublish = millis();
      }
    } else if (cmd == "cal") {
      calibrateScale();
    } else if (cmd == "autocal") {
      Serial.println("Auto-calibration with 100g. Place exactly 100g on scale...");
      calibrateScaleAuto(100.0);
    } else if (cmd == "write") {
      writeIngredient();
    } else if (cmd == "clear") {
      clearCard();
    } else if (cmd == "weight") {
      Serial.println("Current weight: " + formatWeight(lastWeight));
    } else if (cmd == "rawweight" || cmd == "raw") {
      float rawWeight = scale.get_units(5);
      Serial.println("Raw weight reading: " + formatWeight(rawWeight));
    } else if (cmd == "calibinfo" || cmd == "calinfo") {
      Serial.println("=== CALIBRATION INFO ===");
      Serial.println("Current calibration factor: " + String(calibration_factor, 6));
      Serial.println("Raw scale value: " + String(scale.get_value()));
      long sum = scale.get_value() + scale.get_value() + scale.get_value() + scale.get_value() + scale.get_value();
      Serial.println("Average raw (5 readings): " + String(sum / 5));
      Serial.println("Calibrated weight: " + formatWeight(scale.get_units(5)));
      Serial.println("For 100g calibration, expected raw reading: ~" + String(calibration_factor * 100, 0));
      Serial.println("========================");
    } else if (cmd == "status") {
      printStatus();
    } else if (cmd == "wifi") {
      printWiFiStatus();
    } else if (cmd == "resetwifi") {
      resetWiFi();
    } else if (cmd == "mqtt") {
      printMQTTStatus();
    } else if (cmd == "device") {
      printDeviceInfo();
    } else if (cmd.startsWith("setdevice ")) {
      String newDeviceId = cmd.substring(10);
      newDeviceId.trim();
      if (newDeviceId.length() > 0) {
        DEVICE_ID = newDeviceId;
        MQTT_BASE_TOPIC = "intellirack/" + DEVICE_ID;
        mqttTopic = MQTT_BASE_TOPIC + "/data";
        saveConfiguration();
        Serial.println("Device ID changed to: " + DEVICE_ID);
        Serial.println("Configuration saved. Restart to apply changes.");
      } else {
        Serial.println("Usage: setdevice <new_device_id>");
      }
    } else if (cmd == "regenid") {
      generateDeviceID();
      MQTT_BASE_TOPIC = "intellirack/" + DEVICE_ID;
      mqttTopic = MQTT_BASE_TOPIC + "/data";
      saveConfiguration();
      Serial.println("Device ID regenerated: " + DEVICE_ID);
      Serial.println("Configuration saved. Restart to apply changes.");
    } else if (cmd == "testled") {
      Serial.println("Testing LEDs...");
      testLEDs();
    } else if (cmd == "ledon") {
      LED_ENABLED = true;
      saveConfiguration();
      Serial.println("LEDs enabled");
    } else if (cmd == "ledoff") {
      LED_ENABLED = false;
      saveConfiguration();
      Serial.println("LEDs disabled");
    } else if (cmd == "recover_nfc" || cmd == "nfc_recover") {
      Serial.println("Manual NFC recovery triggered...");
      attemptNFCRecovery();
    } else if (cmd == "help") {
      printHelp();
    }
  }
}

void performTare() {
  Serial.println("Taring scale...");
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Taring...");
  display.display();
  
  delay(2000);
  scale.tare();
  
  Serial.println("Tare complete");
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Tare complete");
  display.display();
  delay(1000);
  updateDisplay();
}

void calibrateScale() {
  Serial.println("=== CALIBRATION ===");
  Serial.println("1. Remove all items and press Enter");
  
  while (!Serial.available()) delay(100);
  Serial.readStringUntil('\n');
  
  scale.tare();
  Serial.println("Tare complete");
  
  Serial.println("2. Place known weight (g) and press Enter:");
  while (!Serial.available()) delay(100);
  String weightStr = Serial.readStringUntil('\n');
  float knownWeight = weightStr.toFloat();
  
  if (knownWeight <= 0) {
    Serial.println("Invalid weight");
    return;
  }
  
  Serial.println("Measuring...");
  delay(2000);
  
  long totalReading = 0;
  for (int i = 0; i < 10; i++) {
    totalReading += scale.get_value();
    delay(100);
  }
  
  long avgReading = totalReading / 10;
  calibration_factor = (float)avgReading / knownWeight;
  scale.set_scale(calibration_factor);
  
  // Save the new calibration factor to SPIFFS
  saveConfiguration();
  
  Serial.println("Calibration factor: " + String(calibration_factor, 2));
  Serial.println("Calibration complete and saved to configuration");
}

void calibrateScaleAuto(float knownWeight) {
  Serial.println("=== AUTO CALIBRATION ===");
  Serial.println("Using known weight: " + String(knownWeight, 1) + "g");
  Serial.println("⚠️  IMPORTANT: First remove ALL items from scale, then place EXACTLY " + String(knownWeight, 1) + "g!");
  
  if (displayAvailable) {
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("AUTO CALIBRATION");
    display.setCursor(0, 10);
    display.println("Step 1:");
    display.setCursor(0, 20);
    display.println("Remove all items");
    display.setCursor(0, 35);
    display.println("Step 2:");
    display.setCursor(0, 45);
    display.println("Place " + String(knownWeight, 1) + "g weight");
    display.setCursor(0, 55);
    display.println("Wait 10s...");
    display.display();
  }
  
  // Give user 10 seconds to prepare
  delay(10000);
  
  // First, check the current reading to see if there's weight on the scale
  Serial.println("Checking current scale reading...");
  float currentReading = scale.get_units(5);
  Serial.println("Current weight reading: " + String(currentReading, 2) + "g");
  
  // If reading is very close to the known weight, assume it's placed correctly
  if (abs(currentReading - knownWeight) < (knownWeight * 0.1)) { // Within 10% tolerance
    Serial.println("✅ Weight appears to be correctly placed");
  } else if (abs(currentReading) < 5.0) {
    Serial.println("❌ No weight detected on scale! Please place " + String(knownWeight, 1) + "g weight.");
    publishMQTTResponse("calibrate", "❌ Calibration failed - No weight detected. Please place exactly " + String(knownWeight, 1) + "g on the scale and try again.");
    if (displayAvailable) {
      display.clearDisplay();
      display.setCursor(0, 0);
      display.println("CALIBRATION");
      display.setCursor(0, 10);
      display.println("FAILED!");
      display.setCursor(0, 25);
      display.println("No weight");
      display.setCursor(0, 35);
      display.println("detected!");
      display.setCursor(0, 50);
      display.println("Place " + String(knownWeight, 1) + "g");
      display.display();
      delay(5000);
    }
    updateDisplay();
    return;
  } else {
    Serial.println("⚠️  Current reading: " + String(currentReading, 1) + "g (Expected: " + String(knownWeight, 1) + "g)");
    Serial.println("⚠️  Proceeding with calibration anyway...");
  }
  
  if (displayAvailable) {
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("CALIBRATING...");
    display.setCursor(0, 15);
    display.println("Taking readings");
    display.setCursor(0, 25);
    display.println("Please wait");
    display.setCursor(0, 35);
    display.println("Do NOT touch!");
    display.display();
  }
  
  Serial.println("Taking calibration readings...");
  delay(3000); // Let scale stabilize longer
  
  long totalReading = 0;
  int numReadings = 20; // More readings for better accuracy
  
  for (int i = 0; i < numReadings; i++) {
    long reading = scale.get_value();
    totalReading += reading;
    Serial.println("Reading " + String(i+1) + "/" + String(numReadings) + ": " + String(reading));
    delay(250); // Longer delay between readings
  }
  
  long avgReading = totalReading / numReadings;
  Serial.println("Average raw reading: " + String(avgReading));
  Serial.println("Known weight: " + String(knownWeight, 1) + "g");
  
  // Calculate new calibration factor
  float newCalibrationFactor = (float)avgReading / knownWeight;
  
  // Sanity check the new calibration factor (allow both positive and negative)
  if (abs(newCalibrationFactor) < 50 || abs(newCalibrationFactor) > 1000) {
    Serial.println("❌ Calibration failed - invalid factor: " + String(newCalibrationFactor, 2));
    Serial.println("❌ Factor absolute value should be between 50-1000. Troubleshooting:");
    Serial.println("   • Raw reading: " + String(avgReading));
    Serial.println("   • Known weight: " + String(knownWeight, 1) + "g");
    Serial.println("   • Calculated factor: " + String(newCalibrationFactor, 6));
    Serial.println("   • Current scale factor: " + String(calibration_factor, 2));
    
    String troubleshoot = "";
    if (abs(newCalibrationFactor) < 50) {
      troubleshoot = "Factor magnitude too low - check if correct weight is placed, or try taring first";
    } else {
      troubleshoot = "Factor magnitude too high - check connections and scale wiring";
    }
    Serial.println("   • Suggestion: " + troubleshoot);
    
    if (displayAvailable) {
      display.clearDisplay();
      display.setCursor(0, 0);
      display.println("CALIBRATION");
      display.setCursor(0, 10);
      display.println("FAILED!");
      display.setCursor(0, 25);
      display.println("Factor: " + String(newCalibrationFactor, 1));
      display.setCursor(0, 35);
      display.println("Raw: " + String(avgReading));
      display.setCursor(0, 45);
      display.println("Check setup!");
      display.display();
      delay(5000);
    }
    
    String errorMsg = "❌ Calibration failed - invalid factor: " + String(newCalibrationFactor, 2) + 
                     ". Expected absolute value: 50-1000. Raw reading: " + String(avgReading) + 
                     " for " + String(knownWeight, 1) + "g. " + troubleshoot;
    publishMQTTResponse("calibrate", errorMsg);
    updateDisplay();
    return;
  }
  
  // Apply the new calibration factor
  calibration_factor = newCalibrationFactor;
  scale.set_scale(calibration_factor);
  
  // Save the new calibration factor to SPIFFS
  saveConfiguration();
  
  // Test the calibration by taking a reading
  delay(1000);
  float testWeight = scale.get_units(10);
  float errorPercent = abs((testWeight - knownWeight) / knownWeight) * 100;
  
  Serial.println("✅ Auto-calibration complete!");
  Serial.println("New calibration factor: " + String(calibration_factor, 2));
  Serial.println("Note: Negative factors are normal for some HX711 wiring configurations");
  Serial.println("Test reading: " + String(testWeight, 2) + "g (Expected: " + String(knownWeight, 1) + "g)");
  Serial.println("Accuracy: " + String(100 - errorPercent, 1) + "%");
  
  if (displayAvailable) {
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("CALIBRATION");
    display.setCursor(0, 10);
    display.println("SUCCESS!");
    display.setCursor(0, 25);
    display.println("Factor: " + String(calibration_factor, 1));
    display.setCursor(0, 35);
    display.println("Test: " + String(testWeight, 1) + "g");
    display.setCursor(0, 45);
    display.println("Accuracy: " + String(100 - errorPercent, 0) + "%");
    display.display();
    delay(5000);
  }
  
  String resultMessage = "✅ Auto-calibration successful! New factor: " + String(calibration_factor, 2) + 
                        ". Test reading: " + String(testWeight, 2) + "g (Expected: " + String(knownWeight, 1) + "g). " +
                        "Accuracy: " + String(100 - errorPercent, 1) + "%. Configuration saved.";
  
  publishMQTTResponse("calibrate", resultMessage);
  updateDisplay();
}

void writeIngredient() {
  Serial.println("Enter ingredient name:");
  while (!Serial.available()) delay(100);
  String text = Serial.readStringUntil('\n');
  text.trim();
  
  if (text.length() == 0) {
    Serial.println("No name entered");
    return;
  }

  Serial.println("Tap NFC tag to write '" + text + "'...");
  
  unsigned long timeout = millis() + 10000;
  while (!nfcAdapter.tagPresent() && millis() < timeout) {
    delay(100);
  }
  
  if (millis() >= timeout) {
    Serial.println("Timeout");
    return;
  }

  NdefMessage message;
  message.addTextRecord(text);
  bool success = nfcAdapter.write(message);

  Serial.println(success ? "Write successful!" : "Write failed!");
}

void clearCard() {
  Serial.println("Tap NFC tag to clear...");
  
  unsigned long timeout = millis() + 10000;
  while (!nfcAdapter.tagPresent() && millis() < timeout) {
    delay(100);
  }
  
  if (millis() >= timeout) {
    Serial.println("Timeout");
    return;
  }
  
  bool success = nfcAdapter.erase();
  Serial.println(success ? "Card cleared!" : "Clear failed!");
}

void printStatus() {
  Serial.println("Weight: " + formatWeight(lastWeight));
  Serial.println("Stock: " + getStockStatus(lastWeight));
  Serial.println("Tag: " + String(tagPresent ? "Yes" : "No"));
  if (tagPresent) {
    Serial.println("Ingredient: " + currentIngredient);
  }
  Serial.println("Cal factor: " + String(calibration_factor, 2));
  Serial.println("Weight preserved at startup: " + String(weightPreservedAtStartup ? "Yes" : "No"));
}

void printWiFiStatus() {
  Serial.println("=== WiFi Status ===");
  Serial.println("Connected: " + String(wifiConnected ? "Yes" : "No"));
  if (wifiConnected) {
    Serial.println("SSID: " + WiFi.SSID());
    Serial.println("IP: " + WiFi.localIP().toString());
    Serial.println("Signal: " + String(WiFi.RSSI()) + " dBm");
  }
  Serial.println("==================");
}

void resetWiFi() {
  Serial.println("Resetting WiFi settings...");
  wifiManager.resetSettings();
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("WiFi Reset");
  display.setCursor(0, 10);
  display.println("Restarting...");
  display.display();
  delay(2000);
  ESP.restart();
}



void setupMQTT() {
  espClient.setInsecure();
  // espClient.setCACert(ca_cert); // <-- Set the CA cert before connecting
  mqtt.setServer(mqtt_server, mqtt_port);
  mqtt.setCallback(mqttCallback);
  
  String clientId = "IntelliRack_" + DEVICE_ID;
  if (mqtt.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
    mqttEnabled = true;
    Serial.println("MQTT Connected with Client ID: " + clientId);
    
    // Subscribe to device-specific command topic
    String commandTopic = MQTT_BASE_TOPIC + "/command";
    mqtt.subscribe(commandTopic.c_str());
    Serial.println("Subscribed to: " + commandTopic);
    
    // Subscribe to broadcast commands (for all devices)
    mqtt.subscribe("intellirack/broadcast/command");
    Serial.println("Subscribed to: intellirack/broadcast/command");
    
    // Subscribe to global commands (legacy support)
    mqtt.subscribe("intellirack/command");
    Serial.println("Subscribed to: intellirack/command");
    
    // Send initial status
    publishDeviceInfo();
    publishHeartbeat();
  } else {
    Serial.println("MQTT Connection failed");
    mqttEnabled = false;
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
	String message = "";
	for (int i = 0; i < length; i++) {
		message += (char)payload[i];
	}
	
	Serial.println("MQTT Command from " + String(topic) + ": " + message);
	Serial.println("Message length: " + String(message.length()));
	Serial.println("First character: '" + String(message.charAt(0)) + "' (ASCII: " + String((int)message.charAt(0)) + ")");
	
	// Check if this is a broadcast command
	bool isBroadcast = String(topic).indexOf("broadcast") >= 0;
	
	// Parse JSON commands only if message starts with '{'
	// Also check for any leading whitespace or special characters
	String trimmedMessage = message;
	trimmedMessage.trim(); // Remove leading/trailing whitespace
	
	Serial.println("Trimmed message: '" + trimmedMessage + "'");
	Serial.println("Trimmed message length: " + String(trimmedMessage.length()));
	
	if (trimmedMessage.startsWith("{")) {
		Serial.println("Processing as JSON command");
		handleJSONCommand(trimmedMessage, isBroadcast);
		return;
	} else {
		Serial.println("Message does not start with '{', processing as string command");
	}
	
	// Handle simple string commands
	Serial.println("Processing as string command: " + message);
	if (message == "tare") {
		Serial.println("[MQTT] Command: tare");
		scale.tare();
		publishMQTTResponse("tare", "Scale tared successfully");
	} else if (message == "status") {
		Serial.println("[MQTT] Command: status");
		publishMQTTData();
	} else if (message == "info") {
		Serial.println("[MQTT] Command: info");
		publishDeviceInfo();
	} else if (message == "restart") {
		Serial.println("[MQTT] Command: restart");
		publishMQTTResponse("restart", "Device restarting...");
		delay(1000);
		ESP.restart();
	} else if (message == "resetwifi") {
		Serial.println("[MQTT] Command: resetwifi");
		publishMQTTResponse("resetwifi", "WiFi settings reset, restarting...");
		wifiManager.resetSettings();
		delay(1000);
		ESP.restart();
	} else if (message == "calibrate") {
		Serial.println("[MQTT] Command: calibrate");
		calibrateScaleAuto(100.0); // Use 100g as default known weight
	} else if (message.startsWith("calibrate:")) {
		String weightStr = message.substring(10); // Remove "calibrate:" prefix
		float knownWeight = weightStr.toFloat();
		if (knownWeight > 10 && knownWeight <= 10000) { // Reasonable weight range
			Serial.println("[MQTT] Command: calibrate with weight: " + String(knownWeight, 1) + "g");
			calibrateScaleAuto(knownWeight);
		} else {
			Serial.println("[MQTT] Invalid calibration weight: " + weightStr);
			publishMQTTResponse("calibrate", "Invalid weight for calibration. Use format 'calibrate:100' for 100g. Range: 10-10000g");
		}
	} else if (message.startsWith("write:")) {
		String ingredient = message.substring(6); // Remove "write:" prefix
		Serial.println("[MQTT] Command: write, ingredient: " + ingredient);
		pendingIngredientWrite = ingredient;
		if (nfcAdapter.tagPresent()) {
			Serial.println("[MQTT] Tag present, writing immediately...");
			writeIngredientToTag(ingredient);
			pendingIngredientWrite = "";
		} else {
			publishMQTTResponse("write", "Ready to write: " + ingredient + ". Tap NFC tag.");
			display.clearDisplay();
			display.setCursor(0, 0);
			display.println("No tag detected");
			display.setCursor(0, 10);
			display.println("Place tag on reader");
			display.display();
		}
	} else if (message == "cleartag") {
		Serial.println("[MQTT] Command: cleartag");
		clearNFCTag();
	} else if (message == "nfc_read") {
		Serial.println("[MQTT] Command: nfc_read");
		// Return current NFC status
		String response = "{";
		response += "\"tagPresent\":" + String(tagPresent ? "true" : "false") + ",";
		response += "\"tagUID\":\"" + lastTagUID + "\",";
		response += "\"ingredient\":\"" + currentIngredient + "\"";
		response += "}";
		publishMQTTResponse("nfc_read", response);
	} else if (message.startsWith("nfc_write:")) {
		String ingredient = message.substring(10); // Remove "nfc_write:" prefix
		ingredient.trim();
		Serial.println("[MQTT] Command: nfc_write, ingredient: " + ingredient);
		if (ingredient.length() > 0) {
			pendingIngredientWrite = ingredient;
			if (nfcAdapter.tagPresent()) {
				Serial.println("[MQTT] Tag present, writing immediately...");
				writeIngredientToTag(ingredient);
				pendingIngredientWrite = "";
			} else {
				publishMQTTResponse("nfc_write", "Ready to write: " + ingredient + ". Tap NFC tag.");
				display.clearDisplay();
				display.setCursor(0, 0);
				display.println("No tag detected");
				display.setCursor(0, 10);
				display.println("Place tag on reader");
				display.display();
			}
		} else {
			publishMQTTResponse("nfc_write", "Error: No ingredient specified. Use format: nfc_write:IngredientName");
		}
	} else if (message == "nfc_write") {
		Serial.println("[MQTT] Command: nfc_write (no ingredient)");
		publishMQTTResponse("nfc_write", "Error: No ingredient specified. Use format: nfc_write:IngredientName or JSON: {\"command\":\"nfc_write\",\"ingredient\":\"Flour\"}");
	} else if (message == "nfc_clear") {
		Serial.println("[MQTT] Command: nfc_clear");
		clearNFCTag();
	} else if (message == "nfc_format") {
		Serial.println("[MQTT] Command: nfc_format");
		formatNFCTag();
	} else if (message == "config") {
		Serial.println("[MQTT] Command: config");
		publishConfiguration();
	} else if (message == "calibinfo") {
		Serial.println("[MQTT] Command: calibinfo");
		long sum = scale.get_value() + scale.get_value() + scale.get_value() + scale.get_value() + scale.get_value();
		String infoMsg = "Calibration Info - Factor: " + String(calibration_factor, 6) + 
		                ", Raw value: " + String(scale.get_value()) + 
		                ", Avg raw (5): " + String(sum / 5) + 
		                ", Current weight: " + formatWeight(scale.get_units(5)) + 
		                ", Expected raw for 100g: ~" + String(calibration_factor * 100, 0);
		publishMQTTResponse("calibinfo", infoMsg);
	} else if (message == "led_on") {
		Serial.println("[MQTT] Command: led_on");
		LED_ENABLED = true;
		saveConfiguration();
		publishMQTTResponse("led", "LED enabled");
	} else if (message == "led_off") {
		Serial.println("[MQTT] Command: led_off");
		LED_ENABLED = false;
		saveConfiguration();
		publishMQTTResponse("led", "LED disabled");
	} else if (message == "auto_tare_on") {
		Serial.println("[MQTT] Command: auto_tare_on");
		AUTO_TARE = true;
		saveConfiguration();
		publishMQTTResponse("auto_tare", "Auto tare enabled");
	} else if (message == "auto_tare_off") {
		Serial.println("[MQTT] Command: auto_tare_off");
		AUTO_TARE = false;
		saveConfiguration();
		publishMQTTResponse("auto_tare", "Auto tare disabled");
	} else if (message == "factory_reset") {
		Serial.println("[MQTT] Command: factory_reset");
		factoryReset();
	} else if (message == "save_config") {
		Serial.println("[MQTT] Command: save_config");
		saveConfiguration();
		publishMQTTResponse("config", "Configuration saved");
	} else {
		Serial.println("[MQTT] Unknown command: " + message);
		publishMQTTResponse("error", "Unknown command: " + message);
	}
}

void handleJSONCommand(String jsonCommand, bool isBroadcast = false) {
	Serial.println("Parsing JSON command: " + jsonCommand);
	
	DynamicJsonDocument doc(512);
	DeserializationError error = deserializeJson(doc, jsonCommand);
	
	if (error) {
		Serial.println("JSON parsing error: " + String(error.c_str()));
		publishMQTTResponse("error", "Invalid JSON command: " + String(error.c_str()));
		return;
	}
	
	Serial.println("JSON parsed successfully");
	Serial.println("JSON structure:");
	String jsonStr;
	serializeJson(doc, jsonStr);
	Serial.println(jsonStr);
	
	// For broadcast commands, check if this device should respond
	if (isBroadcast && doc.containsKey("targetDeviceId")) {
		String targetDeviceId = doc["targetDeviceId"];
		if (targetDeviceId != DEVICE_ID) {
			Serial.println("Broadcast command not for this device: " + targetDeviceId);
			return; // Ignore broadcast commands not meant for this device
		}
	}
	
	if (doc.containsKey("command")) {
		String command = doc["command"];
		Serial.println("[MQTT-JSON] Executing JSON command: " + command);
		
		if (command == "tare") {
			Serial.println("[MQTT-JSON] Command: tare");
			scale.tare();
			publishMQTTResponse("tare", "Scale tared successfully");
		} else if (command == "calibrate") {
			Serial.println("[MQTT-JSON] Command: calibrate");
			// Check if a custom known weight is provided
			float knownWeight = 100.0; // Default weight
			if (doc.containsKey("knownWeight")) {
				knownWeight = doc["knownWeight"];
				Serial.println("[MQTT-JSON] Using custom known weight: " + String(knownWeight, 1) + "g");
			}
			calibrateScaleAuto(knownWeight);
		} else if (command == "write") {
			if (doc.containsKey("ingredient")) {
				String ingredient = doc["ingredient"];
				Serial.println("[MQTT-JSON] Command: write, ingredient: " + ingredient);
				pendingIngredientWrite = ingredient;
				publishMQTTResponse("write", "Ready to write: " + ingredient + ". Tap NFC tag.");
			}
		} else if (command == "nfc_read") {
			Serial.println("[MQTT-JSON] Command: nfc_read");
			// Return current NFC status
			String response = "{";
			response += "\"tagPresent\":" + String(tagPresent ? "true" : "false") + ",";
			response += "\"tagUID\":\"" + lastTagUID + "\",";
			response += "\"ingredient\":\"" + currentIngredient + "\"";
			response += "}";
			publishMQTTResponse("nfc_read", response);
		} else if (command == "nfc_write") {
			Serial.println("[MQTT-JSON] Command: nfc_write");
			if (doc.containsKey("ingredient")) {
				String ingredient = doc["ingredient"];
				Serial.println("[MQTT-JSON] nfc_write ingredient: " + ingredient);
				if (nfcAdapter.tagPresent()) {
					Serial.println("[MQTT-JSON] Tag present, writing...");
					writeIngredientToTag(ingredient);
					// writeIngredientToTag will handle MQTT response
				} else {
					Serial.println("[MQTT-JSON] No tag present for nfc_write");
					publishMQTTResponse("nfc_write", "Error: No NFC tag present. Please place a tag on the reader.");
					display.clearDisplay();
					display.setCursor(0, 0);
					display.println("No tag detected");
					display.setCursor(0, 10);
					display.println("Place tag on reader");
					display.display();
				}
			} else {
				Serial.println("[MQTT-JSON] No 'ingredient' field found in JSON");
				publishMQTTResponse("nfc_write", "Error: No ingredient specified. Use JSON format: {\"command\":\"nfc_write\",\"ingredient\":\"Flour\"}");
			}
		} else if (command == "nfc_clear") {
			Serial.println("[MQTT-JSON] Command: nfc_clear");
			clearNFCTag();
		} else if (command == "nfc_format") {
			Serial.println("[MQTT-JSON] Command: nfc_format");
			formatNFCTag();
		} else if (command == "resetwifi") {
			Serial.println("[MQTT-JSON] Command: resetwifi");
			publishMQTTResponse("resetwifi", "WiFi settings reset, restarting...");
			wifiManager.resetSettings();
			delay(1000);
			ESP.restart();
		} else if (command == "set_config") {
			Serial.println("[MQTT-JSON] Command: set_config");
			handleSetConfig(doc);
		} else if (command == "get_config") {
			Serial.println("[MQTT-JSON] Command: get_config");
			publishConfiguration();
		} else if (command == "set_thresholds") {
			Serial.println("[MQTT-JSON] Command: set_thresholds");
			handleSetThresholds(doc);
		} else if (command == "set_device") {
			Serial.println("[MQTT-JSON] Command: set_device");
			handleSetDevice(doc);
		} else if (command == "set_mqtt") {
			Serial.println("[MQTT-JSON] Command: set_mqtt");
			handleSetMQTT(doc);
		} else if (command == "restart") {
			Serial.println("[MQTT-JSON] Command: restart");
			publishMQTTResponse("restart", "Device restarting...");
			delay(1000);
			ESP.restart();
		} else {
			Serial.println("[MQTT-JSON] Unknown JSON command: " + command);
			publishMQTTResponse("error", "Unknown JSON command: " + command);
		}
	} else {
		Serial.println("JSON command missing 'command' field");
		publishMQTTResponse("error", "JSON command missing 'command' field");
	}
}

void handleSetConfig(JsonDocument& doc) {
  Serial.println("=== handleSetConfig called ===");
  Serial.println("Received JSON structure:");
  String jsonStr;
  serializeJson(doc, jsonStr);
  Serial.println(jsonStr);
  
  bool configChanged = false;
  
  // Handle nested settings structure
  if (doc.containsKey("settings")) {
    Serial.println("Found 'settings' object");
    JsonObject settings = doc["settings"];
    if (settings.containsKey("ledEnabled")) {
      LED_ENABLED = settings["ledEnabled"];
      configChanged = true;
      Serial.println("Updated LED_ENABLED: " + String(LED_ENABLED));
    }
    if (settings.containsKey("soundEnabled")) {
      SOUND_ENABLED = settings["soundEnabled"];
      configChanged = true;
      Serial.println("Updated SOUND_ENABLED: " + String(SOUND_ENABLED));
    }
    if (settings.containsKey("autoTare")) {
      AUTO_TARE = settings["autoTare"];
      configChanged = true;
      Serial.println("Updated AUTO_TARE: " + String(AUTO_TARE));
    }
    if (settings.containsKey("mqttPublishInterval")) {
      MQTT_PUBLISH_INTERVAL = settings["mqttPublishInterval"];
      configChanged = true;
      Serial.println("Updated MQTT_PUBLISH_INTERVAL: " + String(MQTT_PUBLISH_INTERVAL));
    }
  }
  
  // Handle nested weightThresholds structure
  if (doc.containsKey("weightThresholds")) {
    Serial.println("Found 'weightThresholds' object");
    JsonObject thresholds = doc["weightThresholds"];
    if (thresholds.containsKey("min")) {
      WEIGHT_THRESHOLD_MIN = thresholds["min"];
      configChanged = true;
      Serial.println("Updated WEIGHT_THRESHOLD_MIN: " + String(WEIGHT_THRESHOLD_MIN));
    }
    if (thresholds.containsKey("low")) {
      WEIGHT_LOW = thresholds["low"];
      configChanged = true;
      Serial.println("Updated WEIGHT_LOW: " + String(WEIGHT_LOW));
    }
    if (thresholds.containsKey("moderate")) {
      WEIGHT_MODERATE = thresholds["moderate"];
      configChanged = true;
      Serial.println("Updated WEIGHT_MODERATE: " + String(WEIGHT_MODERATE));
    }
    if (thresholds.containsKey("good")) {
      WEIGHT_GOOD = thresholds["good"];
      configChanged = true;
      Serial.println("Updated WEIGHT_GOOD: " + String(WEIGHT_GOOD));
    }
    if (thresholds.containsKey("max")) {
      WEIGHT_MAX = thresholds["max"];
      configChanged = true;
      Serial.println("Updated WEIGHT_MAX: " + String(WEIGHT_MAX));
    }
  }
  
  // Handle legacy flat structure (for backward compatibility)
  if (doc.containsKey("ledEnabled")) {
    LED_ENABLED = doc["ledEnabled"];
    configChanged = true;
    Serial.println("Updated LED_ENABLED (legacy): " + String(LED_ENABLED));
  }
  if (doc.containsKey("soundEnabled")) {
    SOUND_ENABLED = doc["soundEnabled"];
    configChanged = true;
    Serial.println("Updated SOUND_ENABLED (legacy): " + String(SOUND_ENABLED));
  }
  if (doc.containsKey("autoTare")) {
    AUTO_TARE = doc["autoTare"];
    configChanged = true;
    Serial.println("Updated AUTO_TARE (legacy): " + String(AUTO_TARE));
  }
  if (doc.containsKey("mqttPublishInterval")) {
    MQTT_PUBLISH_INTERVAL = doc["mqttPublishInterval"];
    configChanged = true;
    Serial.println("Updated MQTT_PUBLISH_INTERVAL (legacy): " + String(MQTT_PUBLISH_INTERVAL));
  }
  if (doc.containsKey("tareThreshold")) {
    TARE_THRESHOLD = doc["tareThreshold"];
    configChanged = true;
    Serial.println("Updated TARE_THRESHOLD (legacy): " + String(TARE_THRESHOLD));
  }
  
  Serial.println("Config changed: " + String(configChanged));
  
  if (configChanged) {
    saveConfiguration();
    publishMQTTResponse("set_config", "Configuration updated and saved");
    Serial.println("Configuration saved successfully");
  } else {
    publishMQTTResponse("set_config", "No valid configuration parameters");
    Serial.println("No configuration changes detected");
  }
  
  Serial.println("=== handleSetConfig completed ===");
}

void handleSetThresholds(JsonDocument& doc) {
  bool thresholdsChanged = false;
  
  // Handle nested weightThresholds structure
  if (doc.containsKey("weightThresholds")) {
    JsonObject thresholds = doc["weightThresholds"];
    if (thresholds.containsKey("min")) {
      WEIGHT_THRESHOLD_MIN = thresholds["min"];
      thresholdsChanged = true;
    }
    if (thresholds.containsKey("low")) {
      WEIGHT_LOW = thresholds["low"];
      thresholdsChanged = true;
    }
    if (thresholds.containsKey("moderate")) {
      WEIGHT_MODERATE = thresholds["moderate"];
      thresholdsChanged = true;
    }
    if (thresholds.containsKey("good")) {
      WEIGHT_GOOD = thresholds["good"];
      thresholdsChanged = true;
    }
    if (thresholds.containsKey("max")) {
      WEIGHT_MAX = thresholds["max"];
      thresholdsChanged = true;
    }
  }
  
  // Handle legacy flat structure (for backward compatibility)
  if (doc.containsKey("weightThresholdMin")) {
    WEIGHT_THRESHOLD_MIN = doc["weightThresholdMin"];
    thresholdsChanged = true;
  }
  if (doc.containsKey("weightLow")) {
    WEIGHT_LOW = doc["weightLow"];
    thresholdsChanged = true;
  }
  if (doc.containsKey("weightModerate")) {
    WEIGHT_MODERATE = doc["weightModerate"];
    thresholdsChanged = true;
  }
  if (doc.containsKey("weightGood")) {
    WEIGHT_GOOD = doc["weightGood"];
    thresholdsChanged = true;
  }
  if (doc.containsKey("weightMax")) {
    WEIGHT_MAX = doc["weightMax"];
    thresholdsChanged = true;
  }
  
  if (thresholdsChanged) {
    saveConfiguration();
    publishMQTTResponse("set_thresholds", "Weight thresholds updated and saved");
  } else {
    publishMQTTResponse("set_thresholds", "No valid threshold parameters");
  }
}

void handleSetDevice(JsonDocument& doc) {
  bool deviceChanged = false;
  
  if (doc.containsKey("deviceId")) {
    String newDeviceId = doc["deviceId"].as<String>();
    if (newDeviceId.length() > 0 && newDeviceId != DEVICE_ID) {
      DEVICE_ID = newDeviceId;
      // Update MQTT topics with new device ID
      MQTT_BASE_TOPIC = "intellirack/" + DEVICE_ID;
      mqttTopic = MQTT_BASE_TOPIC + "/data";
      deviceChanged = true;
      Serial.println("Device ID changed to: " + DEVICE_ID);
      Serial.println("New MQTT topics: " + MQTT_BASE_TOPIC);
    }
  }
  if (doc.containsKey("slotId")) {
    SLOT_ID = doc["slotId"];
    deviceChanged = true;
  }
  if (doc.containsKey("calibrationFactor")) {
    calibration_factor = doc["calibrationFactor"];
    scale.set_scale(calibration_factor);
    deviceChanged = true;
  }
  
  if (deviceChanged) {
    saveConfiguration();
    publishMQTTResponse("set_device", "Device settings updated and saved. New Device ID: " + DEVICE_ID);
    
    // If device ID changed, we need to reconnect MQTT to update subscriptions
    if (doc.containsKey("deviceId")) {
      Serial.println("Device ID changed, reconnecting MQTT...");
      mqtt.disconnect();
      delay(1000);
      setupMQTT();
    }
  } else {
    publishMQTTResponse("set_device", "No valid device parameters");
  }
}

void handleSetMQTT(JsonDocument& doc) {
  if (doc.containsKey("publishInterval")) {
    MQTT_PUBLISH_INTERVAL = doc["publishInterval"];
    saveConfiguration();
    publishMQTTResponse("set_mqtt", "MQTT publish interval updated to " + String(MQTT_PUBLISH_INTERVAL) + "ms");
  } else {
    publishMQTTResponse("set_mqtt", "No valid MQTT parameters");
  }
}

void publishConfiguration() {
  if (!mqttEnabled) return;
  
  DynamicJsonDocument doc(1024);
  doc["deviceId"] = DEVICE_ID;
  doc["slotId"] = SLOT_ID;
  doc["calibrationFactor"] = calibration_factor;
  doc["weightThresholdMin"] = WEIGHT_THRESHOLD_MIN;
  doc["weightLow"] = WEIGHT_LOW;
  doc["weightModerate"] = WEIGHT_MODERATE;
  doc["weightGood"] = WEIGHT_GOOD;
  doc["weightMax"] = WEIGHT_MAX;
  doc["ledEnabled"] = LED_ENABLED;
  doc["soundEnabled"] = SOUND_ENABLED;
  doc["mqttPublishInterval"] = MQTT_PUBLISH_INTERVAL;
  doc["autoTare"] = AUTO_TARE;
  doc["tareThreshold"] = TARE_THRESHOLD;
  
  String json;
  serializeJson(doc, json);
  
  String configTopic = MQTT_BASE_TOPIC + "/config";
  mqtt.publish(configTopic.c_str(), json.c_str());
}

void factoryReset() {
  publishMQTTResponse("factory_reset", "Factory reset initiated...");
  
  // Reset all settings to defaults (but keep auto-generated device ID)
  generateDeviceID(); // Regenerate device ID based on MAC
  SLOT_ID = 1;
  calibration_factor = 113.81;
  WEIGHT_THRESHOLD_MIN = 5.0;
  WEIGHT_LOW = 100.0;
  WEIGHT_MODERATE = 200.0;
  WEIGHT_GOOD = 500.0;
  WEIGHT_MAX = 5000.0;
  LED_ENABLED = true;
  SOUND_ENABLED = false;
  MQTT_PUBLISH_INTERVAL = 5000;
  AUTO_TARE = false;
  TARE_THRESHOLD = -20.0;
  
  // Update MQTT topics
  MQTT_BASE_TOPIC = "intellirack/" + DEVICE_ID;
  
  // Save default configuration
  saveConfiguration();
  
  // Reset WiFi settings
  wifiManager.resetSettings();
  
  delay(1000);
  ESP.restart();
}

void startCalibration() {
  calibrationMode = true;
  
  // Now use auto-calibration instead of manual steps
  publishMQTTResponse("calibrate", "Starting auto-calibration with 100g known weight. Please place exactly 100g on the scale within 5 seconds.");
  calibrateScaleAuto(100.0);
  calibrationMode = false;
}

void clearNFCTag() {
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Clearing Tag");
  display.display();

  // Wait for tag to be present
  unsigned long timeout = millis() + 10000; // 10 second timeout
  while (!nfcAdapter.tagPresent() && millis() < timeout) {
    delay(100);
  }
  
  if (millis() >= timeout) {
    publishMQTTResponse("clear", "Timeout waiting for tag");
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("Clear Timeout!");
    display.display();
    delay(2000);
    updateDisplay();
    return;
  }

  NfcTag tag = nfcAdapter.read();
  String uid = tag.getUidString();
  
  // Create empty NDEF message
  NdefMessage message;
  bool success = nfcAdapter.write(message);

  if (success) {
    publishMQTTResponse("clear", "Successfully cleared tag (UID: " + uid + ")");
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("Clear Success!");
    display.setCursor(0, 10);
    display.println("Tag cleared");
    display.setCursor(0, 20);
    display.println("UID: " + uid.substring(0, 8) + "...");
    display.display();
    delay(2000);
    
    Serial.println("NFC Clear Success - UID: " + uid);
    currentIngredient = "";
    updateDisplay();
  } else {
    publishMQTTResponse("clear", "Failed to clear tag (UID: " + uid + ")");
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("Clear Failed!");
    display.display();
    delay(2000);
    
    Serial.println("NFC Clear Failed - UID: " + uid);
  }
  
  updateDisplay();
}

void formatNFCTag() {
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Formatting Tag");
  display.display();

  // Wait for tag to be present
  unsigned long timeout = millis() + 10000; // 10 second timeout
  while (!nfcAdapter.tagPresent() && millis() < timeout) {
    delay(100);
  }
  
  if (millis() >= timeout) {
    publishMQTTResponse("format", "Timeout waiting for tag");
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("Format Timeout!");
    display.display();
    delay(2000);
    updateDisplay();
    return;
  }

  NfcTag tag = nfcAdapter.read();
  String uid = tag.getUidString();
  
  Serial.println("Formatting tag - UID: " + uid);
  Serial.println("Tag type: " + tag.getTagType());
  
  // Try to format the tag
  bool success = false;
  
  // Method 1: Try to write empty NDEF message
  NdefMessage message;
  success = nfcAdapter.write(message);
  
  if (success) {
    publishMQTTResponse("format", "Successfully formatted tag (UID: " + uid + ")");
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("Format Success!");
    display.setCursor(0, 10);
    display.println("Tag formatted");
    display.setCursor(0, 20);
    display.println("UID: " + uid.substring(0, 8) + "...");
    display.display();
    delay(2000);
    
    Serial.println("NFC Format Success - UID: " + uid);
    currentIngredient = "";
    updateDisplay();
  } else {
    publishMQTTResponse("format", "Failed to format tag (UID: " + uid + ")");
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("Format Failed!");
    display.setCursor(0, 10);
    display.println("Tag not writable");
    display.display();
    delay(2000);
    
    Serial.println("NFC Format Failed - UID: " + uid);
  }
  
  updateDisplay();
}

void publishMQTTResponse(String command, String response) {
  if (!mqttEnabled) return;
  
  // Escape quotes in response to prevent JSON parsing errors
  String escapedResponse = response;
  escapedResponse.replace("\"", "\\\"");
  
  String json = "{\"deviceId\":\"" + DEVICE_ID + "\",";
  json += "\"command\":\"" + command + "\",";
  json += "\"response\":\"" + escapedResponse + "\",";
  json += "\"timestamp\":" + String(millis()) + "}";
  
  String responseTopic = MQTT_BASE_TOPIC + "/response";
  mqtt.publish(responseTopic.c_str(), json.c_str());
}

void publishMQTTData() {
  if (!mqttEnabled) return;
  
  // Safety check: Ensure DEVICE_ID is not empty
  if (DEVICE_ID.length() == 0) {
    Serial.println("ERROR: DEVICE_ID is empty, cannot publish MQTT data");
    return;
  }
  
  // Safety check: Ensure mqttTopic is not empty
  if (mqttTopic.length() == 0) {
    Serial.println("ERROR: mqttTopic is empty, cannot publish MQTT data");
    return;
  }
  
  String json = "{\"deviceId\":\"" + DEVICE_ID + "\",";
  json += "\"slotId\":" + String(SLOT_ID) + ",";
  json += "\"tagUID\":\"" + (tagPresent ? lastTagUID : "") + "\",";
  json += "\"ingredient\":\"" + (tagPresent ? currentIngredient : "") + "\",";
  json += "\"weight\":" + String(lastWeight, 2) + ",";
  json += "\"unit\":\"g\",";
  json += "\"status\":\"" + getStockStatus(lastWeight) + "\",";
  json += "\"timestamp\":" + String(millis()) + ",";
  json += "\"ipAddress\":\"" + WiFi.localIP().toString() + "\",";
  json += "\"firmwareVersion\":\"v2.0\"}";
  
  Serial.println("Publishing MQTT data to: " + mqttTopic);
  mqtt.publish(mqttTopic.c_str(), json.c_str());
}

void publishDeviceInfo() {
  if (!mqttEnabled) return;
  
  // Safety check: Ensure DEVICE_ID is not empty
  if (DEVICE_ID.length() == 0) {
    Serial.println("ERROR: DEVICE_ID is empty, cannot publish device info");
    return;
  }
  
  String json = "{\"deviceId\":\"" + DEVICE_ID + "\",";
  json += "\"slotId\":" + String(SLOT_ID) + ",";
  json += "\"type\":\"IntelliRack\",";
  json += "\"firmware\":\"v2.0\",";
  json += "\"wifi\":\"" + String(wifiConnected ? "connected" : "disconnected") + "\",";
  json += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
  json += "\"calibration_factor\":" + String(calibration_factor, 2) + "}";
  
  String infoTopic = MQTT_BASE_TOPIC + "/info";
  mqtt.publish(infoTopic.c_str(), json.c_str());
}

void publishHeartbeat() {
  if (!mqttEnabled) return;
  
  String json = "{\"deviceId\":\"" + DEVICE_ID + "\",";
  json += "\"slotId\":" + String(SLOT_ID) + ",";
  json += "\"timestamp\":" + String(millis()) + ",";
  json += "\"uptime\":" + String(millis()) + ",";
  json += "\"freeHeap\":" + String(ESP.getFreeHeap()) + ",";
  json += "\"wifiRSSI\":" + String(WiFi.RSSI()) + ",";
  json += "\"ipAddress\":\"" + WiFi.localIP().toString() + "\",";
  json += "\"firmwareVersion\":\"v2.0\",";
  json += "\"mqttConnected\":true,";
  json += "\"weight\":" + String(lastWeight, 2) + ",";
  json += "\"status\":\"" + getStockStatus(lastWeight) + "\",";
  json += "\"tagPresent\":" + String(tagPresent ? "true" : "false") + ",";
  json += "\"ingredient\":\"" + (tagPresent ? currentIngredient : "") + "\"}";
  
  String heartbeatTopic = MQTT_BASE_TOPIC + "/heartbeat";
  mqtt.publish(heartbeatTopic.c_str(), json.c_str());
}

void reconnectMQTT() {
  if (mqttEnabled) return;
  
  Serial.println("Attempting MQTT reconnection...");
  
  String clientId = "IntelliRack_" + DEVICE_ID;
  if (mqtt.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
    mqttEnabled = true;
    Serial.println("MQTT Reconnected with Client ID: " + clientId);
    
    // Subscribe to device-specific command topic
    String commandTopic = MQTT_BASE_TOPIC + "/command";
    mqtt.subscribe(commandTopic.c_str());
    Serial.println("Subscribed to: " + commandTopic);
    
    // Subscribe to broadcast commands (for all devices)
    mqtt.subscribe("intellirack/broadcast/command");
    Serial.println("Subscribed to: intellirack/broadcast/command");
    
    // Subscribe to global commands (legacy support)
    mqtt.subscribe("intellirack/command");
    Serial.println("Subscribed to: intellirack/command");
    
    // Send initial status
    publishDeviceInfo();
    publishHeartbeat();
  } else {
    Serial.println("MQTT Reconnection failed");
    mqttEnabled = false;
  }
}

void setupOTA() {
  // Set OTA hostname
  ArduinoOTA.setHostname(DEVICE_ID.c_str());
  
  // Set OTA password (optional but recommended)
  ArduinoOTA.setPassword("intellirack123");
  
  ArduinoOTA.onStart([]() {
    String type;
    if (ArduinoOTA.getCommand() == U_FLASH) {
      type = "sketch";
    } else { // U_SPIFFS
      type = "filesystem";
    }
    Serial.println("Start updating " + type);
    
    // Display OTA update message
    if (displayAvailable) {
      display.clearDisplay();
      display.setCursor(0, 0);
      display.println("OTA UPDATE");
      display.setCursor(0, 15);
      display.println("Updating " + type);
      display.setCursor(0, 30);
      display.println("Do NOT power off!");
      display.display();
    }
  });
  
  ArduinoOTA.onEnd([]() {
    Serial.println("\nEnd");
    if (displayAvailable) {
      display.clearDisplay();
      display.setCursor(0, 0);
      display.println("UPDATE COMPLETE");
      display.setCursor(0, 15);
      display.println("Rebooting...");
      display.display();
      delay(2000);
    }
  });
  
  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    unsigned int percent = (progress / (total / 100));
    Serial.printf("Progress: %u%%\r", percent);
    
    if (displayAvailable) {
      display.clearDisplay();
      display.setCursor(0, 0);
      display.println("OTA UPDATE");
      display.setCursor(0, 15);
      display.println("Progress: " + String(percent) + "%");
      
      // Draw progress bar
      int barWidth = 100;
      int barHeight = 8;
      int barX = 14;
      int barY = 35;
      
      display.drawRect(barX, barY, barWidth, barHeight, SSD1306_WHITE);
      int fillWidth = (barWidth - 2) * percent / 100;
      display.fillRect(barX + 1, barY + 1, fillWidth, barHeight - 2, SSD1306_WHITE);
      
      display.setCursor(0, 50);
      display.println("Do NOT power off!");
      display.display();
    }
  });
  
  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("Error[%u]: ", error);
    String errorMsg;
    if (error == OTA_AUTH_ERROR) {
      errorMsg = "Auth Failed";
    } else if (error == OTA_BEGIN_ERROR) {
      errorMsg = "Begin Failed";
    } else if (error == OTA_CONNECT_ERROR) {
      errorMsg = "Connect Failed";
    } else if (error == OTA_RECEIVE_ERROR) {
      errorMsg = "Receive Failed";
    } else if (error == OTA_END_ERROR) {
      errorMsg = "End Failed";
    }
    Serial.println(errorMsg);
    
    if (displayAvailable) {
      display.clearDisplay();
      display.setCursor(0, 0);
      display.println("OTA ERROR");
      display.setCursor(0, 15);
      display.println(errorMsg);
      display.setCursor(0, 35);
      display.println("Will retry...");
      display.display();
      delay(3000);
    }
  });
  
  ArduinoOTA.begin();
  Serial.println("OTA Ready");
  Serial.println("Hostname: " + String(ArduinoOTA.getHostname()));
  Serial.println("IP address: " + WiFi.localIP().toString());
}

// LED utilities
void setAllLEDs(uint32_t color) {
  for (int i = 0; i < NUM_LEDS; i++) {
    strip.setPixelColor(i, color);
  }
  strip.show();
}

void blinkLEDs(uint32_t color) {
  static unsigned long lastBlink = 0;
  static bool ledState = false;
  
  if (millis() - lastBlink > 500) {
    lastBlink = millis();
    ledState = !ledState;
    
    for (int i = 0; i < NUM_LEDS; i++) {
      strip.setPixelColor(i, ledState ? color : 0);
    }
    strip.show();
  }
}

void printMQTTStatus() {
  Serial.println("=== MQTT Status ===");
  Serial.println("Connected: " + String(mqttEnabled ? "Yes" : "No"));
  if (mqttEnabled) {
    Serial.println("Broker: " + String(mqtt_server));
    Serial.println("Device ID: " + DEVICE_ID);
    Serial.println("Base Topic: " + MQTT_BASE_TOPIC);
    Serial.println("Command Topic: " + MQTT_BASE_TOPIC + "/command");
    Serial.println("Response Topic: " + MQTT_BASE_TOPIC + "/response");
  }
  Serial.println("==================");
}

void printDeviceInfo() {
  Serial.println("=== Device Info ===");
  Serial.println("Device ID: " + DEVICE_ID);
  Serial.println("Slot ID: " + String(SLOT_ID));
  Serial.println("Firmware: v2.0");
  Serial.println("Calibration Factor: " + String(calibration_factor, 2));
  Serial.println("WiFi: " + String(wifiConnected ? "Connected" : "Disconnected"));
  Serial.println("MQTT: " + String(mqttEnabled ? "Connected" : "Disconnected"));
  Serial.println("==================");
}

void testLEDs() {
  Serial.println("=== LED Test Starting ===");
  Serial.println("LED_PIN: " + String(LED_PIN));
  Serial.println("NUM_LEDS: " + String(NUM_LEDS));
  Serial.println("LED_ENABLED: " + String(LED_ENABLED));
  
  // Force enable LEDs for testing
  bool originalLedState = LED_ENABLED;
  LED_ENABLED = true;
  
  // Test 1: All red
  Serial.println("Test 1: All red");
  setAllLEDs(strip.Color(255, 0, 0));
  delay(1000);
  
  // Test 2: All green
  Serial.println("Test 2: All green");
  setAllLEDs(strip.Color(0, 255, 0));
  delay(1000);
  
  // Test 3: All blue
  Serial.println("Test 3: All blue");
  setAllLEDs(strip.Color(0, 0, 255));
  delay(1000);
  
  // Test 4: Rainbow effect
  Serial.println("Test 4: Rainbow effect");
  for (int i = 0; i < NUM_LEDS; i++) {
    uint32_t color = strip.gamma32(strip.ColorHSV(i * 65536L / NUM_LEDS));
    strip.setPixelColor(i, color);
  }
  strip.show();
  delay(2000);
  
  // Test 5: Individual LED test
  Serial.println("Test 5: Individual LED test");
  setAllLEDs(strip.Color(0, 0, 0)); // Turn all off
  for (int i = 0; i < NUM_LEDS; i++) {
    Serial.println("LED " + String(i) + " on");
    strip.setPixelColor(i, strip.Color(100, 100, 100)); // White
    strip.show();
    delay(200);
    strip.setPixelColor(i, strip.Color(0, 0, 0)); // Off
    strip.show();
  }
  
  // Restore original LED state
  LED_ENABLED = originalLedState;
  
  Serial.println("=== LED Test Complete ===");
  Serial.println("If no LEDs lit up, check:");
  Serial.println("1. Power supply to LED strip");
  Serial.println("2. Data line connection to pin " + String(LED_PIN));
  Serial.println("3. Ground connection");
  Serial.println("4. LED strip type (WS2812B)");
}

void attemptNFCRecovery() {
  Serial.println("=== NFC Recovery Attempt ===");
  
  if (nfcAvailable) {
    Serial.println("NFC is currently available - no recovery needed");
    return;
  }
  
  Serial.println("Attempting to recover NFC module...");
  try {
    nfc.begin();
    delay(100);
    uint32_t versiondata = nfc.getFirmwareVersion();
    if (versiondata) {
      Serial.print("PN532 found with firmware version: ");
      Serial.println(versiondata, HEX);
      nfc.SAMConfig();
      nfcAvailable = true;
      systemErrors = 0; // Reset errors on successful recovery
      Serial.println("✅ NFC recovery successful!");
    } else {
      Serial.println("❌ PN532 not responding - hardware issue");
    }
  } catch (...) {
    Serial.println("❌ NFC recovery failed - exception occurred");
  }
  Serial.println("=============================");
}

void printHelp() {
  Serial.println("=== Available Commands ===");
  Serial.println("tare         - Tare the scale");
  Serial.println("cal          - Calibrate the scale (interactive)");
  Serial.println("autocal      - Auto-calibrate with 100g known weight");
  Serial.println("write        - Write ingredient to NFC tag");
  Serial.println("clear        - Clear NFC tag");
  Serial.println("weight       - Show current weight");
  Serial.println("rawweight    - Show raw weight (bypasses current tare)");
  Serial.println("calibinfo    - Show calibration diagnostics");
  Serial.println("status       - Show system status");
  Serial.println("wifi         - Show WiFi status");
  Serial.println("resetwifi    - Reset WiFi settings");
  Serial.println("mqtt         - Show MQTT status");
  Serial.println("device       - Show device information");
  Serial.println("setdevice <id> - Set custom device ID");
  Serial.println("regenid      - Regenerate device ID from MAC");
  Serial.println("testled      - Test LED strip functionality");
  Serial.println("ledon        - Enable LEDs");
  Serial.println("ledoff       - Disable LEDs");
  Serial.println("recover_nfc  - Manually attempt NFC recovery");
  Serial.println("help         - Show this help");
  Serial.println("==============================");
}