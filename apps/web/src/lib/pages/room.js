import { dashboardScript } from "../client/dashboard.js";
import { shell } from "../layout/shell.js";
import { formatDate, kindLabel, statusLabel, escapeHtml } from "../shared/utils.js";
import { avatar, memberRow } from "../shared/ui.js";

export function roomHtml({ room, messages }) {
  const members = room?.speakers || [];

  return shell({
    title: `mashenin · ${room.name}`,
    activeNav: "rooms",
    activeRoomId: room.id,
    headerTitle: room.id,
    headerTopic: room.topic,
    aside: `
      <div class="members-title">В комнате</div>
      <div class="members-scroll">
        <section class="category">
          <div class="category-title"><span>Подключены</span><span>${escapeHtml(String(members.length))}</span></div>
          ${
            members.length
              ? members.map((member) => memberRow(member.name, member.note, member.status)).join("")
              : '<div class="empty">Комната пустая, можно зайти первым.</div>'
          }
        </section>
        <section class="category">
          <div class="category-title"><span>Состояние входа</span><span></span></div>
          <div id="room-state">
            <div class="empty">Проверяю доступ к голосу...</div>
          </div>
        </section>
        <section class="category">
          <div class="category-title"><span>Доступные</span><span></span></div>
          <div id="room-social">
            <div class="empty">Собираю доступных людей...</div>
          </div>
        </section>
      </div>
    `,
    scriptType: "module",
    script: `
      import { Room, RoomEvent, createLocalAudioTrack } from "https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.esm.mjs";

      ${dashboardScript()}

      const voiceAvatar = (name) => {
        const initial = String(name || "M").trim().charAt(0).toUpperCase() || "M";
        return '<div class="avatar">' + safe(initial) + '</div>';
      };

      const voiceMemberRow = (name, note, status) =>
        '<div class="member-row">' +
          voiceAvatar(name) +
          '<div class="member-text">' +
            '<strong>' + safe(name) + '</strong>' +
            '<span><span class="status-dot status-' + safe(status) + '"></span>' + safe(note) + '</span>' +
          '</div>' +
        '</div>';

      const roomId = "${escapeHtml(room.id)}";
      const voiceStatus = document.querySelector("#voice-status");
      const voiceDot = document.querySelector("#voice-dot");
      const joinBtn = document.querySelector("#voice-join");
      const muteBtn = document.querySelector("#voice-mute");
      const leaveBtn = document.querySelector("#voice-leave");
      const refreshDevicesBtn = document.querySelector("#refresh-devices");
      const inputSelect = document.querySelector("#input-device");
      const meterFill = document.querySelector("#voice-meter-fill");
      const meterLabel = document.querySelector("#voice-meter-label");
      const voiceParticipants = document.querySelector("#voice-participants");
      const audioMount = document.querySelector("#voice-audio");

      let liveRoom = null;
      let localAudioTrack = null;
      let audioContext = null;
      let analyser = null;
      let meterSource = null;
      let meterFrame = 0;
      let isMuted = false;
      let isConnecting = false;
      let selectedDeviceId = "";

      const setVoiceState = (label, mode = "idle") => {
        voiceStatus.textContent = label;
        voiceDot.className = "voice-dot" +
          (mode === "live" ? " is-live" : mode === "off" ? " is-off" : "");
      };

      const explainJoinFailure = (payload) => {
        if (payload?.error === "unauthorized") {
          return "Сначала войди по инвайту на этом же адресе браузера.";
        }

        if (payload?.error === "join_failed") {
          return "Не удалось войти в комнату. Обычно это значит, что нет активной сессии.";
        }

        if (payload?.error === "room_not_found") {
          return "Комната не найдена или запрос ушел без нужной сессии.";
        }

        return "Не удалось войти в голосовой канал. Проверь, что ты вошел на этом же адресе.";
      };

      const renderParticipants = () => {
        if (!liveRoom) {
          voiceParticipants.innerHTML = '<div class="empty">Сначала подключись к голосовому каналу.</div>';
          return;
        }

        const entries = [];
        liveRoom.remoteParticipants.forEach((participant) => {
          const audioLevel = Number(participant.audioLevel || 0);
          entries.push({
            name: participant.name || participant.identity,
            role: audioLevel > 0.02 ? "говорит" : "слушает",
            speaking: audioLevel > 0.02
          });
        });

        const localName = liveRoom.localParticipant.name || liveRoom.localParticipant.identity || "Ты";
        entries.unshift({
          name: localName,
          role: isMuted ? "ты, микрофон выключен" : "ты, микрофон включен",
          speaking: false
        });

        voiceParticipants.innerHTML = entries.map((entry) =>
          '<div class="voice-participant">' +
            '<div class="voice-participant-meta">' +
              voiceAvatar(entry.name) +
              '<div class="member-text"><strong>' + safe(entry.name) + '</strong><span>' + safe(entry.role) + '</span></div>' +
            '</div>' +
            '<span class="voice-badge' + (entry.speaking ? ' is-speaking' : '') + '">' + (entry.speaking ? 'говорит' : 'в голосе') + '</span>' +
          '</div>'
        ).join("");
      };

      const syncButtons = () => {
        const connected = Boolean(liveRoom);
        joinBtn.disabled = connected || isConnecting;
        muteBtn.disabled = !connected || !localAudioTrack;
        leaveBtn.disabled = !connected;
        muteBtn.textContent = isMuted ? "Включить микрофон" : "Выключить микрофон";
      };

      const detachAllRemoteAudio = () => {
        audioMount.querySelectorAll("audio").forEach((node) => node.remove());
      };

      const stopMeter = () => {
        if (meterFrame) {
          cancelAnimationFrame(meterFrame);
          meterFrame = 0;
        }

        if (meterSource) {
          meterSource.disconnect();
          meterSource = null;
        }

        analyser = null;

        if (audioContext) {
          audioContext.close().catch(() => {});
          audioContext = null;
        }

        meterFill.style.width = "0%";
        meterLabel.textContent = "уровень микрофона: 0%";
      };

      const startMeter = (track) => {
        stopMeter();

        if (!track?.mediaStreamTrack) {
          return;
        }

        audioContext = new AudioContext();
        const stream = new MediaStream([track.mediaStreamTrack]);
        meterSource = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        meterSource.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (!analyser) return;
          analyser.getByteTimeDomainData(data);

          let peak = 0;
          for (let i = 0; i < data.length; i += 1) {
            const value = Math.abs(data[i] - 128) / 128;
            if (value > peak) peak = value;
          }

          const percent = Math.min(100, Math.round(peak * 220));
          meterFill.style.width = percent + "%";
          meterLabel.textContent = "уровень микрофона: " + percent + "%";
          meterFrame = requestAnimationFrame(tick);
        };

        tick();
      };

      const loadDevices = async () => {
        if (!navigator.mediaDevices?.enumerateDevices) {
          return;
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter((device) => device.kind === "audioinput");

        inputSelect.innerHTML = inputs.length
          ? inputs.map((device, index) =>
              '<option value="' + safe(device.deviceId) + '">' + safe(device.label || ("Микрофон " + (index + 1))) + '</option>'
            ).join("")
          : '<option value="">Микрофон не найден</option>';

        if (selectedDeviceId && inputs.some((device) => device.deviceId === selectedDeviceId)) {
          inputSelect.value = selectedDeviceId;
        }
      };

      const cleanupVoice = () => {
        stopMeter();

        if (localAudioTrack) {
          localAudioTrack.stop();
          localAudioTrack = null;
        }

        if (liveRoom) {
          const room = liveRoom;
          liveRoom = null;
          room.disconnect();
        }

        isMuted = false;
        detachAllRemoteAudio();
        setVoiceState("не подключен", "off");
        renderParticipants();
        syncButtons();
      };

      Promise.all([
        fetch("/data/room/${escapeHtml(room.id)}/state").then((response) => response.json()).catch(() => ({ ok: false })),
        fetch("/data/room/${escapeHtml(room.id)}/social").then((response) => response.json()).catch(() => ({ ok: false }))
      ]).then(([state, social]) => {
        if (state.ok && state.data) {
          const actionMap = {
            login: "Нужен вход, чтобы подключиться к голосу.",
            open_voice: "Ты уже в этой комнате. Можно подключаться к голосу.",
            join_room: "Комната доступна. Нажми «Подключиться», чтобы зайти."
          };

          document.querySelector("#room-state").innerHTML =
            '<article class="member-card">' +
              '<div class="card-title">' + safe(state.data.user ? state.data.user.name : "Гость") + '</div>' +
              '<div class="meta">' + safe(actionMap[state.data.recommendedAction] || "Состояние неизвестно") + '</div>' +
            '</article>';
        }

        if (social.ok && social.data) {
          document.querySelector("#room-social").innerHTML = social.data.availableToInvite.length
            ? social.data.availableToInvite.map((friend) => voiceMemberRow(friend.name, friend.note, "online")).join("")
            : '<div class="empty">Все, кто онлайн, уже здесь.</div>';
        }
      });

      joinBtn.addEventListener("click", async () => {
        if (isConnecting || liveRoom) {
          return;
        }

        isConnecting = true;
        setVoiceState("подключаюсь...", "idle");
        syncButtons();

        try {
          const joinResponse = await fetch("/data/room/" + roomId + "/join", {
            method: "POST"
          });
          const joinPayload = await joinResponse.json().catch(() => ({ ok: false }));

          if (!joinResponse.ok || !joinPayload.ok) {
            throw new Error(explainJoinFailure(joinPayload));
          }

          const voiceResponse = await fetch("/data/room/" + roomId + "/voice");
          const voicePayload = await voiceResponse.json().catch(() => ({ ok: false }));

          if (!voiceResponse.ok || !voicePayload.ok || !voicePayload.data?.token || !voicePayload.data?.wsUrl) {
            throw new Error("Не удалось получить доступ к голосу. Проверь вход и состояние сервера.");
          }

          liveRoom = new Room({
            adaptiveStream: true,
            dynacast: true
          });

          liveRoom.on(RoomEvent.TrackSubscribed, (track) => {
            if (track.kind === "audio") {
              const element = track.attach();
              element.autoplay = true;
              audioMount.appendChild(element);
            }
          });

          liveRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
            track.detach().forEach((element) => element.remove());
          });

          liveRoom.on(RoomEvent.ParticipantConnected, () => {
            renderParticipants();
          });

          liveRoom.on(RoomEvent.ParticipantDisconnected, () => {
            renderParticipants();
          });

          liveRoom.on(RoomEvent.ActiveSpeakersChanged, () => {
            renderParticipants();
          });

          liveRoom.on(RoomEvent.Disconnected, () => {
            cleanupVoice();
          });

          await liveRoom.connect(voicePayload.data.wsUrl, voicePayload.data.token);
          localAudioTrack = await createLocalAudioTrack(
            selectedDeviceId
              ? {
                  deviceId: selectedDeviceId
                }
              : undefined
          );
          await liveRoom.localParticipant.publishTrack(localAudioTrack);
          startMeter(localAudioTrack);

          setVoiceState("в голосовом канале", "live");
          renderParticipants();
        } catch (error) {
          console.error(error);
          cleanupVoice();
          setVoiceState(error?.message || "не удалось подключиться", "off");
        } finally {
          isConnecting = false;
          syncButtons();
        }
      });

      muteBtn.addEventListener("click", async () => {
        if (!localAudioTrack) return;

        isMuted = !isMuted;
        if (isMuted) {
          await localAudioTrack.mute();
        } else {
          await localAudioTrack.unmute();
        }
        renderParticipants();
        syncButtons();
      });

      leaveBtn.addEventListener("click", () => {
        cleanupVoice();
      });

      inputSelect.addEventListener("change", () => {
        selectedDeviceId = inputSelect.value;
      });

      refreshDevicesBtn.addEventListener("click", async () => {
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {}
        await loadDevices();
      });

      window.addEventListener("beforeunload", () => {
        cleanupVoice();
      });

      loadDevices().catch(() => {});
      renderParticipants();
      syncButtons();
    `,
    content: `
      <section class="hero-strip">
        <div class="eyebrow">Голосовая комната</div>
        <h1>${escapeHtml(room.name)}</h1>
        <p>${escapeHtml(room.topic)}</p>
      </section>
      <section class="toolbar">
        <div class="toolbar-copy">
          <h2># ${escapeHtml(room.id)}</h2>
          <p>${escapeHtml(kindLabel(room.kind))} канал. Выбери устройство и подключайся.</p>
        </div>
        <div class="actions">
          <a class="ghost-button" href="/settings">Настройки</a>
          <a class="ghost-button" href="/invite/mashenin-2026">Пригласить участника</a>
        </div>
      </section>
      <section class="voice-grid">
        <div class="voice-main">
          <section class="voice-console">
            <div class="voice-state">
              <div class="voice-indicator">
                <span class="voice-dot is-off" id="voice-dot"></span>
                <span id="voice-status">не подключен</span>
              </div>
              <div class="voice-actions">
                <button class="button" type="button" id="voice-join">Подключиться</button>
                <button class="ghost-button" type="button" id="voice-mute">Выключить микрофон</button>
                <button class="ghost-button" type="button" id="voice-leave">Отключиться</button>
              </div>
            </div>
            <div class="voice-controls">
              <div class="voice-device-row">
                <select class="select" id="input-device">
                  <option value="">Выбери микрофон</option>
                </select>
                <button class="ghost-button" type="button" id="refresh-devices">Обновить устройства</button>
              </div>
              <div class="voice-meter">
                <div class="meta" id="voice-meter-label">уровень микрофона: 0%</div>
                <div class="voice-meter-bar">
                  <div class="voice-meter-fill" id="voice-meter-fill"></div>
                </div>
              </div>
            </div>
          </section>
          <article class="panel-card">
            <div class="panel-header">
              <h2>Текстовый поток</h2>
            </div>
            <div class="message-scroller">
              ${
                messages.length
                  ? messages
                      .map(
                        (message) => `
                          <article class="message-card">
                            ${avatar(message.author)}
                            <div>
                              <div class="message-author">
                                <strong>${escapeHtml(message.author)}</strong>
                                <span class="message-time">${escapeHtml(formatDate(message.sentAt))}</span>
                              </div>
                              <p>${escapeHtml(message.text)}</p>
                            </div>
                          </article>
                        `
                      )
                      .join("")
                  : '<div class="empty">Сообщений пока нет.</div>'
              }
            </div>
            <form class="composer" method="POST" action="/room/${escapeHtml(room.id)}/message">
              <input class="field" type="text" name="body" placeholder="Сообщение в #${escapeHtml(room.id)}" />
              <button class="button" type="submit">Отправить</button>
            </form>
          </article>
        </div>
        <div class="voice-side">
          <article class="panel-card">
            <div class="panel-header">
              <h2>Участники</h2>
            </div>
            <div class="voice-participants" id="voice-participants">
              <div class="empty">Сначала подключись к голосовому каналу.</div>
            </div>
          </article>
          <section class="stats-grid">
            <article class="stat-card"><strong>${escapeHtml(room.members)}</strong><span class="label">в канале</span></article>
            <article class="stat-card"><strong>${escapeHtml(members.length)}</strong><span class="label">спикеров</span></article>
            <article class="stat-card"><strong>${escapeHtml(kindLabel(room.kind))}</strong><span class="label">режим</span></article>
            <article class="stat-card"><strong>${escapeHtml(messages.length)}</strong><span class="label">сообщений</span></article>
          </section>
          <article class="panel-card">
            <div class="panel-header">
              <h2>Сцена</h2>
            </div>
            <div class="member-list">
              ${
                members.length
                  ? members
                      .map(
                        (member) => `
                          <article class="member-card">
                            <div class="card-title">${escapeHtml(member.name)}</div>
                            <div class="meta">${escapeHtml(member.note)}</div>
                            <div class="status-pill" style="margin-top:8px;"><span class="status-dot status-${escapeHtml(member.status)}"></span>${escapeHtml(statusLabel(member.status))}</div>
                          </article>
                        `
                      )
                      .join("")
                  : '<div class="empty">Активных участников нет.</div>'
              }
            </div>
          </article>
        </div>
        <div id="voice-audio" hidden></div>
      </section>
    `
  });
}
