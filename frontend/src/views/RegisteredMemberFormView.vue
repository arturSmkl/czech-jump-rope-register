<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { errorStore } from '@/stores/errorStore';
import {
  addRegisteredMember,
  getRegisteredMemberById,
  updateRegisteredMember,
  getAllCollectiveMembers
} from '@/services/firestoreService';
import { Timestamp } from 'firebase/firestore';

const route = useRoute();
const router = useRouter();

const memberId = computed(() => route.params.id);
const isEdit = computed(() => !!memberId.value);
const heading = computed(() =>
  isEdit.value ? 'Upravit evidovaného člena' : 'Přidat evidovaného člena'
);

const loading = ref(false);
const saving = ref(false);

// Form fields
const first_name = ref('');
const last_name = ref('');
const birth_number = ref('');
const sex = ref(null);
const nationality_code = ref('');
const addr_street = ref('');
const addr_house_number = ref('');
const addr_zip_code = ref('');
const addr_township = ref('');
const addr_country = ref('');
const competitions_last_12_months = ref(null);
const athlete = ref(false);
const referee_val = ref(false);
const coach = ref(false);

// Date fields
const dobDay = ref(null);
const dobMonth = ref(null);
const dobYear = ref(null);
const originDay = ref(null);
const originMonth = ref(null);
const originYear = ref(null);
const extinctionDay = ref(null);
const extinctionMonth = ref(null);
const extinctionYear = ref(null);
const medicalDay = ref(null);
const medicalMonth = ref(null);
const medicalYear = ref(null);

// Collective member reference
const collectiveMembers = ref([]);
const selectedCollective = ref(null);
const showCollectivePicker = ref(false);

// Warning state
const showTerminationWarning = ref(false);
const pendingCollective = ref(null);

const days = Array.from({ length: 31 }, (_, i) => i + 1);
const months = Array.from({ length: 12 }, (_, i) => i + 1);
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

function timestampToDropdowns(ts) {
  if (!ts) return { day: null, month: null, year: null };
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
}

function dropdownsToTimestamp(day, month, year) {
  if (day == null || month == null || year == null) return null;
  return Timestamp.fromDate(new Date(year, month - 1, day));
}

// Check if extinction date is set
const hasExtinctionDate = computed(() =>
  extinctionDay.value != null && extinctionMonth.value != null && extinctionYear.value != null
);

// Disable save if assigned to a terminated collective but extinction date is missing/incomplete
const saveDisabled = computed(() => {
  if (saving.value) return true;
  if (selectedCollective.value && selectedCollective.value.membership_extinction_date != null && !hasExtinctionDate.value) return true;
  return false;
});

onMounted(async () => {
  try {
    collectiveMembers.value = await getAllCollectiveMembers();
  } catch (err) {
    errorStore.setError('Nepodařilo se načíst kolektivní členy: ' + err.message);
  }

  if (!isEdit.value) return;
  loading.value = true;
  try {
    const m = await getRegisteredMemberById(memberId.value);
    first_name.value = m.first_name || '';
    last_name.value = m.last_name || '';
    birth_number.value = m.birth_number || '';
    sex.value = m.sex || null;
    nationality_code.value = m.nationality_code || '';
    addr_street.value = m.address?.street || '';
    addr_house_number.value = m.address?.house_number || '';
    addr_zip_code.value = m.address?.zip_code || '';
    addr_township.value = m.address?.township || '';
    addr_country.value = m.address?.country || '';
    competitions_last_12_months.value = m.competitions_last_12_months ?? null;
    athlete.value = !!m.athlete;
    referee_val.value = !!m.referee;
    coach.value = !!m.coach;

    // Collective member ref
    if (m.collective_member_ref) {
      selectedCollective.value = collectiveMembers.value.find(c => c.id === m.collective_member_ref) || null;
    }

    const dob = timestampToDropdowns(m.date_of_birth);
    dobDay.value = dob.day;
    dobMonth.value = dob.month;
    dobYear.value = dob.year;

    const od = timestampToDropdowns(m.membership_origin_date);
    originDay.value = od.day;
    originMonth.value = od.month;
    originYear.value = od.year;

    const ed = timestampToDropdowns(m.membership_extinction_date);
    extinctionDay.value = ed.day;
    extinctionMonth.value = ed.month;
    extinctionYear.value = ed.year;

    const med = timestampToDropdowns(m.medical_examination_validity);
    medicalDay.value = med.day;
    medicalMonth.value = med.month;
    medicalYear.value = med.year;
  } catch (err) {
    errorStore.setError('Nepodařilo se načíst data: ' + err.message);
  } finally {
    loading.value = false;
  }
});

function selectCollective(cm) {
  if (cm && cm.membership_extinction_date != null && !hasExtinctionDate.value) {
    // Warn user: assigning to terminated collective will terminate this member
    pendingCollective.value = cm;
    showTerminationWarning.value = true;
    showCollectivePicker.value = false;
    return;
  }
  selectedCollective.value = cm;
  showCollectivePicker.value = false;
}

function confirmTerminationAssignment() {
  selectedCollective.value = pendingCollective.value;
  // Auto-set extinction date to today
  const now = new Date();
  extinctionDay.value = now.getDate();
  extinctionMonth.value = now.getMonth() + 1;
  extinctionYear.value = now.getFullYear();
  showTerminationWarning.value = false;
  pendingCollective.value = null;
}

function cancelTerminationAssignment() {
  showTerminationWarning.value = false;
  pendingCollective.value = null;
}

function clearCollective() {
  selectedCollective.value = null;
}

function buildPayload() {
  return {
    first_name: first_name.value || null,
    last_name: last_name.value || null,
    birth_number: birth_number.value || null,
    sex: sex.value || null,
    date_of_birth: dropdownsToTimestamp(dobDay.value, dobMonth.value, dobYear.value),
    nationality_code: nationality_code.value || null,
    address: {
      street: addr_street.value || null,
      house_number: addr_house_number.value || null,
      zip_code: addr_zip_code.value || null,
      township: addr_township.value || null,
      country: addr_country.value || null
    },
    membership_origin_date: dropdownsToTimestamp(originDay.value, originMonth.value, originYear.value),
    membership_extinction_date: dropdownsToTimestamp(extinctionDay.value, extinctionMonth.value, extinctionYear.value),
    medical_examination_validity: dropdownsToTimestamp(medicalDay.value, medicalMonth.value, medicalYear.value),
    competitions_last_12_months: competitions_last_12_months.value != null && competitions_last_12_months.value !== ''
      ? Number(competitions_last_12_months.value)
      : null,
    athlete: athlete.value,
    referee: referee_val.value,
    coach: coach.value,
    collective_member_ref: selectedCollective.value?.id || null
  };
}

async function save() {
  saving.value = true;
  try {
    const payload = buildPayload();
    if (isEdit.value) {
      await updateRegisteredMember(memberId.value, payload);
    } else {
      await addRegisteredMember(payload);
    }
    router.push('/members/active');
  } catch (err) {
    errorStore.setError('Chyba při ukládání: ' + err.message, 0);
  } finally {
    saving.value = false;
  }
}

function cancel() {
  router.back();
}

function clearDate(prefix) {
  switch (prefix) {
    case 'dob':
      dobDay.value = null; dobMonth.value = null; dobYear.value = null; break;
    case 'origin':
      originDay.value = null; originMonth.value = null; originYear.value = null; break;
    case 'extinction':
      extinctionDay.value = null; extinctionMonth.value = null; extinctionYear.value = null; break;
    case 'medical':
      medicalDay.value = null; medicalMonth.value = null; medicalYear.value = null; break;
  }
}

function hasDateValue(prefix) {
  switch (prefix) {
    case 'dob': return dobDay.value != null || dobMonth.value != null || dobYear.value != null;
    case 'origin': return originDay.value != null || originMonth.value != null || originYear.value != null;
    case 'extinction': return extinctionDay.value != null || extinctionMonth.value != null || extinctionYear.value != null;
    case 'medical': return medicalDay.value != null || medicalMonth.value != null || medicalYear.value != null;
    default: return false;
  }
}
</script>

<template>
  <div class="form-page">
    <h1>{{ heading }}</h1>

    <div v-if="loading" class="loading-text">Načítání…</div>

    <template v-else>
      <!-- Personal info -->
      <div class="form-section">
        <h2>Osobní údaje</h2>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Jméno</label>
            <input class="form-input" v-model="first_name" placeholder="Jméno" />
          </div>
          <div class="form-group">
            <label class="form-label">Příjmení</label>
            <input class="form-input" v-model="last_name" placeholder="Příjmení" />
          </div>
          <div class="form-group">
            <label class="form-label">Rodné číslo</label>
            <input class="form-input" v-model="birth_number" placeholder="Rodné číslo" />
          </div>
          <div class="form-group">
            <label class="form-label">Pohlaví</label>
            <select class="form-select" v-model="sex">
              <option :value="null">—</option>
              <option value="M">M</option>
              <option value="Z">Z</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Datum narození</label>
            <div class="date-dropdowns">
              <select class="form-select" v-model="dobDay">
                <option :value="null">Den</option>
                <option v-for="d in days" :key="d" :value="d">{{ d }}</option>
              </select>
              <select class="form-select" v-model="dobMonth">
                <option :value="null">Měsíc</option>
                <option v-for="m in months" :key="m" :value="m">{{ m }}</option>
              </select>
              <select class="form-select" v-model="dobYear">
                <option :value="null">Rok</option>
                <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
              </select>
            </div>
            <button v-if="hasDateValue('dob')" class="btn-clear-date" @click="clearDate('dob')">Vymazat datum</button>
          </div>
          <div class="form-group">
            <label class="form-label">Kód národnosti</label>
            <input class="form-input" v-model="nationality_code" placeholder="Kód národnosti" />
          </div>
        </div>
      </div>

      <!-- Address -->
      <div class="form-section">
        <h2>Adresa</h2>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Ulice</label>
            <input class="form-input" v-model="addr_street" placeholder="Ulice" />
          </div>
          <div class="form-group">
            <label class="form-label">Číslo popisné</label>
            <input class="form-input" v-model="addr_house_number" placeholder="Číslo popisné" />
          </div>
          <div class="form-group">
            <label class="form-label">PSČ</label>
            <input class="form-input" v-model="addr_zip_code" placeholder="PSČ" />
          </div>
          <div class="form-group">
            <label class="form-label">Obec</label>
            <input class="form-input" v-model="addr_township" placeholder="Obec" />
          </div>
          <div class="form-group">
            <label class="form-label">Země</label>
            <input class="form-input" v-model="addr_country" placeholder="Země" />
          </div>
        </div>
      </div>

      <!-- Membership -->
      <div class="form-section">
        <h2>Členství</h2>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Vznik členství</label>
            <div class="date-dropdowns">
              <select class="form-select" v-model="originDay">
                <option :value="null">Den</option>
                <option v-for="d in days" :key="d" :value="d">{{ d }}</option>
              </select>
              <select class="form-select" v-model="originMonth">
                <option :value="null">Měsíc</option>
                <option v-for="m in months" :key="m" :value="m">{{ m }}</option>
              </select>
              <select class="form-select" v-model="originYear">
                <option :value="null">Rok</option>
                <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
              </select>
            </div>
            <button v-if="hasDateValue('origin')" class="btn-clear-date" @click="clearDate('origin')">Vymazat datum</button>
          </div>
          <div class="form-group">
            <label class="form-label">Zánik členství</label>
            <div class="date-dropdowns">
              <select class="form-select" v-model="extinctionDay">
                <option :value="null">Den</option>
                <option v-for="d in days" :key="d" :value="d">{{ d }}</option>
              </select>
              <select class="form-select" v-model="extinctionMonth">
                <option :value="null">Měsíc</option>
                <option v-for="m in months" :key="m" :value="m">{{ m }}</option>
              </select>
              <select class="form-select" v-model="extinctionYear">
                <option :value="null">Rok</option>
                <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
              </select>
            </div>
            <button v-if="hasDateValue('extinction')" class="btn-clear-date" @click="clearDate('extinction')">Vymazat datum</button>
          </div>
        </div>
      </div>

      <!-- Medical / Competitions / Roles -->
      <div class="form-section">
        <h2>Sport a zdraví</h2>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Platnost lékařské prohlídky</label>
            <div class="date-dropdowns">
              <select class="form-select" v-model="medicalDay">
                <option :value="null">Den</option>
                <option v-for="d in days" :key="d" :value="d">{{ d }}</option>
              </select>
              <select class="form-select" v-model="medicalMonth">
                <option :value="null">Měsíc</option>
                <option v-for="m in months" :key="m" :value="m">{{ m }}</option>
              </select>
              <select class="form-select" v-model="medicalYear">
                <option :value="null">Rok</option>
                <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
              </select>
            </div>
            <button v-if="hasDateValue('medical')" class="btn-clear-date" @click="clearDate('medical')">Vymazat datum</button>
          </div>
          <div class="form-group">
            <label class="form-label">Soutěže (posl. 12 měs.)</label>
            <input
              class="form-input"
              type="number"
              min="0"
              v-model="competitions_last_12_months"
              placeholder="Počet soutěží"
            />
          </div>
          <div class="form-group">
            <label class="form-label">Role</label>
            <div class="checkbox-group">
              <label class="form-check">
                <input type="checkbox" v-model="athlete" />
                <span>Závodník</span>
              </label>
              <label class="form-check">
                <input type="checkbox" v-model="referee_val" />
                <span>Rozhodčí</span>
              </label>
              <label class="form-check">
                <input type="checkbox" v-model="coach" />
                <span>Trenér</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Collective member reference -->
      <div class="form-section">
        <h2>Příslušnost ke kolektivnímu členovi</h2>
        <div class="form-group">
          <label class="form-label">Kolektivní člen</label>
          <div class="picker-wrapper">
            <div class="picker-input" @click="showCollectivePicker = !showCollectivePicker">
              <span v-if="selectedCollective" class="picker-value">
                {{ selectedCollective.name }}
                <span v-if="selectedCollective.membership_extinction_date != null" class="picker-option-note"> (zaniklý)</span>
              </span>
              <span v-else class="picker-placeholder">Žádný — individuální člen</span>
            </div>
            <div v-if="showCollectivePicker" class="picker-dropdown">
              <div class="picker-option" @click="selectCollective(null)">
                <em>Žádný — individuální člen</em>
              </div>
              <div
                v-for="cm in collectiveMembers"
                :key="cm.id"
                class="picker-option"
                @click="selectCollective(cm)"
              >
                {{ cm.name }}
                <span v-if="cm.membership_extinction_date != null" class="picker-option-note"> (zaniklý)</span>
              </div>
            </div>
          </div>
          <button v-if="selectedCollective" class="btn-clear-date" @click="clearCollective">Zrušit příslušnost</button>
        </div>
      </div>

      <!-- Actions -->
      <div class="form-actions">
        <p v-if="selectedCollective && selectedCollective.membership_extinction_date != null && !hasExtinctionDate" class="form-warning">
          Evidovaný člen přiřazený k zaniklému kolektivnímu členovi musí mít vyplněné datum zániku členství.
        </p>
        <button class="btn-white" @click="cancel">Zrušit</button>
        <button class="btn-blue" :disabled="saveDisabled" @click="save">
          {{ saving ? 'Ukládání…' : 'Uložit' }}
        </button>
      </div>
    </template>

    <!-- Termination warning modal -->
    <div v-if="showTerminationWarning" class="modal-overlay" @click.self="cancelTerminationAssignment">
      <div class="modal-card">
        <h2>Upozornění</h2>
        <p>
          Vybraný kolektivní člen <strong>{{ pendingCollective?.name }}</strong> je zaniklý.
          Přiřazením k zaniklému kolektivnímu členovi bude tento evidovaný člen také terminován
          (datum zániku členství bude nastaveno na dnešní datum).
        </p>
        <div class="modal-actions">
          <button class="btn-white" @click="cancelTerminationAssignment">Zrušit</button>
          <button class="btn-red" @click="confirmTerminationAssignment">Potvrdit a terminovat</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading-text {
  font-size: 1.1rem;
  color: var(--white-65);
  padding: 2rem 0;
}

.btn-clear-date {
  font-size: 0.8rem;
  padding: 0.2rem 0.5rem;
  background: none;
  border: none;
  color: var(--primary);
  cursor: pointer;
  align-self: flex-start;
  font-weight: 600;
}

.btn-clear-date:hover {
  text-decoration: underline;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* Picker styles (same as MembersView) */
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
  transition: border-color 0.15s;
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
  z-index: 210;
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

.picker-option-note {
  color: var(--white-65);
  font-size: 0.9rem;
}
</style>
