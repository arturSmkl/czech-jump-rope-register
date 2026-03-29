import { getAuth } from "firebase/auth";

const API_URL = import.meta.env.VITE_API_URL;

const authenticatedRequest = async (fetchUrl, method, bodyObject) => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) throw new Error("You must be logged in.");

  const token = await user.getIdToken();

  const response = await fetch(fetchUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(bodyObject)
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed");

  return result;
};

/**
 * Transfer registered members of a collective.
 * @param {string} collectiveId - The source collective ID.
 * @param {"nullify"|"nullify_and_terminate"|"transfer"} action - The transfer action.
 * @param {string} [targetCollectiveId] - Required if action is "transfer".
 */
export const transferRegisteredMembers = async (collectiveId, action, targetCollectiveId) => {
  const body = { collectiveId, action };
  if (action === "transfer") {
    if (!targetCollectiveId) throw new Error("targetCollectiveId is required for transfer action.");
    body.targetCollectiveId = targetCollectiveId;
  }
  return authenticatedRequest(`${API_URL}/registered/transfer`, "POST", body);
};

/**
 * Terminate a collective member (sets membership_extinction_date).
 * @param {string} collectiveId - The collective ID to terminate.
 */
export const terminateCollective = async (collectiveId) =>
  authenticatedRequest(`${API_URL}/collectives/terminate`, "POST", { collectiveId });

/**
 * Delete a collective member permanently.
 * @param {string} collectiveId - The collective ID to delete.
 */
export const deleteCollective = async (collectiveId) =>
  authenticatedRequest(`${API_URL}/collectives/delete`, "DELETE", { collectiveId });
