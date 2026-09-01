pragma circom 2.1.9;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/poseidon.circom";

/**
 * HoneyQualityCircuit
 * 
 * Proves that IoT telemetry satisfies honey quality constraints:
 *   minTemp <= temperature <= maxTemp
 *   minHumidity <= humidity <= maxHumidity
 *   harvestStart <= timestamp <= harvestEnd
 *   dataCommitment = Poseidon(temperatureScaled, humidityScaled, weightScaled, timestamp, batchIdHash)
 *   batchIdHash matches the public batch identifier
 *
 * All numeric inputs are BN128 field elements (max ~2^253).
 */
template HoneyQuality() {
    // Private signals
    signal input temperatureScaled;   // temperature * 100
    signal input humidityScaled;      // humidity * 100
    signal input weightScaled;        // weight * 100
    signal input timestamp;           // Unix epoch seconds
    signal input batchIdHash;         // Poseidon(batchIdBytes) mod field

    // Public signals
    signal input dataCommitment;
    signal input minTemp;
    signal input maxTemp;
    signal input minHumidity;
    signal input maxHumidity;
    signal input harvestStart;
    signal input harvestEnd;
    signal input pubBatchIdHash;      // must match private batchIdHash

    // --- Constraint 0: Batch ID binding ---
    batchIdHash === pubBatchIdHash;

    // --- Constraint 1: Temperature range ---
    // minTemp <= temperatureScaled
    component tempMinCheck = LessThan(252);
    tempMinCheck.in[0] <== minTemp - 1;
    tempMinCheck.in[1] <== temperatureScaled;
    tempMinCheck.out === 1;

    // temperatureScaled <= maxTemp
    component tempMaxCheck = LessThan(252);
    tempMaxCheck.in[0] <== temperatureScaled;
    tempMaxCheck.in[1] <== maxTemp + 1;
    tempMaxCheck.out === 1;

    // --- Constraint 2: Humidity range ---
    component humMinCheck = LessThan(252);
    humMinCheck.in[0] <== minHumidity - 1;
    humMinCheck.in[1] <== humidityScaled;
    humMinCheck.out === 1;

    component humMaxCheck = LessThan(252);
    humMaxCheck.in[0] <== humidityScaled;
    humMaxCheck.in[1] <== maxHumidity + 1;
    humMaxCheck.out === 1;

    // --- Constraint 3: Timestamp range ---
    component timeMinCheck = LessThan(252);
    timeMinCheck.in[0] <== harvestStart - 1;
    timeMinCheck.in[1] <== timestamp;
    timeMinCheck.out === 1;

    component timeMaxCheck = LessThan(252);
    timeMaxCheck.in[0] <== timestamp;
    timeMaxCheck.in[1] <== harvestEnd + 1;
    timeMaxCheck.out === 1;

    // --- Constraint 4: Commitment integrity ---
    component commitmentHasher = Poseidon(5);
    commitmentHasher.inputs[0] <== temperatureScaled;
    commitmentHasher.inputs[1] <== humidityScaled;
    commitmentHasher.inputs[2] <== weightScaled;
    commitmentHasher.inputs[3] <== timestamp;
    commitmentHasher.inputs[4] <== batchIdHash;

    dataCommitment === commitmentHasher.out;
}

component main {public [dataCommitment, minTemp, maxTemp, minHumidity, maxHumidity, harvestStart, harvestEnd, pubBatchIdHash]} = HoneyQuality();
