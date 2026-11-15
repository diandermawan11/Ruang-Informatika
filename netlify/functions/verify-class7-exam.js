
const crypto = require("crypto");

const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_DURATION = 8 * 60 * 60 * 1000;

const CLASS_CONFIG = {
  Responsible: { jenjang: "SD", pinEnv: "PIN_SD_RESPONSIBLE" },
  Reliable: { jenjang: "SD", pinEnv: "PIN_SD_RELIABLE" },

  Obedient: { jenjang: "SMP", pinEnv: "PIN_SMP7" },
  Persistent: { jenjang: "SMP", pinEnv: "PIN_SMP7" },
  Supportive: { jenjang: "SMP", pinEnv: "PIN_SMP7" },
  Confident: { jenjang: "SMP", pinEnv: "PIN_SMP7" },

  Respectful: { jenjang: "SMP", pinEnv: "PIN_SMP8" },
  Reflective: { jenjang: "SMP", pinEnv: "PIN_SMP8" },
  Inspiring: { jenjang: "SMP", pinEnv: "PIN_SMP8" },

  Motivated: { jenjang: "SMA", pinEnv: "PIN_SMA10" },
  Courteous: { jenjang: "SMA", pinEnv: "PIN_SMA11" },
  Leader: { jenjang: "SMA", pinEnv: "PIN_SMA12" },

  Innovative: { jenjang: "SMK", pinEnv: "PIN_SMK10" },
  Industrious: { jenjang: "SMK", pinEnv: "PIN_SMK11" }
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

function clean(value, max) {
  return typeof value === "string"
    ? value.trim()
        .replace(/[<>\u0000-\u001f]/g, "")
        .slice(0, max)
    : "";
}

function safeEqual(first, second) {
  if (
    typeof first !== "string" ||
    typeof second !== "string"
  ) {
    return false;
  }

  const a = Buffer.from(first);
  const b = Buffer.from(second);

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

function createToken(session) {
  const payload = Buffer.from(
    JSON.stringify(session)
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return reply(405, {
      ok: false,
      message: "Metode tidak diizinkan."
    });
  }

  if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
    return reply(503, {
      ok: false,
      message: "Konfigurasi sesi belum lengkap."
    });
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : event.body || "{}";

  if (Buffer.byteLength(rawBody, "utf8") > 4096) {
    return reply(413, {
      ok: false,
      message: "Permintaan terlalu besar."
    });
  }

  let data;

  try {
    data = JSON.parse(rawBody);
  } catch {
    return reply(400, {
      ok: false,
      message: "Format data tidak valid."
    });
  }

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return reply(400, {
      ok: false,
      message: "Data login tidak valid."
    });
  }

  const name = clean(data.name, 100);
  const jenjang = clean(data.jenjang, 10).toUpperCase();
  const kelas = clean(data.kelas, 30);
  const password = data.password;

  if (
    !name ||
    !jenjang ||
    !kelas ||
    typeof password !== "string" ||
    !password
  ) {
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

  const now = Date.now();

  const session = {
    role: "siswa",
    name,
    jenjang,
    kelas,
    exp: now + SESSION_DURATION,
    iat: now
  };

  return reply(200, {
    ok: true,
    message: "Login siswa berhasil.",
    token: createToken(session),
    session,
    student: {
      name,
      jenjang,
      kelas
    }
  });
};
