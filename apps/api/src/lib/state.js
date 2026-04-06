import fs from "node:fs";
import path from "node:path";
import { events, friends, roomMessages, rooms } from "/shared/src/mock-data.js";

const dataDir = path.resolve(process.cwd(), "data");
const stateFile = path.join(dataDir, "runtime-state.json");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function seedState() {
  return {
    users: friends.map((friend) => ({
      id: friend.id,
      name: friend.name,
      status: friend.status,
      note: friend.note,
      roomId: friend.roomId || null,
      email: null,
      passwordHash: null,
      about: ""
    })),
    rooms: clone(rooms),
    events: clone(events),
    messages: clone(roomMessages),
    inviteCodes: [
      {
        code: "mashenin-2026",
        groupName: "mashenin",
        invitedBy: "Богдан",
        availableSlots: 1000,
        usedCount: 0
      }
    ],
    sessions: []
  };
}

function normalizeState(state) {
  state.users = (state.users || []).map((user) => ({
    ...user,
    email: user.email || null,
    passwordHash: user.passwordHash || null,
    about: user.about || ""
  }));
  state.rooms = state.rooms || [];
  state.events = state.events || [];
  state.messages = state.messages || [];
  state.inviteCodes = state.inviteCodes || [];
  state.sessions = state.sessions || [];
  return state;
}

function ensureStateFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(stateFile)) {
    fs.writeFileSync(stateFile, JSON.stringify(seedState(), null, 2));
  }
}

function pruneExpiredSessions(state) {
  const now = Date.now();
  state.sessions = state.sessions.filter((session) => session.expiresAt > now);
  return state;
}

export function readState() {
  ensureStateFile();
  const raw = fs.readFileSync(stateFile, "utf8");
  const state = normalizeState(pruneExpiredSessions(JSON.parse(raw)));
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  return state;
}

export function writeState(state) {
  ensureStateFile();
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

export function updateState(updater) {
  const state = readState();
  const nextState = updater(state) || state;
  writeState(nextState);
  return nextState;
}

export function getStateFilePath() {
  return stateFile;
}
