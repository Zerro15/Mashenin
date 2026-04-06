export function getBaseStyles() {
  return `
    :root {
      --app-bg: #111315;
      --server-rail: #0b0c0d;
      --channels-bg: #151719;
      --main-bg: #181b1e;
      --members-bg: #151719;
      --surface: #1d2023;
      --surface-2: #23272b;
      --surface-3: #2b3136;
      --surface-4: #0f1113;
      --accent: #c8d1dc;
      --accent-soft: rgba(200, 209, 220, 0.12);
      --accent-2: #8f9baa;
      --text: #f3f5f7;
      --text-soft: #d7dce2;
      --muted: #96a0aa;
      --muted-2: #6e7781;
      --line: rgba(255, 255, 255, 0.06);
      --green: #3ba66b;
      --yellow: #c89a3d;
      --red: #cf6464;
      --shadow: 0 18px 40px rgba(0, 0, 0, 0.24);
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      min-height: 100%;
      background: var(--app-bg);
      color: var(--text);
      font-family: "gg sans", "Noto Sans", "Segoe UI", sans-serif;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    button, input, select {
      font: inherit;
    }

    body {
      background: var(--app-bg);
    }

    .app-shell {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 72px 280px minmax(0, 1fr) 240px;
    }

    .server-rail {
      background: var(--server-rail);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
    }

    .server-home {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      font-size: 18px;
      font-weight: 800;
      background: #20242a;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: none;
    }

    .server-divider {
      width: 34px;
      height: 2px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
    }

    .server-list {
      width: 100%;
      display: grid;
      gap: 8px;
      justify-items: center;
    }

    .server-pill {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: rgba(255, 255, 255, 0.03);
      color: var(--muted);
      transition: 180ms ease;
      position: relative;
      font-size: 11px;
      text-align: center;
      padding: 4px;
      line-height: 1.05;
    }

    .server-pill:hover,
    .server-pill.is-active {
      border-radius: 10px;
      background: #232830;
      color: var(--text);
      transform: none;
    }

    .server-pill.is-create {
      border: 1px dashed rgba(255, 255, 255, 0.18);
      background: rgba(255, 255, 255, 0.02);
      color: var(--text-soft);
      font-size: 24px;
      font-weight: 300;
      line-height: 1;
    }

    .server-pill.is-create:hover,
    .server-pill.is-create.is-active {
      border-style: solid;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text);
    }

    .channels-panel,
    .members-panel {
      background: var(--channels-bg);
      min-width: 0;
    }

    .channels-panel {
      display: grid;
      grid-template-rows: auto 1fr auto;
      border-right: 1px solid rgba(0, 0, 0, 0.24);
    }

    .guild-header,
    .channel-header {
      min-height: 48px;
      display: flex;
      align-items: center;
      padding: 0 16px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.24);
      box-shadow: 0 1px 0 rgba(255, 255, 255, 0.02);
    }

    .guild-header {
      justify-content: space-between;
      font-weight: 700;
    }

    .guild-caret,
    .channel-tools {
      color: var(--muted-2);
      font-size: 13px;
    }

    .channels-scroll,
    .members-scroll {
      overflow: auto;
      padding: 12px 8px 16px;
    }

    .promo-card {
      margin: 0 8px 16px;
      padding: 16px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--line);
      box-shadow: none;
    }

    .promo-card strong {
      display: block;
      margin-bottom: 6px;
      font-size: 15px;
    }

    .promo-card p {
      margin: 0;
      color: rgba(255, 255, 255, 0.82);
      font-size: 13px;
      line-height: 1.4;
    }

    .category {
      margin-bottom: 16px;
    }

    .category-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 0 8px 6px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-size: 12px;
      font-weight: 700;
    }

    .category-title span:last-child {
      color: var(--muted-2);
    }

    .channel-link {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 34px;
      padding: 0 10px;
      border-radius: 8px;
      color: var(--muted);
      margin: 2px 0;
      transition: 120ms ease;
    }

    .channel-link:hover {
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-soft);
    }

    .channel-link.is-active {
      background: rgba(255, 255, 255, 0.12);
      color: var(--text);
    }

    .channel-icon {
      color: var(--muted-2);
      font-weight: 700;
      min-width: 16px;
    }

    .channel-copy {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .channel-copy strong {
      font-size: 15px;
      font-weight: 500;
    }

    .channel-copy span {
      font-size: 12px;
      color: var(--muted-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-panel {
      min-height: 52px;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: center;
      padding: 8px;
      background: #232428;
      border-top: 1px solid rgba(255, 255, 255, 0.02);
      position: relative;
    }

    .user-card {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      padding: 6px;
      border-radius: 8px;
      cursor: pointer;
      border: 0;
      background: transparent;
      color: inherit;
      text-align: left;
      width: 100%;
    }

    .user-card:hover {
      background: rgba(255, 255, 255, 0.06);
    }

    .user-trigger {
      justify-content: space-between;
    }

    .user-trigger-main {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .user-chevron {
      color: var(--muted-2);
      font-size: 12px;
      transition: transform 140ms ease;
    }

    .user-panel.is-open .user-chevron {
      transform: rotate(180deg);
    }

    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #7783ff, #5865f2);
      color: white;
      font-size: 13px;
      font-weight: 700;
      flex: 0 0 auto;
    }

    .user-copy {
      min-width: 0;
    }

    .user-copy strong,
    .member-row strong,
    .message-author strong,
    .card-title {
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-copy span {
      display: block;
      color: var(--muted-2);
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-actions {
      display: grid;
      grid-auto-flow: column;
      gap: 6px;
    }

    .user-action-link {
      min-height: 32px;
      padding: 0 10px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--muted);
      background: transparent;
      border: 1px solid transparent;
      font-size: 12px;
      line-height: 1;
    }

    .user-action-link:hover {
      color: var(--text);
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.08);
    }

    .profile-drawer {
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: calc(100% + 8px);
      padding: 0;
      border-radius: 16px;
      border: 1px solid var(--line);
      background: rgba(18, 20, 22, 0.98);
      box-shadow: var(--shadow);
      display: none;
      gap: 0;
      z-index: 5;
      overflow: hidden;
    }

    .user-panel.is-open .profile-drawer {
      display: grid;
    }

    .profile-drawer-banner {
      min-height: 78px;
      background: linear-gradient(180deg, #23272c, #1b1e22);
    }

    .profile-drawer-body {
      display: grid;
      gap: 14px;
      padding: 16px;
      margin-top: -20px;
    }

    .profile-drawer-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .profile-drawer-header .avatar {
      width: 56px;
      height: 56px;
      font-size: 20px;
      border: 4px solid rgba(27, 24, 31, 0.98);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
    }

    .profile-drawer-copy {
      min-width: 0;
      display: grid;
      gap: 4px;
    }

    .profile-drawer-copy strong {
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .profile-drawer-copy span {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
    }

    .profile-drawer-about {
      color: var(--text-soft);
      font-size: 13px;
      line-height: 1.5;
      padding: 10px 12px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.02);
    }

    .profile-meta-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .profile-meta-card {
      padding: 12px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.04);
    }

    .profile-meta-card strong {
      display: block;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted-2);
      margin-bottom: 6px;
    }

    .profile-meta-card span {
      color: var(--text-soft);
      font-size: 13px;
      line-height: 1.4;
      display: block;
      word-break: break-word;
    }

    .profile-drawer-actions {
      display: grid;
      gap: 8px;
    }

    .profile-link {
      min-height: 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 0 12px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.03);
      color: var(--text-soft);
    }

    .profile-link:hover {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text);
    }

    .main-panel {
      display: grid;
      grid-template-rows: auto 1fr;
      min-width: 0;
      background: var(--main-bg);
    }

    .channel-header {
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 2;
      background: rgba(17, 19, 21, 0.96);
      backdrop-filter: blur(10px);
    }

    .channel-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .channel-name {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      min-width: 0;
    }

    .channel-name .channel-icon {
      font-size: 19px;
    }

    .header-topic {
      color: var(--muted);
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .channel-body {
      padding: 24px;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 18px;
      overflow: auto;
    }

    .hero-strip {
      padding: 24px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--line);
      box-shadow: none;
    }

    .eyebrow {
      margin: 0 0 6px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 11px;
      font-weight: 700;
    }

    h1, h2, h3, p {
      margin: 0;
    }

    .hero-strip h1 {
      font-size: 30px;
      line-height: 1.1;
      margin-bottom: 8px;
    }

    .hero-strip p {
      max-width: 72ch;
      color: var(--text-soft);
      line-height: 1.5;
    }

    .toolbar {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }

    .toolbar-copy p {
      color: var(--muted);
      margin-top: 6px;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .button,
    .ghost-button {
      min-height: 40px;
      border-radius: 10px;
      padding: 0 14px;
      border: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-weight: 500;
    }

    .button {
      background: #e7edf5;
      color: #101316;
    }

    .button:hover {
      background: #f3f6fa;
    }

    .ghost-button {
      background: rgba(255, 255, 255, 0.03);
      color: var(--text);
      border: 1px solid rgba(255, 244, 230, 0.08);
    }

    .ghost-button:hover {
      background: rgba(255, 255, 255, 0.12);
    }

    .stats-grid,
    .card-grid {
      display: grid;
      gap: 16px;
    }

    .stats-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .card-grid.two {
      grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.85fr);
    }

    .card-grid.admin {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .stat-card,
    .panel-card,
    .message-card,
    .member-card,
    .event-card,
    .room-card,
    .friend-card,
    .admin-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.02);
      box-shadow: none;
    }

    .stat-card,
    .panel-card,
    .member-card,
    .event-card,
    .room-card,
    .friend-card,
    .admin-card {
      padding: 16px;
    }

    .stat-card strong {
      display: block;
      font-size: 28px;
      margin-bottom: 4px;
    }

    .label,
    .meta {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }

    .panel-card {
      padding: 18px;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }

    .panel-header h2 {
      font-size: 18px;
    }

    .tag {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 0 10px;
      border-radius: 999px;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.06);
      font-size: 12px;
    }

    .hero-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 14px;
      align-items: stretch;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }

    .focus-card {
      border-radius: 10px;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.02);
      padding: 16px;
      display: grid;
      gap: 10px;
      box-shadow: none;
    }

    .focus-card strong {
      display: block;
      font-size: 15px;
      margin-bottom: 4px;
    }

    .check-list,
    .feature-list {
      display: grid;
      gap: 10px;
    }

    .check-item,
    .feature-item {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      color: var(--text-soft);
      line-height: 1.45;
    }

    .check-mark,
    .feature-mark {
      width: 24px;
      height: 24px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      font-size: 12px;
      font-weight: 700;
    }

    .check-mark {
      background: rgba(59, 166, 107, 0.12);
      color: #a9d7bb;
    }

    .feature-mark {
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-soft);
    }

    .spotlight-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }

    .spotlight-card {
      display: grid;
      gap: 12px;
      padding: 18px;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.02));
    }

    .spotlight-card.is-primary {
      background:
        radial-gradient(circle at top right, rgba(88, 101, 242, 0.14), transparent 32%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
    }

    .spotlight-card h2 {
      font-size: 22px;
      line-height: 1.15;
    }

    .spotlight-card p {
      color: var(--text-soft);
      line-height: 1.55;
    }

    .spotlight-actions,
    .spotlight-metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .section-note {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }

    .auth-tabs {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      padding: 6px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid var(--line);
      width: 100%;
    }

    .auth-tab {
      min-height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      color: var(--muted);
      font-weight: 600;
    }

    .auth-tab.is-active {
      background: #2b2f38;
      color: var(--text);
    }

    .room-list,
    .friend-list,
    .event-list,
    .member-list,
    .message-list {
      display: grid;
      gap: 10px;
    }

    .room-card,
    .friend-card {
      display: block;
    }

    .room-card:hover,
    .friend-card:hover,
    .event-card:hover,
    .member-card:hover {
      background: rgba(255, 255, 255, 0.06);
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--muted);
    }

    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex: 0 0 auto;
    }

    .status-online { background: var(--green); }
    .status-away { background: var(--yellow); }
    .status-in_voice { background: var(--accent); }

    .message-scroller {
      display: grid;
      gap: 2px;
    }

    .voice-console {
      display: grid;
      gap: 14px;
      padding: 20px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.02);
    }

    .voice-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
      gap: 16px;
    }

    .voice-main,
    .voice-side {
      display: grid;
      gap: 14px;
    }

    .voice-side .panel-card,
    .voice-main .panel-card,
    .voice-side .voice-console,
    .voice-main .voice-console {
      height: fit-content;
    }

    .voice-state {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .voice-indicator {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--text-soft);
      font-size: 14px;
    }

    .voice-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--yellow);
    }

    .voice-dot.is-live {
      background: var(--green);
    }

    .voice-dot.is-off {
      background: var(--red);
    }

    .voice-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .voice-controls {
      display: grid;
      gap: 12px;
    }

    .voice-device-row {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) auto;
      gap: 10px;
      align-items: center;
    }

    .voice-meter {
      display: grid;
      gap: 8px;
    }

    .voice-meter-bar {
      height: 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      overflow: hidden;
    }

    .voice-meter-fill {
      width: 0%;
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #23a559, #f0b232);
      transition: width 100ms linear;
    }

    .voice-participants {
      display: grid;
      gap: 10px;
    }

    .voice-participant {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid var(--line);
    }

    .voice-participant-meta {
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .voice-badge {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 0 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.06);
      color: var(--muted);
      font-size: 12px;
    }

    .voice-badge.is-speaking {
      background: rgba(59, 166, 107, 0.14);
      color: #b8ddc6;
    }

    .message-card {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr);
      gap: 12px;
      padding: 12px 14px;
      background: transparent;
      border-color: transparent;
      border-radius: 6px;
    }

    .message-card:hover {
      background: rgba(4, 4, 5, 0.07);
    }

    .message-author {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 4px;
      min-width: 0;
    }

    .message-time {
      color: var(--muted-2);
      font-size: 12px;
    }

    .message-card p {
      color: var(--text-soft);
      line-height: 1.45;
      word-break: break-word;
    }

    .composer {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      padding: 10px;
      border-radius: 12px;
      background: #1d2024;
      margin-top: 8px;
    }

    .field,
    .select {
      width: 100%;
      min-height: 44px;
      border: 0;
      outline: none;
      border-radius: 6px;
      padding: 0 12px;
      background: #121416;
      color: var(--text);
    }

    .stack {
      display: grid;
      gap: 12px;
    }

    .split {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .empty {
      padding: 16px;
      border-radius: 8px;
      border: 1px dashed rgba(255, 255, 255, 0.12);
      color: var(--muted);
      background: rgba(255, 255, 255, 0.02);
    }

    .settings-shell {
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr);
      gap: 18px;
      align-items: start;
    }

    .settings-nav {
      display: grid;
      gap: 8px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.02);
      position: sticky;
      top: 72px;
    }

    .settings-nav-title {
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted-2);
      padding: 2px 4px 8px;
    }

    .settings-nav-link {
      min-height: 38px;
      display: flex;
      align-items: center;
      padding: 0 10px;
      border-radius: 8px;
      color: var(--muted);
      background: transparent;
    }

    .settings-nav-link.is-active,
    .settings-nav-link:hover {
      background: rgba(255, 255, 255, 0.04);
      color: var(--text);
    }

    .settings-main {
      display: grid;
      gap: 16px;
    }

    .settings-section {
      display: grid;
      gap: 14px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.02);
    }

    .settings-section-head {
      display: grid;
      gap: 4px;
    }

    .settings-section-head h2 {
      font-size: 18px;
      margin: 0;
    }

    .settings-section-head p {
      color: var(--muted);
      line-height: 1.45;
    }

    .settings-compact-stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .members-panel {
      display: grid;
      grid-template-rows: auto 1fr;
      border-left: 1px solid rgba(0, 0, 0, 0.24);
    }

    .members-title {
      padding: 16px 16px 8px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 12px;
      font-weight: 700;
    }

    .member-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 8px;
      border-radius: 8px;
    }

    .member-row:hover {
      background: rgba(255, 255, 255, 0.06);
    }

    .member-text {
      min-width: 0;
    }

    .member-text span {
      display: block;
      color: var(--muted-2);
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .invite-shell {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at top left, rgba(88, 101, 242, 0.2), transparent 22%),
        #313338;
    }

    .invite-card {
      width: min(980px, 100%);
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
      overflow: hidden;
      border-radius: 18px;
      background: #1e1f22;
      border: 1px solid var(--line);
      box-shadow: var(--shadow);
    }

    .invite-side,
    .invite-form {
      padding: 32px;
    }

    .invite-side {
      background:
        radial-gradient(circle at top left, rgba(88, 101, 242, 0.34), transparent 34%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0));
    }

    .invite-copy {
      max-width: 48ch;
      margin-top: 10px;
      color: var(--text-soft);
      line-height: 1.55;
    }

    .kpis {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 18px;
    }

    .helper {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }

    .form-grid {
      display: grid;
      gap: 14px;
      margin-top: 18px;
    }

    .auth-shell {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at top center, rgba(88, 101, 242, 0.14), transparent 24%),
        radial-gradient(circle at bottom left, rgba(255, 122, 89, 0.08), transparent 22%),
        #17181c;
    }

    .auth-window {
      width: min(460px, 100%);
      display: grid;
      gap: 20px;
      padding: 28px;
      border-radius: 20px;
      background: #111216;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
    }

    .auth-brand {
      display: grid;
      gap: 8px;
    }

    .auth-brand strong {
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .auth-brand h1 {
      margin: 0;
      font-size: 30px;
      line-height: 1.05;
    }

    .auth-brand p {
      margin: 0;
      color: var(--muted);
      line-height: 1.5;
    }

    .auth-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      color: var(--muted-2);
      font-size: 12px;
    }

    .auth-meta a {
      color: var(--text-soft);
    }

    @media (max-width: 1180px) {
      .app-shell {
        grid-template-columns: 72px 260px minmax(0, 1fr);
      }

      .members-panel {
        display: none;
      }
    }

    @media (max-width: 920px) {
      .app-shell {
        grid-template-columns: 1fr;
      }

      .server-rail,
      .channels-panel,
      .members-panel {
        display: none;
      }

      .channel-body {
        padding: 16px;
      }

      .stats-grid,
      .hero-grid,
      .spotlight-grid,
      .card-grid.two,
      .card-grid.admin,
      .voice-grid,
      .settings-shell,
      .split,
      .invite-card,
      .kpis {
        grid-template-columns: 1fr;
      }

      .toolbar,
      .channel-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .composer {
        grid-template-columns: 1fr;
      }

      .profile-meta-grid {
        grid-template-columns: 1fr;
      }

      .settings-nav {
        position: static;
      }

      .auth-window {
        padding: 22px;
      }
    }
  `;
}
