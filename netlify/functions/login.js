const crypto = require("crypto");

const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_DURATION = 12 * 60 * 60 * 1000;

const CLASS_CONFIG = {
  // SD kelas 6
  Responsible: { jenjang: "SD", pinEnv: "PIN_SD6" },
  Reliable:    { jenjang: "SD", pinEnv: "PIN_SD6" },

  // SMP
  Obedient:    { jenjang: "SMP", pinEnv: "PIN_SMP7" },
  Persistent:  { jenjang: "SMP", pinEnv: "PIN_SMP7" },
  Supportive:  { jenjang: "SMP", pinEnv: "PIN_SMP7" },
  Confident:   { jenjang: "SMP", pinEnv: "PIN_SMP7" },

  Respectful:  { jenjang: "SMP", pinEnv: "PIN_SMP8" },
  Reflective:  { jenjang: "SMP", pinEnv: "PIN_SMP8" },
  Inspiring:   { jenjang: "SMP", pinEnv: "PIN_SMP8" },

  // SMA
  Motivated:   { jenjang: "SMA", pinEnv: "PIN_SMA10" },
  Courteous:   { jenjang: "SMA", pinEnv: "PIN_SMA11" },
  Leader:      { jenjang: "SMA", pinEnv: "PIN_SMA12" },

  // SMK
  Innovative:  { jenjang: "SMK", pinEnv: "PIN_SMK10" },
  Industrious: { jenjang: "SMK", pinEnv: "PIN_SMK11" }
};

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
      message: "SESSION_SECRET belum dikonfigurasi."
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

  const role = clean(data.role, 10);

  let session;

  // =====================================
  // LOGIN GURU
  // =====================================

  if (role === "guru") {
    const username = clean(data.username, 80);
    const password = data.password;

    const expectedUsername = process.env.TEACHER_USERNAME;
    const expectedPassword = process.env.TEACHER_PASSWORD;

    if (!expectedUsername || !expectedPassword) {
      return reply(503, {
        ok: false,
        message: "Akun guru belum dikonfigurasi."
      });
    }

    if (
      !safeEqual(username, expectedUsername) ||
      !safeEqual(password, expectedPassword)
    ) {
      return reply(401, {
        ok: false,
        message: "Nama pengguna atau kata sandi guru salah."
      });
    }

    session = {
      role: "guru",
      name: clean(
        process.env.TEACHER_NAME || username,
        100
      ),
      exp: Date.now() + SESSION_DURATION
    };

  // =====================================
  // LOGIN SISWA
  // =====================================

  } else if (role === "siswa") {
    const name = clean(data.name, 100);
    const jenjang = clean(data.jenjang, 10).toUpperCase();
    const kelas = clean(data.kelas, 30);
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
        message: "Jenjang atau kelas tidak sesuai."
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
        message: "PIN kelas yang dimasukkan salah."
      });
    }

    session = {
      role: "siswa",
      name,
      jenjang,
      kelas,
      exp: Date.now() + SESSION_DURATION
    };

  } else {
    return reply(400, {
      ok: false,
      message: "Jenis akun tidak valid."
    });
  }

  // =====================================
  // MEMBUAT TOKEN SESI
  // =====================================

  const payload = Buffer
    .from(JSON.stringify(session))
    .toString("base64url");

  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");

  const token = `${payload}.${signature}`;

  return reply(200, {
    ok: true,
    message: "Login berhasil.",
    token,
    session
  });
};

// =====================================
// UTILITAS
// =====================================

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
