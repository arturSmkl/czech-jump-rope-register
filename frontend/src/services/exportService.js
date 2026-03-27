import { getAuth } from "firebase/auth";

const API_URL = "/api";

const downloadExport = async (fetchUrl) => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required. Please log in.");

  const token = await user.getIdToken();

  const response = await fetch(fetchUrl, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  // Handle Server Errors (404, 500, etc.)
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server responded with status ${response.status}`);
  }

  // Extract Filename from Header
  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = 'export.csv'; // Fallback

  if (contentDisposition && contentDisposition.includes('filename=')) {
    // Regex to grab the value after 'filename=' (handles quotes or no quotes)
    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match && match[1]) {
      filename = match[1].replace(/['"]/g, '');
    }
  }

  // Process Blob
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();

  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);

  return true;
};

export const downloadCollectiveExport = async () => {
  try {
    return await downloadExport(`${API_URL}/collectives/export`)
  }
  catch (err) {
    throw err;
  }
};

export const downloadRegisteredExport = async (collectiveId) => {
  try {
    return await downloadExport(`${API_URL}/registered/export/${collectiveId}`);
  }
  catch (err) {
    throw err;
  }
};

export const downloadRegisteredExportNsa = async () => {
  try {
    return await downloadExport(`${API_URL}/registered/export-nsa`);
  }
  catch (err) {
    throw err;
  }
};

export const downloadOverviewPdf = async () => {
  try {
    return await downloadExport(`${API_URL}/reports/overview`);
  }
  catch (err) {
    throw err;
  }
};
