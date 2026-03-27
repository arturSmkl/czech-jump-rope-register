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

export const uploadCollectives = async (data) => {
    try {
      return await uploadData(`${API_URL}/collectives/import`, {data: data});
    }
    catch (err) {
      throw err;
    }
};

export const uploadRegistered = async (data, collectiveId) => {
  try {
    return await uploadData(`${API_URL}/registered/import`, {
      data: data,
      collective_member_ref: collectiveId || null
    });
  }
  catch (err) {
    throw err;
  }
};
