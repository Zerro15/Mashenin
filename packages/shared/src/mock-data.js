import { ROOM_KINDS } from "./constants.js";

export const friends = [
  
];

export const rooms = [
  {
    id: "general",
    name: "Общая",
    kind: ROOM_KINDS.PERSISTENT,
    members: 0,
    topic: "основной голосовой и текстовый канал"
  },
  {
    id: "games",
    name: "Игры",
    kind: ROOM_KINDS.PERSISTENT,
    members: 0,
    topic: "игры, пати и совместные сессии"
  },
  {
    id: "chill",
    name: "Чилл",
    kind: ROOM_KINDS.PERSISTENT,
    members: 0,
    topic: "спокойный поток и фоновые разговоры"
  },
  {
    id: "movie-night",
    name: "Киноночь",
    kind: ROOM_KINDS.TEMPORARY,
    members: 0,
    topic: "временная комната для совместного просмотра"
  }
];

export const events = [];

export const roomMessages = [];
