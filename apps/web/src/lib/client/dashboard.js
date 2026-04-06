export function dashboardScript() {
  return `
    const safe = (value) =>
      String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

    const format = (value) => {
      try {
        return new Intl.DateTimeFormat("ru-RU", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit"
        }).format(new Date(value));
      } catch {
        return value;
      }
    };

    const statusLabel = (status) => ({
      online: "онлайн",
      away: "нет на месте",
      in_voice: "в голосовом"
    }[status] || status);

    const renderAvatar = (name) => {
      const initial = String(name || "M").trim().charAt(0).toUpperCase() || "M";
      return '<div class="avatar">' + safe(initial) + '</div>';
    };

    const setProfileDrawer = (user) => {
      const drawerAvatar = document.querySelector("#profile-drawer-avatar");
      const drawerName = document.querySelector("#profile-drawer-name");
      const drawerStatus = document.querySelector("#profile-drawer-status");
      const drawerMetaStatus = document.querySelector("#profile-drawer-meta-status");
      const drawerMetaEmail = document.querySelector("#profile-drawer-meta-email");
      const drawerAbout = document.querySelector("#profile-drawer-about");

      if (!drawerAvatar || !drawerName || !drawerStatus || !drawerMetaStatus || !drawerMetaEmail || !drawerAbout) {
        return;
      }

      if (user) {
        drawerAvatar.innerHTML = renderAvatar(user.name || "U");
        drawerName.textContent = user.name || "Пользователь";
        drawerStatus.textContent = user.note || statusLabel(user.status) || "онлайн";
        drawerMetaStatus.textContent = statusLabel(user.status) || "онлайн";
        drawerMetaEmail.textContent = user.email || "не указан";
        drawerAbout.textContent = user.about || user.note || "Профиль готов. Можно открыть комнату и продолжить разговор.";
      } else {
        drawerAvatar.innerHTML = renderAvatar("G");
        drawerName.textContent = "Гость";
        drawerStatus.textContent = "ожидает вход";
        drawerMetaStatus.textContent = "гость";
        drawerMetaEmail.textContent = "пока нет";
        drawerAbout.textContent = "Войди или зарегистрируйся, чтобы сохранить имя, профиль и быстро возвращаться в разговор.";
      }
    };

    const bindSidebarProfile = () => {
      const userPanel = document.querySelector(".user-panel");
      const trigger = document.querySelector("#sidebar-user-trigger");

      if (!userPanel || !trigger || trigger.dataset.bound === "true") {
        return;
      }

      trigger.dataset.bound = "true";

      trigger.addEventListener("click", () => {
        const isOpen = userPanel.classList.toggle("is-open");
        trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });

      document.addEventListener("click", (event) => {
        if (!userPanel.contains(event.target)) {
          userPanel.classList.remove("is-open");
          trigger.setAttribute("aria-expanded", "false");
        }
      });
    };

    const memberRow = (name, note, status) =>
      '<div class="member-row">' +
        renderAvatar(name) +
        '<div class="member-text">' +
          '<strong>' + safe(name) + '</strong>' +
          '<span><span class="status-dot status-' + safe(status) + '"></span>' + safe(note) + '</span>' +
        '</div>' +
      '</div>';

    const renderSpotlight = ({ summary, rooms, friends, events, me }) => {
      const spotlight = document.querySelector("#spotlight");
      if (!spotlight) {
        return;
      }

      const user = me?.ok ? me.data : null;
      const roomList = rooms?.ok && Array.isArray(rooms.data) ? rooms.data.slice() : [];
      const friendList = friends?.ok && Array.isArray(friends.data) ? friends.data.slice() : [];
      const eventList = events?.ok && Array.isArray(events.data) ? events.data.slice() : [];
      const onlineFriends = friendList.filter((friend) => friend.status !== "away");
      const now = Date.now();

      const upcomingEvent = eventList
        .filter((event) => {
          const timestamp = new Date(event.startsAt).getTime();
          return Number.isFinite(timestamp) && timestamp >= now;
        })
        .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())[0] || null;

      const bestRoom = roomList
        .map((room) => {
          const memberCount = Number(room.members || 0);
          const sameRoomBonus = user?.roomId === room.id ? 4 : 0;
          const activeBonus = memberCount > 0 ? 8 : 0;
          const eventBonus = upcomingEvent?.roomId === room.id ? 3 : 0;
          const permanentBonus = room.kind === "permanent" ? 1 : 0;

          return {
            room,
            score: memberCount * 3 + sameRoomBonus + activeBonus + eventBonus + permanentBonus
          };
        })
        .sort((left, right) => right.score - left.score)[0]?.room || null;

      const freeToJoin = onlineFriends.filter((friend) => !friend.roomId);
      const cardHtml = [];

      if (!user) {
        cardHtml.push(
          '<article class="spotlight-card is-primary">' +
            '<div class="eyebrow">Следующий шаг</div>' +
            '<h2>Сначала зайди в пространство</h2>' +
            '<p>После входа главная покажет, где уже идет разговор и в какую комнату лучше прыгнуть сразу.</p>' +
            '<div class="spotlight-actions">' +
              '<a class="button" href="/register">Создать профиль</a>' +
              '<a class="ghost-button" href="/login">Войти</a>' +
            '</div>' +
          '</article>'
        );
      } else if (bestRoom) {
        const roomActionHref = user.roomId === bestRoom.id ? '/room/' + safe(bestRoom.id) : '/join/' + safe(bestRoom.id);
        const roomActionLabel = user.roomId === bestRoom.id ? 'Вернуться в комнату' : 'Зайти сейчас';
        const roomStatus = bestRoom.members > 0
          ? 'Сейчас там ' + safe(bestRoom.members) + ' участников, значит вход будет не в пустоту.'
          : 'Комната пока тихая, но это лучший старт для следующего разговора.';

        cardHtml.push(
          '<article class="spotlight-card is-primary">' +
            '<div class="eyebrow">Рекомендация</div>' +
            '<h2>#' + safe(bestRoom.id) + ' выглядит лучшей точкой входа</h2>' +
            '<p>' + safe(bestRoom.topic || bestRoom.name) + '</p>' +
            '<div class="spotlight-metrics">' +
              '<span class="tag">' + safe(bestRoom.kind === "temporary" ? "временная" : "постоянная") + '</span>' +
              '<span class="tag">' + safe(bestRoom.members) + ' в комнате</span>' +
            '</div>' +
            '<p class="section-note">' + roomStatus + '</p>' +
            '<div class="spotlight-actions">' +
              '<a class="button" href="' + roomActionHref + '">' + roomActionLabel + '</a>' +
              '<a class="ghost-button" href="/room/' + safe(bestRoom.id) + '">Открыть детали</a>' +
            '</div>' +
          '</article>'
        );
      }

      cardHtml.push(
        '<article class="spotlight-card">' +
          '<div class="eyebrow">Люди</div>' +
          '<h2>' + (onlineFriends.length
            ? 'Сейчас на связи ' + safe(onlineFriends.length) + ' человек'
            : 'Онлайн пока никого нет') + '</h2>' +
          '<p>' + (freeToJoin.length
            ? 'Свободны для нового разговора: ' + safe(freeToJoin.slice(0, 3).map((friend) => friend.name).join(", ")) + (freeToJoin.length > 3 ? ' и еще ' + safe(freeToJoin.length - 3) : '') + '.'
            : onlineFriends.length
              ? 'Все, кто онлайн, уже распределились по комнатам. Можно зайти туда, где уже есть движение.'
              : 'Можно запланировать созвон или зайти в комнату первым.') + '</p>' +
          '<div class="spotlight-actions">' +
            '<a class="ghost-button" href="/friends">Открыть участников</a>' +
          '</div>' +
        '</article>'
      );

      cardHtml.push(
        '<article class="spotlight-card">' +
          '<div class="eyebrow">События</div>' +
          '<h2>' + (upcomingEvent ? safe(upcomingEvent.title) : 'Ближайших событий пока нет') + '</h2>' +
          '<p>' + (upcomingEvent
            ? 'Старт ' + safe(format(upcomingEvent.startsAt)) + ' в #' + safe(upcomingEvent.roomId) + '. Уже идут: ' + safe(upcomingEvent.attendees) + '.'
            : 'Список событий пуст. Это хороший момент быстро создать следующий созвон или вечерний сбор.') + '</p>' +
          '<div class="spotlight-actions">' +
            '<a class="ghost-button" href="' + (upcomingEvent ? '/room/' + safe(upcomingEvent.roomId) : '/events') + '">' + (upcomingEvent ? 'Открыть комнату' : 'Открыть календарь') + '</a>' +
          '</div>' +
        '</article>'
      );

      if (!cardHtml.length) {
        cardHtml.push(
          '<article class="spotlight-card is-primary">' +
            '<div class="eyebrow">Сейчас</div>' +
            '<h2>Данные еще не загрузились</h2>' +
            '<p>Попробуй обновить страницу, если рекомендации не появились через пару секунд.</p>' +
          '</article>'
        );
      }

      spotlight.innerHTML = cardHtml.join("");
    };

    Promise.all([
      fetch("/summary").then((response) => response.json()).catch(() => ({ ok: false })),
      fetch("/data/rooms").then((response) => response.json()).catch(() => ({ ok: false })),
      fetch("/data/friends").then((response) => response.json()).catch(() => ({ ok: false })),
      fetch("/data/events").then((response) => response.json()).catch(() => ({ ok: false })),
      fetch("/me").then((response) => response.json()).catch(() => ({ ok: false }))
    ]).then(([summary, rooms, friends, events, me]) => {
      renderSpotlight({ summary, rooms, friends, events, me });

      if (summary.ok && summary.data && document.querySelector("#stats")) {
        const stats = [
          [summary.data.totalFriends, "участников"],
          [summary.data.onlineFriends, "в сети"],
          [summary.data.inVoiceFriends, "в голосе"],
          [summary.data.activeRooms, "активных комнат"]
        ];

        document.querySelector("#stats").innerHTML = stats
          .map(([value, label]) =>
            '<article class="stat-card"><strong>' + safe(value) + '</strong><span class="label">' + safe(label) + '</span></article>'
          )
          .join("");
      }

      if (rooms.ok && document.querySelector("#rooms")) {
        document.querySelector("#rooms").innerHTML = rooms.data.length
          ? rooms.data.map((room) =>
              '<a class="room-card" href="/room/' + safe(room.id) + '">' +
                '<div class="card-title"># ' + safe(room.id) + '</div>' +
                '<div class="meta">' + safe(room.name) + ' · ' + safe(room.topic) + '</div>' +
                '<div class="meta" style="margin-top:8px;">' + safe(room.members) + ' участников · ' + safe(room.kind === "temporary" ? "временный" : "постоянный") + '</div>' +
                '<div class="status-pill" style="margin-top:10px;"><span class="status-dot status-' + (room.members > 0 ? 'online' : 'away') + '"></span>' + (room.members > 0 ? 'сейчас можно заходить' : 'пока тихо') + '</div>' +
              '</a>'
            ).join("")
          : '<div class="empty">Пока нет комнат.</div>';
      }

      if (friends.ok) {
        const online = friends.data.filter((friend) => friend.status !== "away");

        if (document.querySelector("#friends")) {
          document.querySelector("#friends").innerHTML = friends.data.length
            ? friends.data.map((friend) =>
                '<article class="friend-card">' +
                  '<div class="card-title">' + safe(friend.name) + '</div>' +
                  '<div class="meta">' + safe(statusLabel(friend.status)) + ' · ' + safe(friend.note) + '</div>' +
                  '<div class="status-pill" style="margin-top:8px;"><span class="status-dot status-' + safe(friend.status) + '"></span>' + safe(friend.roomId || "не в комнате") + '</div>' +
                '</article>'
              ).join("")
            : '<div class="empty">Список участников пуст.</div>';
        }

        document.querySelector("#online-count").textContent = String(online.length);
        if (document.querySelector("#live-members")) {
          const preview = online.slice(0, 12).map((friend) => memberRow(friend.name, friend.note, friend.status)).join("");
          const remainder = online.length > 12
            ? '<div class="empty">И еще ' + safe(online.length - 12) + ' участников онлайн. Полный список открыт в разделе «Люди».</div>'
            : "";
          document.querySelector("#live-members").innerHTML = online.length
            ? preview + remainder
            : '<div class="empty">Никто не онлайн.</div>';
        }
      }

      if (events.ok) {
        if (document.querySelector("#events")) {
          document.querySelector("#events").innerHTML = events.data.length
            ? events.data.map((event) =>
                '<article class="event-card">' +
                  '<div class="card-title">' + safe(event.title) + '</div>' +
                  '<div class="meta">' + safe(format(event.startsAt)) + ' · #' + safe(event.roomId) + '</div>' +
                  '<div class="meta" style="margin-top:8px;">' + safe(event.attendees) + ' идут</div>' +
                '</article>'
              ).join("")
            : '<div class="empty">Сегодня пока ничего не запланировано.</div>';
        }

        document.querySelector("#today-events").innerHTML = events.data.length
          ? events.data.slice(0, 4).map((event) =>
              '<article class="event-card">' +
                '<div class="card-title">' + safe(event.title) + '</div>' +
                '<div class="meta">' + safe(format(event.startsAt)) + '</div>' +
              '</article>'
            ).join("")
          : '<div class="empty">На сегодня событий нет.</div>';
      }

      const guestSidebar = document.querySelector("#sidebar-user");
      const meCard = document.querySelector("#me-card");

      if (me.ok && me.data) {
        const heroGreeting = document.querySelector("#hero-greeting");
        const heroSubline = document.querySelector("#hero-subline");

        if (guestSidebar) {
          guestSidebar.innerHTML = renderAvatar(me.data.name) +
            '<div class="user-copy"><strong>' + safe(me.data.name) + '</strong><span>' + safe(statusLabel(me.data.status)) + '</span></div>';
        }

        if (meCard) {
          meCard.innerHTML = memberRow(me.data.name, me.data.note, me.data.status);
        }

        setProfileDrawer(me.data);

        if (heroGreeting) {
          heroGreeting.textContent = "Добро пожаловать, " + me.data.name;
        }

        if (heroSubline) {
          heroSubline.textContent = "Открой комнату и подключайся к разговору.";
        }
      } else {
        const heroGreeting = document.querySelector("#hero-greeting");
        const heroSubline = document.querySelector("#hero-subline");

        if (guestSidebar) {
          guestSidebar.innerHTML = renderAvatar("G") +
            '<div class="user-copy"><strong>Гость</strong><span>ожидает инвайт</span></div>';
        }

        if (meCard) {
          meCard.innerHTML = memberRow("Гость", "не авторизован", "away");
        }

        setProfileDrawer(null);

        if (heroGreeting) {
          heroGreeting.textContent = "Голосовые комнаты и текст в одном месте";
        }

        if (heroSubline) {
          heroSubline.textContent = "Войди или зарегистрируйся, затем открой комнату и подключись к голосу.";
        }
      }

      bindSidebarProfile();
    });
  `;
}
