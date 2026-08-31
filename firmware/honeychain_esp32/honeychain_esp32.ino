/*
 * HoneyChain ESP32 Telemetry Firmware
 * 
 * Hardware: ESP32 + DHT11 (temp/humidity) + optional HX711 (load cell)
 * Reads hive telemetry and transmits to the HoneyChain middleware API.
 *
 * When HAS_HX711=0, weight is synthesized (random walk) for testing
 * without a physical load cell.
 *
 * Supports offline buffering when WiFi is unavailable.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include "config.h"

#if HAS_HX711
  #include <HX711.h>
  HX711 scale;
#endif

DHT dht(DHT_PIN, DHT_TYPE);

// Synthetic weight state (when HX711 is absent)
float synthWeight = SYNTH_WEIGHT_BASELINE;

// ============================================================================
// State
// ============================================================================
struct TelemetryReading {
  uint32_t timestamp;
  float temperature;
  float humidity;
  float weight;
  bool transmitted;
};

TelemetryReading offlineBuffer[OFFLINE_BUFFER_SIZE];
int bufferHead = 0;
int bufferCount = 0;

unsigned long lastSampleTime = 0;
unsigned long lastTransmitTime = 0;
int failedTransmissions = 0;

// ============================================================================
// Forward Declarations
// ============================================================================
void connectWiFi();
bool readSensors(float &temp, float &humidity, float &weight);
bool pushToBuffer(float temp, float humidity, float weight);
bool transmitReading(const TelemetryReading &reading);
bool transmitBufferedReadings();
String formatTimestamp(uint32_t ts);
void registerDevice();

// ============================================================================
// Setup
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(100);

  Serial.println("============================================");
  Serial.println("  HoneyChain ESP32 Telemetry Firmware v1.0");
  Serial.println("============================================");
  Serial.printf("  Device ID  : %s\n", DEVICE_ID);
  Serial.printf("  Hive ID    : %s\n", HIVE_ID);
  Serial.printf("  API Target : %s\n", API_BASE_URL);
  Serial.println("--------------------------------------------");

  // Initialize sensors
#if HAS_HX711
  Serial.println("[INIT] Starting HX711 scale...");
  scale.begin(HX711_DOUT_PIN, HX711_SCK_PIN);
  scale.set_scale(HX711_CALIBRATION_FACTOR);
  scale.set_offset(HX711_OFFSET);
  scale.tare();
  Serial.println("[INIT] HX711 tared successfully.");
#else
  Serial.println("[INIT] HX711 not present — using synthetic weight.");
#endif

  Serial.println("[INIT] Starting DHT11 sensor...");
  dht.begin();
  Serial.println("[INIT] DHT11 initialized.");

  // Connect WiFi
  connectWiFi();

  // Register device with middleware (non-blocking if fails)
  registerDevice();

  Serial.println("[INIT] Firmware ready. Sampling started.");
  Serial.println("============================================");
}

// ============================================================================
// Main Loop
// ============================================================================
void loop() {
  unsigned long now = millis();

  // Reconnect WiFi if dropped
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WIFI] Connection lost, reconnecting...");
    connectWiFi();
  }

  // Sample sensors at configured interval
  if (now - lastSampleTime >= SAMPLE_INTERVAL_MS) {
    lastSampleTime = now;

    float temp, humidity, weight;
    if (readSensors(temp, humidity, weight)) {
      Serial.printf("[SENSOR] T=%.1f°C  H=%.1f%%  W=%.2fkg\n", temp, humidity, weight);
      pushToBuffer(temp, humidity, weight);
    } else {
      Serial.println("[SENSOR] Read failed, skipping cycle.");
    }
  }

  // Transmit at configured interval
  if (now - lastTransmitTime >= TRANSMIT_INTERVAL_MS) {
    lastTransmitTime = now;

    if (WiFi.status() == WL_CONNECTED) {
      transmitBufferedReadings();
    } else {
      Serial.println("[TX] WiFi offline, readings buffered locally.");
    }
  }

  delay(100); // Yield to RTOS
}

// ============================================================================
// WiFi Connection
// ============================================================================
void connectWiFi() {
  Serial.printf("[WIFI] Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT_MS) {
    Serial.print(".");
    delay(500);
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WIFI] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
    failedTransmissions = 0;
  } else {
    Serial.println("\n[WIFI] Connection failed. Offline mode active.");
  }
}

// ============================================================================
// Sensor Reading
// ============================================================================
bool readSensors(float &temp, float &humidity, float &weight) {
  // DHT11 has ~1s minimum read interval (2s recommended)
  temp = dht.readTemperature();
  humidity = dht.readHumidity();

  if (isnan(temp) || isnan(humidity)) {
    Serial.println("[SENSOR] DHT11 read error");
    return false;
  }

#if HAS_HX711
  // HX711 reading (blocking, ~100ms)
  if (!scale.is_ready()) {
    Serial.println("[SENSOR] HX711 not ready");
    return false;
  }
  weight = scale.get_units(3); // Average of 3 readings
  if (weight < 0) weight = 0;  // Clamp negative (tare drift)
#else
  // Synthetic weight: random walk around baseline
  synthWeight += ((float)random(-100, 100) / 1000.0) * SYNTH_WEIGHT_NOISE;
  // Keep within realistic bounds
  if (synthWeight < 15.0) synthWeight = 15.0;
  if (synthWeight > 35.0) synthWeight = 35.0;
  weight = synthWeight;
#endif

  return true;
}

// ============================================================================
// Offline Buffer
// ============================================================================
bool pushToBuffer(float temp, float humidity, float weight) {
  int nextHead = (bufferHead + 1) % OFFLINE_BUFFER_SIZE;

  // If buffer is full, we lose the oldest reading (circular)
  if (bufferCount == OFFLINE_BUFFER_SIZE) {
    Serial.println("[BUFFER] Circular buffer full, overwriting oldest reading.");
    bufferHead = nextHead;
  } else {
    bufferHead = nextHead;
    bufferCount++;
  }

  TelemetryReading &r = offlineBuffer[bufferHead];
  r.timestamp = (uint32_t)time(nullptr);
  r.temperature = temp;
  r.humidity = humidity;
  r.weight = weight;
  r.transmitted = false;

  Serial.printf("[BUFFER] Stored reading #%d (head=%d)\n", bufferCount, bufferHead);
  return true;
}

// ============================================================================
// HTTP Transmission
// ============================================================================
bool transmitReading(const TelemetryReading &reading) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String url = String(API_BASE_URL) + API_TELEMETRY;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Build JSON payload
  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["hiveId"] = HIVE_ID;
  doc["batchId"] = String("BATCH-") + HIVE_ID;
  doc["timestamp"] = reading.timestamp;
  doc["temperature"] = round(reading.temperature * 100.0) / 100.0;
  doc["humidity"] = round(reading.humidity * 100.0) / 100.0;
  doc["weight"] = round(reading.weight * 100.0) / 100.0;

  String payload;
  serializeJson(doc, payload);

  Serial.printf("[TX] POST %s\n", url.c_str());
  Serial.printf("[TX] Payload: %s\n", payload.c_str());

  int httpCode = http.POST(payload);
  String response = http.getString();
  http.end();

  if (httpCode == 200 || httpCode == 201) {
    Serial.printf("[TX] Success (%d): %s\n", httpCode, response.c_str());
    failedTransmissions = 0;
    return true;
  } else {
    Serial.printf("[TX] Failed (%d): %s\n", httpCode, response.c_str());
    failedTransmissions++;
    return false;
  }
}

bool transmitBufferedReadings() {
  int transmitted = 0;
  int failed = 0;

  for (int i = 0; i < bufferCount; i++) {
    int idx = (bufferHead - bufferCount + i + OFFLINE_BUFFER_SIZE) % OFFLINE_BUFFER_SIZE;
    TelemetryReading &r = offlineBuffer[idx];

    if (!r.transmitted) {
      if (transmitReading(r)) {
        r.transmitted = true;
        transmitted++;
      } else {
        failed++;
        if (failed >= MAX_RETRY_ATTEMPTS) {
          Serial.printf("[TX] Max retries reached. %d readings still buffered.\n",
                        bufferCount - transmitted);
          return false;
        }
        delay(RETRY_DELAY_MS);
      }
    }
  }

  // Compact buffer — remove transmitted readings
  int newCount = 0;
  for (int i = 0; i < bufferCount; i++) {
    int idx = (bufferHead - bufferCount + i + OFFLINE_BUFFER_SIZE) % OFFLINE_BUFFER_SIZE;
    if (!offlineBuffer[idx].transmitted) {
      offlineBuffer[newCount] = offlineBuffer[idx];
      newCount++;
    }
  }

  bufferCount = newCount;
  bufferHead = (newCount > 0) ? newCount - 1 : 0;

  Serial.printf("[TX] Batch complete: %d sent, %d remaining in buffer.\n",
                transmitted, bufferCount);
  return transmitted > 0;
}

// ============================================================================
// Device Registration
// ============================================================================
void registerDevice() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[REG] WiFi not available, skipping device registration.");
    return;
  }

  HTTPClient http;
  String url = String(API_BASE_URL) + API_DEVICE_REG;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["hiveId"] = HIVE_ID;
  doc["clusterLocation"] = CLUSTER_LOCATION;
  doc["beekeeperId"] = BEEKEEPER_ID;

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);
  if (httpCode == 200 || httpCode == 201) {
    Serial.printf("[REG] Device registered successfully.\n");
  } else {
    Serial.printf("[REG] Registration failed (%d) — device may already exist.\n", httpCode);
  }
  http.end();
}
