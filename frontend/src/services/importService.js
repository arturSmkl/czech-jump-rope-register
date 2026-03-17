import { getAuth } from "firebase/auth";

const API_URL = "http://127.0.0.1:5001/czech-jump-rope-register-e8dea/europe-west3/api";

export const uploadCollectives = async (data) => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) throw new Error("You must be logged in.");

  // Get the Bearer Token for the middleware
  const token = await user.getIdToken();

  const response = await fetch(`${API_URL}/collectives/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ data })
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Import failed");

  return result;
};

export const uploadRegistered = async (data, collectiveId) => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) throw new Error("You must be logged in.");

  // Get the Bearer Token for the middleware
  const token = await user.getIdToken();

  const response = await fetch(`${API_URL}/registered/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      data: data,
      collective_member_ref: collectiveId || null
    })
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Import failed");

  return result;
};
