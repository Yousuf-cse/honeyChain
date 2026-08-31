#ifndef CONFIG_H
#define CONFIG_H

// ============================================================================
// WiFi Configuration
// ============================================================================
#define WIFI_SSID         "Redmi_K50i"
#define WIFI_PASSWORD     "87654321"
#define WIFI_TIMEOUT_MS   15000

// ============================================================================
// HoneyChain API Configuration
// ============================================================================
#define API_BASE_URL      "http://10.161.104.179:3000"
#define API_TELEMETRY     "/api/v1/telemetry/commit"
#define API_DEVICE_REG    "/api/v1/devices/register"

// Device identification (matches server pre-seeded device or register new)
#define DEVICE_ID         "ESP32-HIVE-001"
#define HIVE_ID           "HIVE-001"
#define CLUSTER_LOCATION  "Nilgiris Mountain Cluster, Tamil Nadu"
#define BEEKEEPER_ID      "BK-IND-902"

// ============================================================================
// MQTT Configuration (optional — for bridge-based architecture)
// ============================================================================
#define MQTT_BROKER       "192.168.1.100"
#define MQTT_PORT         1883
#define MQTT_TOPIC_DATA   "honeychain/telemetry"
#define MQTT_TOPIC_CMD    "honeychain/command"
#define MQTT_CLIENT_ID    "esp32_honeychain_001"

// ============================================================================
// Sensor Pins (ESP32 DevKit V1)
// ============================================================================
#define HX711_DOUT_PIN    4
#define HX711_SCK_PIN     5
#define DHT_PIN           27
#define DHT_TYPE          DHT11

// ============================================================================
// HX711 Load Cell (set HAS_HX711 to 0 if not connected)
// ============================================================================
#define HAS_HX711         0
#define HX711_CALIBRATION_FACTOR  -7050.0  // Calibrate with known weight
#define HX711_OFFSET              4294860  // Tare offset

// ============================================================================
// Synthetic Weight (used when HAS_HX711 = 0)
// ============================================================================
#define SYNTH_WEIGHT_BASELINE  22.5   // kg — starting hive weight
#define SYNTH_WEIGHT_NOISE     0.15   // ±kg random walk per sample

// ============================================================================
// Sampling & Transmission
// ============================================================================
#define SAMPLE_INTERVAL_MS    5000   // Read sensors every 5 seconds
#define TRANSMIT_INTERVAL_MS  30000  // Transmit to API every 30 seconds
#define MAX_RETRY_ATTEMPTS    5
#define RETRY_DELAY_MS        2000

// ============================================================================
// Offline Buffer (circular buffer for when WiFi is down)
// ============================================================================
#define OFFLINE_BUFFER_SIZE   120    // Store up to 120 readings (10 min @ 5s)

#endif // CONFIG_H
