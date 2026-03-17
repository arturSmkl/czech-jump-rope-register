import { getAuth } from "firebase/auth";

const API_URL = "http://127.0.0.1:5001/czech-jump-rope-register-e8dea/europe-west3/api";

export const downloadExport = async () => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) throw new Error("You must be logged in.");

  const token = await user.getIdToken();

  try {
    const response = await fetch(`${API_URL}/collectives/export`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error("Export failed on server.");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    // 1. Create the formatted date string (dd-mm-yyyy)
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const dateStr = `${day}-${month}-${year}`;

    // 2. Create and attach the link
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `collectives_${dateStr}.csv`;

    document.body.appendChild(a); // Some browsers require the element to be in the DOM
    a.click();

    // 3. Cleanup
    window.URL.revokeObjectURL(url); // Free up memory
    document.body.removeChild(a);    // Remove from DOM

  } catch (err) {
    console.error("DOWNLOAD_ERROR:", err);
    throw err;
  }
};
