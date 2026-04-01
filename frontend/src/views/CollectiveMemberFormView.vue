<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { errorStore } from '@/stores/errorStore';
import {
  addCollectiveMember,
  getCollectiveMemberById,
  updateCollectiveMember
} from '@/services/firestoreService';
import { Timestamp } from 'firebase/firestore';
import {
  validateEmail,
  validateCzechPhone,
  validateDateDropdowns,
  validateCompanyId
} from '@/services/validationService';
import { validateAddress } from '@/services/addressValidationService';

const route = useRoute();
const router = useRouter();

const memberId = computed(() => route.params.id);
const isEdit = computed(() => !!memberId.value);
const heading = computed(() =>
  isEdit.value ? 'Upravit kolektivního člena' : 'Přidat kolektivního člena'
);

const loading = ref(false);
const saving = ref(false);
const isEditingActiveMember = ref(false);

// Form fields
const name = ref('');
const company_id = ref('');
const street = ref('');
const house_number = ref('');
const zip_code = ref('');
const township = ref('');
const country = ref('');
const cp_first_name = ref('');
const cp_last_name = ref('');
const cp_email = ref('');
const cp_phone_number = ref('');

// Date fields (day/month/year dropdowns)
const originDay = ref(null);
const originMonth = ref(null);
const originYear = ref(null);
const extinctionDay = ref(null);
const extinctionMonth = ref(null);
const extinctionYear = ref(null);

// Dropdown options
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

// Load data for edit mode
onMounted(async () => {
  if (!isEdit.value) return;
  loading.value = true;
  try {
    const m = await getCollectiveMemberById(memberId.value);
    name.value = m.name || '';
    company_id.value = m.company_id || '';
    street.value = m.address?.street || '';
    house_number.value = m.address?.house_number || '';
    zip_code.value = m.address?.zip_code || '';
    township.value = m.address?.township || '';
    country.value = m.address?.country || '';
    cp_first_name.value = m.contact_person?.first_name || '';
    cp_last_name.value = m.contact_person?.last_name || '';
    cp_email.value = m.contact_person?.email || '';
    cp_phone_number.value = m.contact_person?.phone_number || '';

    const od = timestampToDropdowns(m.membership_origin_date);
    originDay.value = od.day;
    originMonth.value = od.month;
    originYear.value = od.year;

    const ed = timestampToDropdowns(m.membership_extinction_date);
    extinctionDay.value = ed.day;
    extinctionMonth.value = ed.month;
    extinctionYear.value = ed.year;

    isEditingActiveMember.value = m.membership_extinction_date == null;
  } catch (err) {
    errorStore.setError('Nepodařilo se načíst data: ' + err.message);
  } finally {
    loading.value = false;
  }
});

function buildPayload() {
  return {
    name: name.value || null,
    company_id: company_id.value || null,
    address: {
      street: street.value || null,
      house_number: house_number.value || null,
      zip_code: zip_code.value || null,
      township: township.value || null,
      country: country.value || null
    },
    contact_person: {
      first_name: cp_first_name.value || null,
      last_name: cp_last_name.value || null,
      email: cp_email.value || null,
      phone_number: cp_phone_number.value || null
    },
    membership_origin_date: dropdownsToTimestamp(originDay.value, originMonth.value, originYear.value),
    membership_extinction_date: dropdownsToTimestamp(extinctionDay.value, extinctionMonth.value, extinctionYear.value)
  };
}

async function save() {
  saving.value = true;
  try {
    const payload = buildPayload();
    if (isEdit.value) {
      await updateCollectiveMember(memberId.value, payload);
    } else {
      await addCollectiveMember(payload);
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

function clearOriginDate() {
  originDay.value = null;
  originMonth.value = null;
  originYear.value = null;
}

function clearExtinctionDate() {
  extinctionDay.value = null;
  extinctionMonth.value = null;
  extinctionYear.value = null;
}

// --- Validation ---
const companyIdWarning = computed(() => validateCompanyId(company_id.value) === false);
const emailWarning = computed(() => validateEmail(cp_email.value) === false);
const phoneWarning = computed(() => validateCzechPhone(cp_phone_number.value) === false);
const originDateWarning = computed(() => validateDateDropdowns(originDay.value, originMonth.value, originYear.value) === false);
const extinctionDateWarning = computed(() => validateDateDropdowns(extinctionDay.value, extinctionMonth.value, extinctionYear.value) === false);

const addressValidationResult = ref(null); // true, false, or null
const addressValidating = ref(false);

async function checkAddress() {
  const addr = {
    street: street.value || null,
    house_number: house_number.value || null,
    zip_code: zip_code.value || null,
    township: township.value || null,
    country: country.value || null
  };
  if (!addr.street && !addr.township) {
    addressValidationResult.value = null;
    return;
  }
  addressValidating.value = true;
  try {
    addressValidationResult.value = await validateAddress(addr);
  } catch {
    addressValidationResult.value = null;
  } finally {
    addressValidating.value = false;
  }
}
</script>

<template>
  <div class="form-page">
    <h1>{{ heading }}</h1>

    <div v-if="loading" class="loading-text">Načítání…</div>

    <template v-else>
      <!-- Basic info -->
      <div class="form-section">
        <h2>Základní údaje</h2>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Název</label>
            <input class="form-input" v-model="name" placeholder="Název" />
          </div>
          <div class="form-group">
            <label class="form-label">IČO</label>
            <input class="form-input" :class="{ 'validation-warn-input': companyIdWarning }" v-model="company_id" placeholder="IČO" />
            <span v-if="companyIdWarning" class="validation-hint">IČO musí být číslo</span>
          </div>
        </div>
      </div>

      <!-- Address -->
      <div class="form-section">
        <h2>Adresa</h2>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Ulice</label>
            <input class="form-input" v-model="street" placeholder="Ulice" />
          </div>
          <div class="form-group">
            <label class="form-label">Číslo popisné</label>
            <input class="form-input" v-model="house_number" placeholder="Číslo popisné" />
          </div>
          <div class="form-group">
            <label class="form-label">PSČ</label>
            <input class="form-input" v-model="zip_code" placeholder="PSČ" />
          </div>
          <div class="form-group">
            <label class="form-label">Obec</label>
            <input class="form-input" v-model="township" placeholder="Obec" />
          </div>
          <div class="form-group">
            <label class="form-label">Země</label>
            <input class="form-input" v-model="country" placeholder="Země" />
          </div>
          <div class="form-group full-width">
            <button class="btn-white btn-sm" @click="checkAddress" :disabled="addressValidating">
              {{ addressValidating ? 'Ověřování…' : 'Ověřit adresu (RÚIAN)' }}
            </button>
            <span v-if="addressValidationResult === true" class="address-valid">✓ Adresa nalezena v RÚIAN</span>
            <span v-else-if="addressValidationResult === false" class="validation-hint">⚠ Adresa nenalezena v RÚIAN</span>
          </div>
        </div>
      </div>

      <!-- Contact person -->
      <div class="form-section">
        <h2>Kontaktní osoba</h2>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Jméno</label>
            <input class="form-input" v-model="cp_first_name" placeholder="Jméno" />
          </div>
          <div class="form-group">
            <label class="form-label">Příjmení</label>
            <input class="form-input" v-model="cp_last_name" placeholder="Příjmení" />
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" :class="{ 'validation-warn-input': emailWarning }" v-model="cp_email" placeholder="Email" />
            <span v-if="emailWarning" class="validation-hint">Neplatný formát emailu</span>
          </div>
          <div class="form-group">
            <label class="form-label">Telefon</label>
            <input class="form-input" :class="{ 'validation-warn-input': phoneWarning }" v-model="cp_phone_number" placeholder="Telefon" />
            <span v-if="phoneWarning" class="validation-hint">Neplatné české telefonní číslo</span>
          </div>
        </div>
      </div>

      <!-- Dates -->
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
            <button
              v-if="originDay != null || originMonth != null || originYear != null"
              class="btn-clear-date"
              @click="clearOriginDate"
            >Vymazat datum</button>
            <span v-if="originDateWarning" class="validation-hint">Neplatné datum</span>
          </div>
          <div v-if="!isEditingActiveMember" class="form-group">
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
            <button
              v-if="extinctionDay != null || extinctionMonth != null || extinctionYear != null"
              class="btn-clear-date"
              @click="clearExtinctionDate"
            >Vymazat datum</button>
            <span v-if="extinctionDateWarning" class="validation-hint">Neplatné datum</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="form-actions">
        <button class="btn-white" @click="cancel">Zrušit</button>
        <button class="btn-blue" :disabled="saving" @click="save">
          {{ saving ? 'Ukládání…' : 'Uložit' }}
        </button>
      </div>
    </template>
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

.address-valid {
  font-size: 0.8rem;
  color: var(--green);
  font-weight: 600;
  margin-top: 0.15rem;
}
</style>
