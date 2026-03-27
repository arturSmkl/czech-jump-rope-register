import { getAuth } from "firebase/auth";

const API_URL = "/api";

const uploadData = async (fetchUrl, bodyObject) => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) throw new Error("You must be logged in.");

  // Get the Bearer Token for the middleware
  const token = await user.getIdToken();

  const response = await fetch(fetchUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(bodyObject)
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Import failed");

  return result;
};

export const uploadCollectives = (data) =>
  uploadData(`${API_URL}/collectives/import`, { data });

export const uploadRegistered = (data, collectiveId) =>
  uploadData(`${API_URL}/registered/import`, {
    data,
    collective_member_ref: collectiveId || null
  });
