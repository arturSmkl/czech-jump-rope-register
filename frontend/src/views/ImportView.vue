<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import Papa from 'papaparse';
import { errorStore } from '@/stores/errorStore';
import { uploadCollectives, uploadRegistered } from '@/services/importService';
import { getAllCollectiveMembers } from '@/services/firestoreService';
import {
  validateCollectiveImportRow,
  validateRegisteredImportRow
} from '@/services/validationService';

const route = useRoute();

const importType = computed(() => route.meta.importType);
const isCollective = computed(() => importType.value === 'collectives');
const heading = computed(() =>
  isCollective.value ? 'Importovat Kolektivní Členy' : 'Importovat Evidované Členy'
);

const allowedHeadersDisplay = computed(() => {
  const headers = isCollective.value ? COLLECTIVE_HEADERS : REGISTERED_HEADERS;
  return headers.join(';');
});

const COLLECTIVE_HEADERS = [
  'name', 'company_id', 'street', 'house_number', 'zip_code', 'township',
  'country', 'contact_person_first_name', 'contact_person_last_name',
  'contact_person_email', 'contact_person_phone_number',
  'membership_origin_date', 'membership_extinction_date', 'id'
];

const REGISTERED_HEADERS = [
  'first_name', 'last_name', 'birth_number', 'sex', 'date_of_birth',
  'street', 'house_number', 'zip_code', 'township', 'country',
  'nationality_code', 'membership_origin_date', 'membership_extinction_date',
  'medical_examination_validity', 'competitions_last_12_months',
  'athlete', 'referee', 'coach', 'id'
];

// State
const parsedData = ref(null);
const logs = ref([]);
const hasError = ref(false);
const isSaving = ref(false);
const fileInputRef = ref(null);

// Collective member reference (for registered imports)
const collectiveMembers = ref([]);
const selectedCollective = ref(null);
const showCollectiveDropdown = ref(false);

const isSaved = ref(false);
const canSave = computed(() => parsedData.value && !hasError.value && !isSaving.value && !isSaved.value);

// Reset state when route changes (switching between import types)
watch(() => route.path, () => {
  resetState();
});

function resetState() {
  parsedData.value = null;
  logs.value = [];
  hasError.value = false;
  isSaving.value = false;
  isSaved.value = false;
  selectedCollective.value = null;
  showCollectiveDropdown.value = false;
  if (fileInputRef.value) fileInputRef.value.value = '';
}

function addLog(message, type = 'info') {
  logs.value.push({ message, type });
}

function triggerFileInput() {
  fileInputRef.value?.click();
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Reset for new upload
  parsedData.value = null;
  logs.value = [];
  hasError.value = false;
  isSaved.value = false;

  Papa.parse(file, {
    header: true,
    delimiter: ';',
    skipEmptyLines: true,
    complete(results) {
      const allowedHeaders = isCollective.value ? COLLECTIVE_HEADERS : REGISTERED_HEADERS;
      const csvHeaders = results.meta.fields || [];

      // Check for forbidden headers
      const forbidden = csvHeaders.filter(h => !allowedHeaders.includes(h));
      if (forbidden.length > 0) {
        hasError.value = true;
        errorStore.setError(
          `CSV obsahuje nepovolené sloupce: ${forbidden.join(', ')}`,
          0
        );
        return;
      }

      const data = results.data;
      if (data.length === 0) {
        hasError.value = true;
        errorStore.setError('CSV soubor neobsahuje žádné řádky.', 0);
        return;
      }

      // Validate each row
      data.forEach((row, index) => {
        const rowNum = index + 1;

        // Check for missing values (skip 'id' and 'membership_extinction_date')
        const missing = allowedHeaders.filter(h => h !== 'id' && h !== 'membership_extinction_date' && (!row[h] || row[h].trim() === ''));
        if (missing.length > 0) {
          addLog(`Řádek ${rowNum}: chybějící hodnoty — ${missing.join(', ')}`, 'warning');
        }

        // Info log for existing id (upsert)
        if (row.id && row.id.trim() !== '') {
          addLog(`Řádek ${rowNum}: člen s ID "${row.id}" bude aktualizován.`, 'info');
        }

        // Soft validation warnings
        const validationWarnings = isCollective.value
          ? validateCollectiveImportRow(row, rowNum)
          : validateRegisteredImportRow(row, rowNum);
        validationWarnings.forEach(w => addLog(w, 'warning'));
      });

      parsedData.value = data;
      addLog(`CSV úspěšně načteno — ${data.length} řádků.`, 'success');
    },
    error(err) {
      hasError.value = true;
      errorStore.setError(`Chyba při čtení CSV: ${err.message}`, 0);
    }
  });
}

async function saveToDatabase() {
  if (!parsedData.value) return;

  isSaving.value = true;
  try {
    if (isCollective.value) {
      await uploadCollectives(parsedData.value);
    } else {
      await uploadRegistered(parsedData.value, selectedCollective.value?.id);
    }
    addLog('Data byla úspěšně uložena do databáze.', 'success');
    isSaved.value = true;
  } catch (err) {
    errorStore.setError(err.message, 0);
  } finally {
    isSaving.value = false;
  }
}

// Collective member picker
async function openCollectivePicker() {
  if (collectiveMembers.value.length === 0) {
    try {
      collectiveMembers.value = await getAllCollectiveMembers();
    } catch (err) {
      errorStore.setError('Nepodařilo se načíst kolektivní členy.');
      return;
    }
  }
  showCollectiveDropdown.value = !showCollectiveDropdown.value;
}

function selectCollective(member) {
  selectedCollective.value = member;
  showCollectiveDropdown.value = false;
}

function clearCollective() {
  selectedCollective.value = null;
}
</script>

<template>
  <div class="import-view">
    <h1 class="import-heading">{{ heading }}</h1>

    <!-- Info section -->
    <div class="import-info">
      <p>
        CSV soubor musí používat <strong>středník (;)</strong> jako oddělovač sloupců.
        První řádek musí obsahovat hlavičky sloupců.
      </p>

      <div class="info-block">
        <h3>Povolené sloupce</h3>
        <code class="header-list">{{ allowedHeadersDisplay }}</code>
      </div>

      <div class="info-block">
        <h3>Formáty hodnot</h3>
        <ul>
          <li><strong>Datumy</strong> — formát <code>DD-MM-RRRR</code> se začínajícími nulami, např. <code>20-03-2026</code></li>
          <li v-if="!isCollective"><strong>Pohlaví (sex)</strong> — <code>M</code> nebo <code>Z</code></li>
          <li v-if="!isCollective"><strong>Boolean hodnoty</strong> (athlete, referee, coach) — <code>ano</code> nebo <code>ne</code></li>
          <li v-if="!isCollective"><strong>Čísla</strong> (competitions_last_12_months) — celé číslo, např. <code>5</code></li>
          <li><strong>Prázdné hodnoty</strong> jsou povolené</li>
        </ul>
      </div>

      <div class="info-block">
        <h3>Logika aktualizace (upsert)</h3>
        <p>
          Pokud řádek obsahuje sloupec <code>id</code> s hodnotou existujícího člena,
          tento člen bude <strong>aktualizován</strong>. Pokud je <code>id</code> prázdné,
          bude vytvořen <strong>nový</strong> člen.
        </p>
      </div>
    </div>

    <!-- Collective member reference picker (only for registered imports) -->
    <div v-if="!isCollective" class="collective-picker">
      <label class="picker-label">Příslušnost ke kolektivnímu členovi</label>
      <div class="picker-wrapper">
        <div class="picker-input" @click="openCollectivePicker">
          <span v-if="selectedCollective" class="picker-value">
            {{ selectedCollective.name }}
          </span>
          <span v-else class="picker-placeholder">Vyberte kolektivního člena…</span>
        </div>
        <button
          v-if="selectedCollective"
          class="picker-clear"
          @click.stop="clearCollective"
          title="Zrušit výběr"
        >✕</button>
        <div v-if="showCollectiveDropdown" class="picker-dropdown">
          <div
            v-for="member in collectiveMembers"
            :key="member.id"
            class="picker-option"
            @click="selectCollective(member)"
          >
            {{ member.name }}
          </div>
          <div v-if="collectiveMembers.length === 0" class="picker-option picker-empty">
            Žádní kolektivní členové
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="import-actions">
      <input
        ref="fileInputRef"
        type="file"
        accept=".csv"
        hidden
        @change="handleFileUpload"
      />
      <button class="btn-white" @click="triggerFileInput">
        Nahrát CSV soubor
      </button>
      <button class="btn-blue" :disabled="!canSave" @click="saveToDatabase">
        Uložit změny do databáze
      </button>
    </div>

    <!-- Log window -->
    <div class="log-window">
      <div v-if="logs.length === 0" class="log-empty">
        Zatím žádné záznamy. Nahrajte CSV soubor.
      </div>
      <div
        v-for="(log, i) in logs"
        :key="i"
        class="log-entry"
        :class="`log-${log.type}`"
      >
        {{ log.message }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.import-view {
  padding: 2rem 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.import-heading {
  font-size: 1.6rem;
  font-weight: 700;
}

/* Info section */
.import-info {
  background-color: var(--white-99);
  border-radius: 8px;
  box-shadow: 2px 2px 4px var(--shadow-color);
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  font-size: 0.95rem;
  line-height: 1.6;
}

.import-info p {
  margin: 0;
}

.info-block h3 {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.3rem;
}

.info-block ul {
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.header-list {
  display: block;
  background-color: var(--white-95);
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.88rem;
  word-break: break-all;
  line-height: 1.5;
}

.import-info code:not(.header-list) {
  background-color: var(--white-95);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  font-size: 0.88rem;
}

/* Actions row */
.import-actions {
  display: flex;
  flex-direction: row;
  gap: 0.75rem;
}

/* Collective member picker */
.collective-picker {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-width: 400px;
}

.picker-label {
  font-size: 0.95rem;
  font-weight: 600;
}

.picker-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.picker-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--white-85);
  border-radius: 6px;
  background-color: var(--white-99);
  cursor: pointer;
  font-size: 1rem;
  user-select: none;
  min-height: 42px;
  display: flex;
  align-items: center;
}

.picker-input:hover {
  border-color: var(--primary);
}

.picker-placeholder {
  color: var(--white-65);
}

.picker-value {
  font-weight: 500;
}

.picker-clear {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  font-size: 1rem;
  color: var(--text-color);
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
}

.picker-clear:hover {
  background-color: var(--white-95);
}

.picker-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 220px;
  overflow-y: auto;
  background-color: var(--white-99);
  border: 2px solid var(--white-85);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 50;
}

.picker-option {
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.1s;
}

.picker-option:hover {
  background-color: var(--white-95);
}

.picker-empty {
  color: var(--white-65);
  cursor: default;
}

/* Log window */
.log-window {
  background-color: var(--white-99);
  border-radius: 8px;
  box-shadow: 2px 2px 4px 2px var(--shadow-color);
  padding: 1rem;
  min-height: 200px;
  max-height: 480px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.log-empty {
  color: var(--white-65);
  font-size: 0.95rem;
}

.log-entry {
  font-size: 0.9rem;
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  font-family: 'Albert Sans', monospace;
  line-height: 1.4;
}

.log-info {
  color: var(--primary);
}

.log-warning {
  color: #c08800;
  background-color: #fffbe6;
}

.log-success {
  color: #1a7d1a;
  background-color: #eaf7ea;
}

.log-error {
  color: #cc3333;
  background-color: #fff0f0;
}
</style>
