<script setup>
import { ref } from 'vue';
import Papa from 'papaparse';
import { uploadCollectives } from '@/services/importService';

const fileInput = ref(null);
const logs = ref([]);
const isUploading = ref(false);

// The exact headers the backend expects
const EXPECTED_HEADERS = [
  "name", "company_id", "street_and_number", "zip_code", "township", "country",
  "contact_person_first_name", "contact_person_last_name",
  "contact_person_email", "contact_person_phone_number",
  "membership_origin_date", "membership_extinction_date", "id"
];

const handleFileChange = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  Papa.parse(file, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
    complete: (results) => {
      processData(results);
    },
    error: (err) => {
      addLog(`Error parsing CSV: ${err.message}`, 'error');
    }
  });
};

const processData = async (results) => {
  const { data, meta } = results;
  const cleanedData = data.map(row => {
    const newRow = { ...row };
    delete newRow.__parsed_extra; // Remove the ghost column
    return newRow;
  });
  logs.value = []; // Clear old logs

  // Check for unauthorized headers (Frontend safety check)
  const extraFields = meta.fields.filter(f => !EXPECTED_HEADERS.includes(f));
  if (extraFields.length > 0) {
    addLog(`Error: CSV contains unknown columns: ${extraFields.join(', ')}`, 'error');
    return;
  }

  // Scan for missing data (Warnings only)
  cleanedData.forEach((row, index) => {
    const missing = EXPECTED_HEADERS.filter(h => !row[h] || row[h].trim() === "");
    if (missing.length > 0) {
      addLog(`Row ${index + 1}: Missing ${missing.join(', ')} (Will be imported as null)`, 'warn');
    }
  });

  // Trigger Upload
  try {
    isUploading.value = true;
    addLog("Sending data to server...", "info");
    const res = await uploadCollectives(cleanedData);
    addLog(`Success: ${res.message}`, "success");
    fileInput.value.value = null; // Reset input
  } catch (err) {
    addLog(`Server Error: ${err.message}`, "error");
  } finally {
    isUploading.value = false;
  }
};

const addLog = (msg, type) => {
  logs.value.push({ msg, type, time: new Date().toLocaleTimeString() });
};
</script>

<template>
  <div class="importer">
    <h3>Import Collective Members</h3>
    <input
      type="file"
      accept=".csv"
      ref="fileInput"
      @change="handleFileChange"
      :disabled="isUploading"
    />

    <div v-if="logs.length" class="log-window">
      <div v-for="(log, i) in logs" :key="i" :class="['log-item', log.type]">
        [{{ log.time }}] {{ log.msg }}
      </div>
    </div>
  </div>

</template>

<style scoped>
.importer { border: 1px solid #ccc; padding: 1rem; border-radius: 8px; }
.log-window { margin-top: 1rem; background: #1e1e1e; color: #fff; padding: 1rem; max-height: 200px; overflow-y: auto; font-family: monospace; }
.error { color: #ff6b6b; }
.warn { color: #feca57; }
.success { color: #1dd1a1; }
.info { color: #48dbfb; }
</style>
