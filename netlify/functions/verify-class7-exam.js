
const crypto = require("crypto");

const CLASS_CONFIG = {
  // SD kelas 6
  Responsible: {
    jenjang: "SD",
    grade: "6",
    pinEnv: "PIN_SD6"
  },
  Reliable: {
    jenjang: "SD",
    grade: "6",
    pinEnv: "PIN_SD6"
  },

  // SMP kelas 7
  Obedient: {
    jenjang: "SMP",
    grade: "7",
    pinEnv: "PIN_SMP7"
  },
  Persistent: {
    jenjang: "SMP",
    grade: "7",
    pinEnv: "PIN_SMP7"
  },
  Supportive: {
    jenjang: "SMP",
    grade: "7",
    pinEnv: "PIN_SMP7"
  },
  Confident: {
    jenjang: "SMP",
    grade: "7",
    pinEnv: "PIN_SMP7"
  },

  // SMP kelas 8
  Respectful: {
    jenjang: "SMP",
    grade: "8",
    pinEnv: "PIN_SMP8"
  },
  Reflective: {
    jenjang: "SMP",
    grade: "8",
    pinEnv: "PIN_SMP8"
  },
  Inspiring: {
    jenjang: "SMP",
    grade: "8",
    pinEnv: "PIN_SMP8"
  },

  // SMA
  Motivated: {
    jenjang: "SMA",
    grade: "10",
    pinEnv: "PIN_SMA10"
  },
  Courteous: {
    jenjang: "SMA",
    grade: "11",
    pinEnv: "PIN_SMA11"
  },
  Leader: {
    jenjang: "SMA",
    grade: "12",
    pinEnv: "PIN_SMA12"
  },

  // SMK
  Innovative: {
    jenjang: "SMK",
    grade: "10",
    pinEnv: "PIN_SMK10"
  },
  Industrious: {
    jenjang: "SMK",
    grade: "11",
    pinEnv: "PIN_SMK11"
  }
};

function reply(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function clean(value, max = 100) {
  return typeof value === "string"
    ? value
        .trim()
        .replace(/[<>\u0000-\u001f]/g, "")
        .slice(0, max)
    : "";
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const first = Buffer.from(a);
  const second = Buffer.from(b);

  if (first.length !== second.length) {
    return false;
  }

  return crypto.timingSafeEqual(first, second);
}

function createToken(session) {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET belum dikonfigurasi dengan benar."
    );
  }

  const payload = Buffer.from(
    JSON.stringify({
      ...session,
      exp: Date.now() + 12 * 60 * 60 * 1000
    })
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function readToken(event) {
  try {
    const headers = event.headers || {};

    const authorization =
      headers.authorization ||
      headers.Authorization ||
      "";

    if (!authorization.startsWith("Bearer ")) {
      return null;
    }

    const token = authorization.slice(7);
    const parts = token.split(".");

    if (parts.length !== 2) {
      return null;
    }

    const secret = process.env.SESSION_SECRET;

    if (!secret || secret.length < 32) {
      return null;
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(parts[0])
      .digest("base64url");

    if (!safeEqual(expectedSignature, parts[1])) {
      return null;
    }

    const session = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf8")
    );

    if (
      !session.exp ||
      session.exp < Date.now() ||
      !["guru", "siswa"].includes(session.role)
    ) {
      return null;
    }

    return session;

  } catch (error) {
    console.error("Pemeriksaan token gagal:", error);
    return null;
  }
}

exports.handler = async (event) => {

  // Memeriksa sesi dashboard
  if (event.httpMethod === "GET") {
    const session = readToken(event);

    if (!session) {
      return reply(401, {
        ok: false,
        message: "Sesi tidak valid atau telah berakhir."
      });
    }

    return reply(200, {
      ok: true,
      session
    });
  }

  if (event.httpMethod !== "POST") {
    return reply(405, {
      ok: false,
      message: "Metode tidak diizinkan."
    });
  }

  let data;

  try {
    data = JSON.parse(event.body || "{}");
  } catch {
    return reply(400, {
      ok: false,
      message: "Data login tidak valid."
    });
  }

  let session;

  // ==========================================
  // LOGIN GURU: SATU PASSWORD UNTUK DASHBOARD
  // ==========================================

  if (data.role === "guru") {
    const password = data.password;
    const expectedPassword = process.env.TEACHER_PASSWORD;

    if (!expectedPassword) {
      return reply(503, {
        ok: false,
        message: "Password guru belum dikonfigurasi di Netlify."
      });
    }

    if (!safeEqual(password, expectedPassword)) {
      return reply(401, {
        ok: false,
        message: "Password guru salah."
      });
    }

    session = {
      role: "guru",
      name: "Guru"
    };

  } else {

    // ==========================================
    // LOGIN SISWA
    // ==========================================

    const name = clean(data.name, 100);
    const jenjang = clean(data.jenjang, 10).toUpperCase();
    const kelas = clean(data.kelas, 40);
    const password = data.password;

    if (!name || !jenjang || !kelas || !password) {
      return reply(400, {
        ok: false,
        message: "Nama, jenjang, kelas, dan PIN wajib diisi."
      });
    }

    const config = CLASS_CONFIG[kelas];

    if (!config || config.jenjang !== jenjang) {
      return reply(400, {
        ok: false,
        message: "Jenjang atau kelas tidak valid."
      });
    }

    const expectedPin = process.env[config.pinEnv];

    if (!expectedPin) {
      return reply(503, {
        ok: false,
        message: "PIN kelas belum dikonfigurasi."
      });
    }

    if (!safeEqual(password, expectedPin)) {
      return reply(401, {
        ok: false,
        message: "PIN yang Anda masukkan salah."
      });
    }

    session = {
      role: "siswa",
      name,
      jenjang,
      grade: config.grade,
      kelas
    };
  }

  // ==========================================
  // MEMBUAT TOKEN SESI
  // ==========================================

  try {
    const token = createToken(session);

    return reply(200, {
      ok: true,
      message: "Login berhasil.",
      token,
      session
    });

  } catch (error) {
    console.error("Pembuatan sesi gagal:", error);

    return reply(503, {
      ok: false,
      message: error.message
    });
  }
};
