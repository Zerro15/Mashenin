function required(name, fallback = "") {
  return process.env[name] || fallback;
}

export function getConfig() {
  return {
    app: {
      env: process.env.NODE_ENV || "development"
    },
    data: {
      provider: process.env.DATA_PROVIDER || "file"
    },
    livekit: {
      apiKey: required("LIVEKIT_API_KEY", "devkey"),
      apiSecret: required("LIVEKIT_API_SECRET", "devsecret"),
      wsUrl: required("LIVEKIT_WS_URL", "ws://localhost:7880")
    },
    session: {
      ttlSeconds: Number(process.env.SESSION_TTL_SECONDS || 604800)
    },
    jwt: {
      secret: required("JWT_SECRET", "dev-jwt-secret-change-in-production")
    },
    postgres: {
      host: required("POSTGRES_HOST", "postgres"),
      port: Number(process.env.POSTGRES_PORT || 5432),
      database: required("POSTGRES_DB", "voice_club"),
      user: required("POSTGRES_USER", "voice_club"),
      password: required("POSTGRES_PASSWORD", "change_me")
    }
  };
}
