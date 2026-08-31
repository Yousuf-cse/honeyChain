/*
 * HoneyChain MQTT Bridge Module
 *
 * Optional MQTT integration for architectures where ESP32 publishes
 * to an MQTT broker, and a bridge relays to the HTTP API.
 *
 * Topic format: honeychain/telemetry/{deviceId}
 * Payload: JSON matching the telemetry API schema.
 *
 * This file is a standalone module — include it in the main sketch
 * if MQTT mode is preferred over direct HTTP.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

// ============================================================================
// MQTT Callback (for receiving commands from server)
// ============================================================================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.printf("[MQTT] Received on %s: %s\n", topic, message.c_str());

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, message);
  if (err) {
    Serial.printf("[MQTT] JSON parse error: %s\n", err.c_str());
    return;
  }

  // Handle command messages
  String cmd = doc["command"] | "";
  if (cmd == "tare") {
    Serial.println("[MQTT] Remote tare command received.");
    // scale.tare();  // Uncomment when HX711 is available
  } else if (cmd == "set_interval") {
    int interval = doc["interval_ms"] | SAMPLE_INTERVAL_MS;
    Serial.printf("[MQTT] Sample interval updated to %d ms\n", interval);
  } else if (cmd == "ping") {
    // Respond with heartbeat
    JsonDocument resp;
    resp["device_id"] = DEVICE_ID;
    resp["status"] = "alive";
    resp["uptime_ms"] = millis();
    resp["free_heap"] = ESP.getFreeHeap();
    String respStr;
    serializeJson(resp, respStr);
    mqtt.publish(MQTT_TOPIC_CMD, respStr.c_str());
  }
}

// ============================================================================
// MQTT Connect
// ============================================================================
bool mqttConnect() {
  if (mqtt.connected()) return true;

  Serial.printf("[MQTT] Connecting to broker %s:%d...", MQTT_BROKER, MQTT_PORT);

  if (mqtt.connect(MQTT_CLIENT_ID)) {
    Serial.println(" connected!");

    // Subscribe to command topic
    String cmdTopic = String(MQTT_TOPIC_CMD) + "/" + DEVICE_ID;
    mqtt.subscribe(cmdTopic.c_str());
    Serial.printf("[MQTT] Subscribed to: %s\n", cmdTopic.c_str());

    // Publish online status
    JsonDocument status;
    status["device_id"] = DEVICE_ID;
    status["event"] = "online";
    status["ip"] = WiFi.localIP().toString();
    String statusStr;
    serializeJson(status, statusStr);

    String onlineTopic = String(MQTT_TOPIC_DATA) + "/" + DEVICE_ID + "/status";
    mqtt.publish(onlineTopic.c_str(), statusStr.c_str());

    return true;
  } else {
    Serial.printf(" failed (rc=%d)\n", mqtt.state());
    return false;
  }
}

// ============================================================================
// MQTT Publish Telemetry
// ============================================================================
bool mqttPublishTelemetry(float temp, float humidity, float weight) {
  if (!mqtt.connected()) {
    if (!mqttConnect()) return false;
  }

  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["hiveId"] = HIVE_ID;
  doc["batchId"] = String("BATCH-") + HIVE_ID;
  doc["timestamp"] = (uint32_t)time(nullptr);
  doc["temperature"] = round(temp * 100.0) / 100.0;
  doc["humidity"] = round(humidity * 100.0) / 100.0;
  doc["weight"] = round(weight * 100.0) / 100.0;

  String payload;
  serializeJson(doc, payload);

  String topic = String(MQTT_TOPIC_DATA) + "/" + DEVICE_ID;
  bool ok = mqtt.publish(topic.c_str(), payload.c_str());

  Serial.printf("[MQTT] Publish to %s: %s (%s)\n",
                topic.c_str(), payload.c_str(), ok ? "OK" : "FAIL");
  return ok;
}

// ============================================================================
// MQTT Loop (call from main loop)
// ============================================================================
void mqttLoop() {
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqttConnect();
  mqtt.loop();
}
