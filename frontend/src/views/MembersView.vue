<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { errorStore } from '@/stores/errorStore';
import {
  getAllCollectiveMembers,
  getAllRegisteredMembers,
  updateCollectiveMember,
  updateRegisteredMember,
  deleteRegisteredMember
} from '@/services/firestoreService';
import {
  transferRegisteredMembers,
  terminateCollective,
  deleteCollective
} from '@/services/collectiveService';
import { searchMembers } from '@/services/searchService';

const route = useRoute();
const authStore = useAuthStore();

// --- State ---
const allCollectives = ref([]);
const allRegistered = ref([]);
const loading = ref(false);

const expandedCollectives = ref(new Set());
const expandedRegistered = ref(new Set());
const individualExpanded = ref(false);

const searchQuery = ref('');
const searchResults = ref(null); // null = no search active

// Modals
const showTransferModal = ref(false);
const transferTarget = ref(null);
const transferAction = ref('nullify');
const transferTargetCollective = ref(null);
const showTransferPicker = ref(false);
const transferLoading = ref(false);

const showActivateModal = ref(false);
const activateTarget = ref(null);
const activateLoading = ref(false);

const showConfirmModal = ref(false);
const confirmMessage = ref('');
const confirmAction = ref(null);
const confirmLoading = ref(false);
const confirmBtnClass = ref('btn-red');

// --- Computed ---
const isActive = computed(() => route.meta.memberStatus === 'active');
const canEdit = computed(() => authStore.role === 'admin' || authStore.role === 'editor');

const heading = computed(() =>
  isActive.value ? 'Přehled členů' : 'Přehled zaniklých členů'
);

const filteredCollectives = computed(() => {
  let list = allCollectives.value.filter(cm => {
    if (isActive.value) {
      return cm.membership_extinction_date == null;
    } else {
      return cm.membership_extinction_date != null;
    }
  });

  if (searchResults.value && searchResults.value.matchingCollectiveIds) {
    const ids = searchResults.value.matchingCollectiveIds;
    list = list.filter(cm => ids.has(cm.id));
  }

  return list;
});

const individualMembers = computed(() => {
  let list = allRegistered.value.filter(rm => {
    if (rm.collective_member_ref != null) return false;
    if (isActive.value) {
      return rm.membership_extinction_date == null;
    } else {
      return rm.membership_extinction_date != null;
    }
  });

  if (searchResults.value && searchResults.value.matchingRegisteredIds) {
    const ids = searchResults.value.matchingRegisteredIds;
    list = list.filter(rm => ids.has(rm.id));
  }

  return list;
});

const hasAnyContent = computed(() => {
  return filteredCollectives.value.length > 0 || individualMembers.value.length > 0;
});

function getRegisteredForCollective(collectiveId) {
  let list = allRegistered.value.filter(rm => rm.collective_member_ref === collectiveId);

  if (searchResults.value && searchResults.value.matchingRegisteredIds) {
    const ids = searchResults.value.matchingRegisteredIds;
    list = list.filter(rm => ids.has(rm.id));
  }

  return list;
}

function countRegisteredForCollective(collectiveId) {
  return allRegistered.value.filter(rm => rm.collective_member_ref === collectiveId).length;
}

function getTransferTargetCollectives(excludeId) {
  return allCollectives.value.filter(cm => cm.id !== excludeId);
}

// --- Data fetching ---
async function fetchData() {
  loading.value = true;
  try {
    const [collectives, registered] = await Promise.all([
      getAllCollectiveMembers(),
      getAllRegisteredMembers()
    ]);
    allCollectives.value = collectives;
    allRegistered.value = registered;
  } catch (err) {
    errorStore.setError('Nepodařilo se načíst data: ' + err.message);
  } finally {
    loading.value = false;
  }
}

onMounted(fetchData);

watch(() => route.meta.memberStatus, () => {
  expandedCollectives.value = new Set();
  expandedRegistered.value = new Set();
  individualExpanded.value = false;
  searchQuery.value = '';
  searchResults.value = null;
});

// --- Search ---
function handleSearch() {
  if (!searchQuery.value.trim()) {
    searchResults.value = null;
    return;
  }
  searchResults.value = searchMembers(searchQuery.value, allCollectives.value, allRegistered.value);
}

function clearSearch() {
  searchQuery.value = '';
  searchResults.value = null;
}

// --- Expand/Collapse ---
function toggleCollective(id) {
  const s = new Set(expandedCollectives.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  expandedCollectives.value = s;
}

function toggleRegistered(id) {
  const s = new Set(expandedRegistered.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  expandedRegistered.value = s;
}

// --- Format helpers ---
function formatTimestamp(ts) {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString('cs-CZ');
}

function formatDate(ts) {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString('cs-CZ');
}

function formatAddress(addr) {
  if (!addr) return '—';
  const parts = [addr.street, addr.house_number, addr.zip_code, addr.township, addr.country].filter(Boolean);
  return parts.join(', ') || '—';
}

// --- Transfer Modal ---
function openTransferModal(collective) {
  transferTarget.value = collective;
  transferAction.value = 'nullify';
  transferTargetCollective.value = null;
  showTransferPicker.value = false;
  showTransferModal.value = true;
}

function selectTransferTarget(cm) {
  transferTargetCollective.value = cm;
  showTransferPicker.value = false;
}

const transferTargetIsTerminated = computed(() => {
  return transferTargetCollective.value && transferTargetCollective.value.membership_extinction_date != null;
});

async function confirmTransfer() {
  if (!transferTarget.value) return;
  transferLoading.value = true;
  try {
    await transferRegisteredMembers(
      transferTarget.value.id,
      transferAction.value,
      transferAction.value === 'transfer' ? transferTargetCollective.value?.id : undefined
    );
    // If transferred to a terminated collective, terminate the moved registered members
    if (transferAction.value === 'transfer' && transferTargetIsTerminated.value) {
      const affected = allRegistered.value.filter(
        rm => rm.collective_member_ref === transferTarget.value.id && rm.membership_extinction_date == null
      );
      await Promise.all(
        affected.map(rm => updateRegisteredMember(rm.id, { membership_extinction_date: new Date() }))
      );
    }
    showTransferModal.value = false;
    await fetchData();
  } catch (err) {
    errorStore.setError(err.message, 0);
  } finally {
    transferLoading.value = false;
  }
}

// --- Terminate / Delete collective ---
function confirmTerminateCollective(collective) {
  confirmMessage.value = `Pokud ukončíte členství kolektivního člena, ke kterému jsou vázáni evidovaní členové, jeho evidovaní členové budou také terminováni. Opravdu chcete ukončit členství kolektivního člena „${collective.name}"?`;
  confirmBtnClass.value = 'btn-red';
  confirmAction.value = async () => {
    confirmLoading.value = true;
    try {
      await terminateCollective(collective.id);
      showConfirmModal.value = false;
      await fetchData();
    } catch (err) {
      errorStore.setError(err.message, 0);
    } finally {
      confirmLoading.value = false;
    }
  };
  showConfirmModal.value = true;
}

function confirmDeleteCollective(collective) {
  confirmMessage.value = `Pokud smažete kolektivního člena, ke kterému jsou vázáni evidovaní členové, jeho evidovaní členové budou také smazáni. Opravdu chcete smazat kolektivního člena „${collective.name}"? Tato akce je nevratná.`;
  confirmBtnClass.value = 'btn-red';
  confirmAction.value = async () => {
    confirmLoading.value = true;
    try {
      await deleteCollective(collective.id);
      showConfirmModal.value = false;
      await fetchData();
    } catch (err) {
      errorStore.setError(err.message, 0);
    } finally {
      confirmLoading.value = false;
    }
  };
  showConfirmModal.value = true;
}

// --- Activate collective ---
function openActivateModal(collective) {
  activateTarget.value = collective;
  showActivateModal.value = true;
}

async function activateCollectiveOnly() {
  if (!activateTarget.value) return;
  activateLoading.value = true;
  try {
    await updateCollectiveMember(activateTarget.value.id, { membership_extinction_date: null });
    showActivateModal.value = false;
    await fetchData();
  } catch (err) {
    errorStore.setError(err.message, 0);
  } finally {
    activateLoading.value = false;
  }
}

async function activateCollectiveAndRegistered() {
  if (!activateTarget.value) return;
  activateLoading.value = true;
  try {
    await updateCollectiveMember(activateTarget.value.id, { membership_extinction_date: null });
    const registered = allRegistered.value.filter(
      rm => rm.collective_member_ref === activateTarget.value.id && rm.membership_extinction_date != null
    );
    await Promise.all(
      registered.map(rm => updateRegisteredMember(rm.id, { membership_extinction_date: null }))
    );
    showActivateModal.value = false;
    await fetchData();
  } catch (err) {
    errorStore.setError(err.message, 0);
  } finally {
    activateLoading.value = false;
  }
}

// --- Terminate / Delete / Activate registered member ---
function confirmTerminateRegistered(member) {
  confirmMessage.value = `Opravdu chcete ukončit členství evidovaného člena „${member.first_name} ${member.last_name}"?`;
  confirmBtnClass.value = 'btn-red';
  confirmAction.value = async () => {
    confirmLoading.value = true;
    try {
      await updateRegisteredMember(member.id, {
        membership_extinction_date: new Date()
      });
      showConfirmModal.value = false;
      await fetchData();
    } catch (err) {
      errorStore.setError(err.message, 0);
    } finally {
      confirmLoading.value = false;
    }
  };
  showConfirmModal.value = true;
}

function confirmDeleteRegistered(member) {
  confirmMessage.value = `Opravdu chcete smazat evidovaného člena „${member.first_name} ${member.last_name}"? Tato akce je nevratná.`;
  confirmBtnClass.value = 'btn-red';
  confirmAction.value = async () => {
    confirmLoading.value = true;
    try {
      await deleteRegisteredMember(member.id);
      showConfirmModal.value = false;
      await fetchData();
    } catch (err) {
      errorStore.setError(err.message, 0);
    } finally {
      confirmLoading.value = false;
    }
  };
  showConfirmModal.value = true;
}

function confirmActivateRegistered(member) {
  const parentCollective = member.collective_member_ref
    ? allCollectives.value.find(cm => cm.id === member.collective_member_ref)
    : null;
  const isParentTerminated = parentCollective && parentCollective.membership_extinction_date != null;

  if (isParentTerminated) {
    confirmMessage.value =
      `Kolektivní člen „${parentCollective.name}" je zaniklý. ` +
      `Aktivní evidovaný člen nemůže být přiřazen k zaniklému kolektivnímu členovi. ` +
      `Příslušnost ke kolektivnímu členovi bude zrušena a evidovaný člen „${member.first_name} ${member.last_name}" bude aktivován jako individuální člen. Chcete pokračovat?`;
  } else {
    confirmMessage.value = `Opravdu chcete aktivovat evidovaného člena „${member.first_name} ${member.last_name}"?`;
  }

  confirmBtnClass.value = 'btn-green';
  confirmAction.value = async () => {
    confirmLoading.value = true;
    try {
      const updates = { membership_extinction_date: null };
      if (isParentTerminated) {
        updates.collective_member_ref = null;
      }
      await updateRegisteredMember(member.id, updates);
      showConfirmModal.value = false;
      await fetchData();
    } catch (err) {
      errorStore.setError(err.message, 0);
    } finally {
      confirmLoading.value = false;
    }
  };
  showConfirmModal.value = true;
}
</script>

<template>
  <div class="members-view">

    <!-- Sticky header -->
    <div class="sticky-header">
      <h1 class="members-heading">{{ heading }}</h1>
      <div class="search-wrapper">
        <input
          v-model="searchQuery"
          class="search-input"
          type="text"
          placeholder="Hledat podle jména…"
          @keyup.enter="handleSearch"
        />
        <button
          v-if="searchResults"
          class="search-clear"
          @click="clearSearch"
          title="Zrušit hledání"
        >✕</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-text">Načítání…</div>

    <!-- Empty state -->
    <div v-else-if="!hasAnyContent" class="empty-text">
      {{ searchResults ? 'Žádné výsledky.' : 'Žádní členové k zobrazení.' }}
    </div>

    <!-- Members list -->
    <div v-else class="collectives-list">

      <!-- Individual members row (registered with no collective ref) -->
      <div v-if="individualMembers.length > 0" class="expandable-row">
        <div class="row-header" @click="individualExpanded = !individualExpanded">
          <img
            src="@/assets/icons/arrow.png"
            class="arrow-icon"
            :class="{ rotated: individualExpanded }"
            alt="arrow"
          />
          <span class="row-name">Individuální členové</span>
          <span class="row-count">{{ individualMembers.length }} evidovaných členů</span>
        </div>

        <div v-if="individualExpanded" class="row-detail">
          <div class="registered-list" style="margin-top: 0;">
            <div
              v-for="rm in individualMembers"
              :key="rm.id"
              class="expandable-row nested"
            >
              <div class="row-header" @click="toggleRegistered(rm.id)">
                <img
                  src="@/assets/icons/arrow.png"
                  class="arrow-icon small"
                  :class="{ rotated: expandedRegistered.has(rm.id) }"
                  alt="arrow"
                />
                <span class="row-name">{{ rm.first_name }} {{ rm.last_name }}</span>
              </div>

              <div v-if="expandedRegistered.has(rm.id)" class="row-detail nested-detail">
                <div class="detail-content">
                  <div class="detail-left">
                    <div class="detail-grid">
                      <span class="label">Rodné číslo:</span>
                      <span>{{ rm.birth_number || '—' }}</span>
                      <span class="label">Pohlaví:</span>
                      <span>{{ rm.sex || '—' }}</span>
                      <span class="label">Datum narození:</span>
                      <span>{{ formatDate(rm.date_of_birth) }}</span>
                      <span class="label">Národnost:</span>
                      <span>{{ rm.nationality_code || '—' }}</span>
                      <span class="label">Adresa:</span>
                      <span>{{ formatAddress(rm.address) }}</span>
                      <span class="label">Vznik členství:</span>
                      <span>{{ formatDate(rm.membership_origin_date) }}</span>
                      <span class="label" v-if="!isActive">Zánik členství:</span>
                      <span v-if="!isActive">{{ formatDate(rm.membership_extinction_date) }}</span>
                      <span class="label">Platnost lékařské prohlídky:</span>
                      <span>{{ formatDate(rm.medical_examination_validity) }}</span>
                      <span class="label">Soutěže (posl. 12 měs.):</span>
                      <span>{{ rm.competitions_last_12_months ?? '—' }}</span>
                      <span class="label">Závodník:</span>
                      <span>{{ rm.athlete ? 'Ano' : 'Ne' }}</span>
                      <span class="label">Rozhodčí:</span>
                      <span>{{ rm.referee ? 'Ano' : 'Ne' }}</span>
                      <span class="label">Trenér:</span>
                      <span>{{ rm.coach ? 'Ano' : 'Ne' }}</span>
                      <span class="label">Vytvořeno:</span>
                      <span>{{ formatTimestamp(rm.createdAt) }} — {{ rm.createdBy || '—' }}</span>
                      <span class="label">Upraveno:</span>
                      <span>{{ formatTimestamp(rm.modifiedAt) }} — {{ rm.modifiedBy || '—' }}</span>
                    </div>
                  </div>

                  <div v-if="canEdit" class="detail-actions">
                    <button
                      v-if="isActive"
                      class="btn-red btn-sm"
                      @click.stop="confirmTerminateRegistered(rm)"
                    >
                      Ukončit členství
                    </button>
                    <button
                      v-else
                      class="btn-red btn-sm"
                      @click.stop="confirmDeleteRegistered(rm)"
                    >
                      Smazat
                    </button>
                    <button
                      v-if="!isActive"
                      class="btn-green btn-sm"
                      @click.stop="confirmActivateRegistered(rm)"
                    >
                      Aktivovat
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Collective members list -->
      <div
        v-for="cm in filteredCollectives"
        :key="cm.id"
        class="expandable-row"
      >
        <!-- Collective header row -->
        <div class="row-header" @click="toggleCollective(cm.id)">
          <img
            src="@/assets/icons/arrow.png"
            class="arrow-icon"
            :class="{ rotated: expandedCollectives.has(cm.id) }"
            alt="arrow"
          />
          <span class="row-name">{{ cm.name }}</span>
          <span class="row-count">{{ countRegisteredForCollective(cm.id) }} evidovaných členů</span>
        </div>

        <!-- Collective expanded detail -->
        <div v-if="expandedCollectives.has(cm.id)" class="row-detail">
          <div class="detail-content">
            <!-- Left info -->
            <div class="detail-left">
              <div class="detail-section">
                <h3>Informace o členu</h3>
                <div class="detail-grid">
                  <span class="label">IČO:</span>
                  <span>{{ cm.company_id || '—' }}</span>
                  <span class="label">Adresa:</span>
                  <span>{{ formatAddress(cm.address) }}</span>
                  <span class="label">Vznik členství:</span>
                  <span>{{ formatDate(cm.membership_origin_date) }}</span>
                  <span class="label" v-if="!isActive">Zánik členství:</span>
                  <span v-if="!isActive">{{ formatDate(cm.membership_extinction_date) }}</span>
                  <span class="label">Vytvořeno:</span>
                  <span>{{ formatTimestamp(cm.createdAt) }} {{ cm.createdBy || '—' }}</span>
                  <span class="label">Upraveno:</span>
                  <span>{{ formatTimestamp(cm.modifiedAt) }} {{ cm.modifiedBy || '—' }}</span>
                </div>
              </div>
            </div>

            <!-- Right contact -->
            <div class="detail-right">
              <div class="detail-section">
                <h3>Kontaktní osoba</h3>
                <div class="detail-grid" v-if="cm.contact_person">
                  <span class="label">Jméno:</span>
                  <span>{{ cm.contact_person.first_name || '—' }} {{ cm.contact_person.last_name || '' }}</span>
                  <span class="label">Email:</span>
                  <span>{{ cm.contact_person.email || '—' }}</span>
                  <span class="label">Telefon:</span>
                  <span>{{ cm.contact_person.phone_number || '—' }}</span>
                </div>
                <span v-else class="empty-info">Žádná kontaktní osoba</span>
              </div>
            </div>

            <!-- Action buttons -->
            <div v-if="canEdit" class="detail-actions">
              <button class="btn-white btn-sm" @click.stop="openTransferModal(cm)">
                Převést členy
              </button>
              <button
                v-if="isActive"
                class="btn-red btn-sm"
                @click.stop="confirmTerminateCollective(cm)"
              >
                Ukončit členství
              </button>
              <button
                v-else
                class="btn-red btn-sm"
                @click.stop="confirmDeleteCollective(cm)"
              >
                Smazat
              </button>
              <button
                v-if="!isActive"
                class="btn-green btn-sm"
                @click.stop="openActivateModal(cm)"
              >
                Aktivovat
              </button>
            </div>
          </div>

           <!-- Registered members nested list -->
          <div class="registered-list">
            <h3 class="registered-heading">Evidovaní členové</h3>
            <div
              v-for="rm in getRegisteredForCollective(cm.id)"
              :key="rm.id"
              class="expandable-row nested"
              :class="{ terminated: rm.membership_extinction_date != null }"
            >
              <div class="row-header" @click="toggleRegistered(rm.id)">
                <img
                  src="@/assets/icons/arrow.png"
                  class="arrow-icon small"
                  :class="{ rotated: expandedRegistered.has(rm.id) }"
                  alt="arrow"
                />
                <span class="row-name">{{ rm.first_name }} {{ rm.last_name }}</span>
              </div>

              <div v-if="expandedRegistered.has(rm.id)" class="row-detail nested-detail">
                <div class="detail-content">
                  <div class="detail-left">
                    <div class="detail-grid">
                      <span class="label">Rodné číslo:</span>
                      <span>{{ rm.birth_number || '—' }}</span>
                      <span class="label">Pohlaví:</span>
                      <span>{{ rm.sex || '—' }}</span>
                      <span class="label">Datum narození:</span>
                      <span>{{ formatDate(rm.date_of_birth) }}</span>
                      <span class="label">Národnost:</span>
                      <span>{{ rm.nationality_code || '—' }}</span>
                      <span class="label">Adresa:</span>
                      <span>{{ formatAddress(rm.address) }}</span>
                      <span class="label">Vznik členství:</span>
                      <span>{{ formatDate(rm.membership_origin_date) }}</span>
                      <span class="label" v-if="!isActive || rm.membership_extinction_date != null">Zánik členství:</span>
                      <span v-if="!isActive || rm.membership_extinction_date != null">{{ formatDate(rm.membership_extinction_date) }}</span>
                      <span class="label">Platnost lékařské prohlídky:</span>
                      <span>{{ formatDate(rm.medical_examination_validity) }}</span>
                      <span class="label">Soutěže (posl. 12 měs.):</span>
                      <span>{{ rm.competitions_last_12_months ?? '—' }}</span>
                      <span class="label">Závodník:</span>
                      <span>{{ rm.athlete ? 'Ano' : 'Ne' }}</span>
                      <span class="label">Rozhodčí:</span>
                      <span>{{ rm.referee ? 'Ano' : 'Ne' }}</span>
                      <span class="label">Trenér:</span>
                      <span>{{ rm.coach ? 'Ano' : 'Ne' }}</span>
                      <span class="label">Vytvořeno:</span>
                      <span>{{ formatTimestamp(rm.createdAt) }} — {{ rm.createdBy || '—' }}</span>
                      <span class="label">Upraveno:</span>
                      <span>{{ formatTimestamp(rm.modifiedAt) }} — {{ rm.modifiedBy || '—' }}</span>
                    </div>
                  </div>

                  <div v-if="canEdit" class="detail-actions">
                    <button
                      v-if="isActive"
                      class="btn-red btn-sm"
                      @click.stop="confirmTerminateRegistered(rm)"
                    >
                      Ukončit členství
                    </button>
                    <button
                      v-else
                      class="btn-red btn-sm"
                      @click.stop="confirmDeleteRegistered(rm)"
                    >
                      Smazat
                    </button>
                    <button
                      v-if="!isActive"
                      class="btn-green btn-sm"
                      @click.stop="confirmActivateRegistered(rm)"
                    >
                      Aktivovat
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="getRegisteredForCollective(cm.id).length === 0" class="empty-info">
              Žádní evidovaní členové
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Transfer Modal -->
    <div v-if="showTransferModal" class="modal-overlay" @click.self="showTransferModal = false">
      <div class="modal-card">
        <h2>Převést evidované členy</h2>
        <p>Kolektivní člen: <strong>{{ transferTarget?.name }}</strong></p>

        <div class="radio-group">
          <label class="radio-option">
            <input type="radio" v-model="transferAction" value="nullify" />
            <span>Zrušit příslušnost</span>
          </label>
          <label class="radio-option">
            <input type="radio" v-model="transferAction" value="nullify_and_terminate" />
            <span>Zrušit příslušnost a ukončit členství</span>
          </label>
          <label class="radio-option">
            <input type="radio" v-model="transferAction" value="transfer" />
            <span>Převést k jinému kolektivnímu členovi</span>
          </label>
        </div>

        <!-- Target collective picker -->
        <div v-if="transferAction === 'transfer'" class="transfer-picker">
          <label class="picker-label">Cílový kolektivní člen</label>
          <div class="picker-wrapper">
            <div class="picker-input" @click="showTransferPicker = !showTransferPicker">
              <span v-if="transferTargetCollective" class="picker-value">
                {{ transferTargetCollective.name }}
              </span>
              <span v-else class="picker-placeholder">Vyberte kolektivního člena…</span>
            </div>
            <div v-if="showTransferPicker" class="picker-dropdown">
              <div
                v-for="tc in getTransferTargetCollectives(transferTarget?.id)"
                :key="tc.id"
                class="picker-option"
                @click="selectTransferTarget(tc)"
              >
                {{ tc.name }}
                <span v-if="tc.membership_extinction_date != null" class="picker-option-note"> (zaniklý)</span>
              </div>
            </div>
          </div>
        </div>

        <p v-if="transferAction === 'transfer' && transferTargetIsTerminated" class="transfer-warning">
          Vybraný kolektivní člen je zaniklý. Převedení evidovaní členové budou také terminováni, protože aktivní evidovaný člen nemůže být přiřazen k zaniklému kolektivnímu členovi.
        </p>

        <div class="modal-actions">
          <button class="btn-white" @click="showTransferModal = false">Zrušit</button>
          <button
            class="btn-blue"
            :disabled="transferLoading || (transferAction === 'transfer' && !transferTargetCollective)"
            @click="confirmTransfer"
          >
            {{ transferLoading ? 'Probíhá…' : 'Potvrdit' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Activate Collective Modal -->
    <div v-if="showActivateModal" class="modal-overlay" @click.self="showActivateModal = false">
      <div class="modal-card">
        <h2>Aktivovat kolektivního člena</h2>
        <p>Kolektivní člen: <strong>{{ activateTarget?.name }}</strong></p>
        <p>Chcete aktivovat pouze kolektivního člena, nebo i všechny přidružené evidované členy?</p>

        <div class="modal-actions">
          <button class="btn-white" @click="showActivateModal = false">Zrušit</button>
          <button
            class="btn-green"
            :disabled="activateLoading"
            @click="activateCollectiveOnly"
          >
            Pouze kolektivního
          </button>
          <button
            class="btn-blue"
            :disabled="activateLoading"
            @click="activateCollectiveAndRegistered"
          >
            Kolektivního i evidované
          </button>
        </div>
      </div>
    </div>

    <!-- Confirm Modal (generic) -->
    <div v-if="showConfirmModal" class="modal-overlay" @click.self="showConfirmModal = false">
      <div class="modal-card">
        <h2>Potvrzení</h2>
        <p>{{ confirmMessage }}</p>
        <div class="modal-actions">
          <button class="btn-white" @click="showConfirmModal = false">Zrušit</button>
          <button
            :class="confirmBtnClass"
            :disabled="confirmLoading"
            @click="confirmAction"
          >
            {{ confirmLoading ? 'Probíhá…' : 'Potvrdit' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.members-view {
  padding: 0 0 2rem 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Sticky header */
.sticky-header {
  position: sticky;
  top: 100px;
  z-index: 10;
  background-color: var(--white-97);
  padding: 1.5rem 0;
  margin-top: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.members-heading {
  font-size: 1.6rem;
  font-weight: 700;
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  width: 320px;
  padding-right: 2rem;
}

.search-clear {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  font-size: 1rem;
  color: var(--white-65);
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  line-height: 1;
}

.search-clear:hover {
  color: var(--text-color);
  background-color: var(--white-95);
}

/* Loading / empty */
.loading-text,
.empty-text {
  font-size: 1.1rem;
  color: var(--white-65);
  padding: 2rem 0;
}

/* Expandable rows */
.expandable-row {
  background-color: var(--white-99);
  border-radius: 8px;
  box-shadow: 2px 2px 4px var(--shadow-color);
  overflow: hidden;
}

.expandable-row.nested {
  background-color: var(--white-97);
  box-shadow: 2px 2px 4px var(--shadow-color);
  border-radius: 6px;
}

.expandable-row.nested.terminated {
  background-color: var(--white-85);
}

.row-header {
  display: flex;
  align-items: center;
  padding: 0.75rem 1.25rem;
  cursor: pointer;
  gap: 0.75rem;
  transition: background-color 0.1s;
  user-select: none;
}

.row-header:hover {
  background-color: var(--white-95);
}

.arrow-icon {
  width: 18px;
  height: 18px;
  transition: transform 0.2s;
  flex-shrink: 0;
  opacity: 0.6;
}

.arrow-icon.small {
  width: 14px;
  height: 14px;
}

.arrow-icon.rotated {
  transform: rotate(180deg);
}

.row-name {
  font-size: 1.05rem;
  font-weight: 600;
}

.row-count {
  margin-left: auto;
  font-size: 0.9rem;
  color: var(--white-65);
}

/* Detail section */
.row-detail {
  padding: 0 1.25rem 1.25rem;
}

.nested-detail {
  padding: 0 1rem 1rem;
}

.detail-content {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}

.detail-left,
.detail-right {
  flex: 1;
  min-width: 260px;
}

.detail-section h3 {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.6rem;
  color: var(--text-color);
}

.detail-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.25rem 1rem;
  font-size: 0.92rem;
  line-height: 1.6;
}

.detail-grid .label {
  font-weight: 600;
  color: var(--text-color);
  white-space: nowrap;
}

.empty-info {
  font-size: 0.9rem;
  color: var(--white-65);
  padding: 0.5rem 0;
}

/* Action buttons */
.detail-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex-shrink: 0;
  align-self: flex-start;
}

.btn-sm {
  font-size: 0.95rem;
  padding: 0.4rem 0.8rem;
}

/* Registered list inside expanded collective */
.registered-list {
  margin-top: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.registered-heading {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

/* Modal extras */
.radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
}

.radio-option input[type="radio"] {
  accent-color: var(--primary);
  width: 16px;
  height: 16px;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

/* Transfer picker */
.transfer-picker {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
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

.transfer-warning {
  color: var(--red);
  font-size: 0.95rem;
  font-weight: 600;
}

/* Collectives list */
.collectives-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
</style>
