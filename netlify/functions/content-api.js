
const crypto = require("crypto");

const SHEETS_WEB_APP_URL = process.env.SHEETS_WEB_APP_URL;
const CONTENT_API_SECRET = process.env.CONTENT_API_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;

const TEACHER_ACTIONS = new Set([
  "listContent",
  "createMaterial",
  "updateMaterial",
  "deleteMaterial",
  "createQuiz",
  "updateQuiz",
  "deleteQuiz",
  "createAssignment",
  "updateAssignment",
  "deleteAssignment",
  "listSubmissions",
  "gradeSubmission",
  "listResults"
]);

const STUDENT_ACTIONS = new Set([
  "listContent",
  "submitQuiz",
  "submitAssignment",
  "listResults"
]);

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

function verifySession(event) {
  if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET belum dikonfigurasi.");
  }

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

  const expectedSignature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(parts[0])
    .digest("base64url");

  if (!safeEqual(expectedSignature, parts[1])) {
    return null;
  }

  try {
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

    if (
      session.role === "siswa" &&
      (
        !session.name ||
        !session.jenjang ||
        !session.kelas
      )
    ) {
      return null;
    }

    return session;

  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return reply(405, {
      ok: false,
      message: "Metode tidak diizinkan."
    });
  }

  if (!SHEETS_WEB_APP_URL || !CONTENT_API_SECRET) {
    return reply(503, {
      ok: false,
      message: "Konfigurasi penyimpanan belum lengkap."
    });
  }

  if (
    !SESSION_SECRET ||
    SESSION_SECRET.length < 32
  ) {
    return reply(503, {
      ok: false,
      message: "Konfigurasi sesi belum lengkap."
    });
  }

  const session = verifySession(event);

  if (!session) {
    return reply(401, {
      ok: false,
      message: "Sesi login tidak valid. Silakan login kembali."
    });
  }

  let data;

  try {
    data = JSON.parse(event.body || "{}");
  } catch {
    return reply(400, {
      ok: false,
      message: "Format permintaan tidak valid."
    });
  }

  const action = data.action;

  const allowedActions = session.role === "guru"
    ? TEACHER_ACTIONS
    : STUDENT_ACTIONS;

  if (!allowedActions.has(action)) {
    return reply(403, {
      ok: false,
      message: "Anda tidak memiliki izin untuk tindakan ini."
    });
  }

  // Batasi ukuran permintaan agar upload tidak melebihi
  // batas aman Netlify Functions.
  const requestSize = Buffer.byteLength(
    event.body || "",
    "utf8"
  );

  if (requestSize > 5.5 * 1024 * 1024) {
    return reply(413, {
      ok: false,
      message: "Ukuran permintaan terlalu besar. Maksimal upload file 4 MB."
    });
  }

  // Identitas siswa selalu berasal dari token server,
  // bukan dari data yang dikirim browser.
  const payload = {
    ...data,
    action,
    session,
    apiSecret: CONTENT_API_SECRET
  };

  try {
    const response = await fetch(SHEETS_WEB_APP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      redirect: "follow"
    });

    const responseText = await response.text();

    let result;

    try {
      result = JSON.parse(responseText);
    } catch {
      console.error(
        "Respons Google Apps Script tidak valid:",
        responseText.slice(0, 500)
      );

      throw new Error(
        "Respons penyimpanan tidak dapat dibaca."
      );
    }

    if (!response.ok || !result.ok) {
      return reply(
        response.ok ? 400 : 502,
        {
          ok: false,
          message: result.message ||
            "Penyimpanan data gagal."
        }
      );
    }

    return reply(200, result);

  } catch (error) {
    console.error("Content API error:", error);

    return reply(502, {
      ok: false,
      message:
        error.message ||
        "Server gagal menghubungi Google Sheets."
    });
  }
};

