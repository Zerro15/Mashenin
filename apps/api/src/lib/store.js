import * as fileStore from "./file-store.js";
import * as sqlStore from "./sql-store.js";

let provider = "file";

export function setStoreProvider(nextProvider) {
  provider = nextProvider;
}

function impl() {
  return provider === "sql" ? sqlStore : fileStore;
}

export async function getSummary(...args) {
  return impl().getSummary(...args);
}

export async function getRooms(...args) {
  return impl().getRooms(...args);
}

export async function getEvents(...args) {
  return impl().getEvents(...args);
}

export async function getRoomById(...args) {
  return impl().getRoomById(...args);
}

export async function getMessagesForRoom(...args) {
  return impl().getMessagesForRoom(...args);
}

export async function getInvitePreview(...args) {
  return impl().getInvitePreview(...args);
}

export async function createSession(...args) {
  return impl().createSession(...args);
}

export async function registerUser(...args) {
  return impl().registerUser(...args);
}

export async function loginWithPassword(...args) {
  return impl().loginWithPassword(...args);
}

export async function getSessionUser(...args) {
  return impl().getSessionUser(...args);
}

export async function getUserById(...args) {
  return impl().getUserById?.(...args) || impl().getSessionUser?.(...args);
}

export async function updateProfile(...args) {
  return impl().updateProfile(...args);
}

export async function clearSession(...args) {
  return impl().clearSession(...args);
}

export async function joinRoom(...args) {
  return impl().joinRoom(...args);
}

export async function leaveRoom(...args) {
  return impl().leaveRoom?.(...args) || null;
}

export async function createRoomAccess(...args) {
  return impl().createRoomAccess(...args);
}

export async function getRoomState(...args) {
  return impl().getRoomState(...args);
}

export async function getRoomSocial(...args) {
  return impl().getRoomSocial(...args);
}

export async function createMessage(...args) {
  return impl().createMessage(...args);
}

export async function updateMessage(...args) {
  return impl().updateMessage?.(...args) || null;
}

export async function deleteMessage(...args) {
  return impl().deleteMessage?.(...args) || null;
}

export async function createRoom(...args) {
  return impl().createRoom?.(...args) || null;
}

export async function getOrCreateDirectRoom(...args) {
  return impl().getOrCreateDirectRoom?.(...args) || { ok: false, error: "not_supported" };
}

export async function createRoomInvite(...args) {
  return impl().createRoomInvite?.(...args) || { ok: false, error: "not_supported" };
}

export async function getRoomInvitePreview(...args) {
  return impl().getRoomInvitePreview?.(...args) || { ok: false, error: "invite_not_found" };
}

export async function acceptRoomInvite(...args) {
  return impl().acceptRoomInvite?.(...args) || { ok: false, error: "invite_not_found" };
}

export async function createEvent(...args) {
  return impl().createEvent(...args);
}

export async function respondToEvent(...args) {
  return impl().respondToEvent(...args);
}

export async function getInvite(...args) {
  return impl().getInvite?.(...args) || null;
}

export async function createUser(...args) {
  return impl().createUser?.(...args) || null;
}

export async function useInvite(...args) {
  return impl().useInvite?.(...args) || null;
}

export async function getRoom(...args) {
  return impl().getRoom?.(...args) || impl().getRoomById(...args);
}

export async function getRoomMembers(...args) {
  return impl().getRoomMembers?.(...args) || [];
}

export async function getRoomPresence(...args) {
  return impl().getRoomPresence?.(...args) || [];
}

export async function updateUserPresence(...args) {
  return impl().updateUserPresence?.(...args) || null;
}

export async function saveMessage(...args) {
  return impl().saveMessage?.(...args) || null;
}

export async function getMessages(...args) {
  return impl().getMessages?.(...args) || [];
}

// Teams (бывшие rooms — быстрые конференции)
export async function getTeams(...args) {
  return impl().getTeams?.(...args) || [];
}

export async function createTeam(...args) {
  return impl().createTeam?.(...args) || null;
}

export async function getTeamById(...args) {
  return impl().getTeamById?.(...args) || null;
}

// Friendships
export async function getFriends(...args) {
  return impl().getFriends?.(...args) || [];
}

export async function getFriendRequests(...args) {
  return impl().getFriendRequests?.(...args) || [];
}

export async function sendFriendRequest(...args) {
  return impl().sendFriendRequest?.(...args) || { ok: false, error: 'not_supported' };
}

export async function acceptFriendRequest(...args) {
  return impl().acceptFriendRequest?.(...args) || { ok: false, error: 'not_supported' };
}

export async function removeFriend(...args) {
  return impl().removeFriend?.(...args) || { ok: false, error: 'not_supported' };
}

// Direct Messages
export async function getDirectMessages(...args) {
  return impl().getDirectMessages?.(...args) || [];
}

export async function sendDirectMessage(...args) {
  return impl().sendDirectMessage?.(...args) || null;
}

export async function markDirectMessagesRead(...args) {
  return impl().markDirectMessagesRead?.(...args) || null;
}

export async function getUnreadDMCount(...args) {
  return impl().getUnreadDMCount?.(...args) || 0;
}

// Team messages
export async function getTeamMessages(...args) {
  return impl().getTeamMessages?.(...args) || [];
}

export async function createTeamMessage(...args) {
  return impl().createTeamMessage?.(...args) || null;
}
