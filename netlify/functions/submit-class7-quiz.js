
const SHEETS_WEB_APP_URL = process.env.SHEETS_WEB_APP_URL;
const CONTENT_API_SECRET = process.env.CONTENT_API_SECRET;

const ANSWER_KEY = [
  'B', 'C', 'D', 'E', 'A',
  'C', 'B', 'D', 'A', 'E',
  'B', 'C', 'D', 'E', 'A',
  'C', 'B', 'D', 'E', 'A'
];

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

const CLASS_CONFIG = {
  Responsible:  { jenjang: 'SD', pin: 'PIN_SD6' },
  Reliable:     { jenjang: 'SD', pin: 'PIN_SD6' },

  Obedient:     { jenjang: 'SMP', pin: 'PIN_SMP7' },
  Persistent:   { jenjang: 'SMP', pin: 'PIN_SMP7' },
  Supportive:   { jenjang: 'SMP', pin: 'PIN_SMP7' },
  Confident:    { jenjang: 'SMP', pin: 'PIN_SMP7' },

  Respectful:   { jenjang: 'SMP', pin: 'PIN_SMP8' },
  Reflective:   { jenjang: 'SMP', pin: 'PIN_SMP8' },
  Inspiring:    { jenjang: 'SMP', pin: 'PIN_SMP8' },

  Motivated:    { jenjang: 'SMA', pin: 'PIN_SMA10' },
  Courteous:    { jenjang: 'SMA', pin: 'PIN_SMA11' },
  Leader:       { jenjang: 'SMA', pin: 'PIN_SMA12' },

  Innovative:   { jenjang: 'SMK', pin: 'PIN_SMK10' },
  Industrious:  { jenjang: 'SMK', pin: 'PIN_SMK11' }
};

exports.handler = async (event) => {

  if (event.httpMethod !== 'POST') {
    return reply(405, {
      ok: false,
      message: 'Metode tidak diizinkan.'
    });
  }

  let data;

  try {
    data = JSON.parse(event.body || '{}');
  } catch {
    return reply(400, {
      ok: false,
      message: 'Data jawaban tidak valid.'
    });
  }

  const nama = clean(data.name, 100);
  const jenjang = clean(data.jenjang, 10).toUpperCase();
  const kelas = clean(data.kelas, 30);
  const password = data.password;

  if (!nama || !jenjang || !kelas) {
    return reply(400, {
      ok: false,
      message: 'Nama, jenjang, dan kelas wajib diisi.'
    });
  }

  // VALIDASI KELAS

  const config = CLASS_CONFIG[kelas];

  if (!config || config.jenjang !== jenjang) {
    return reply(400, {
      ok: false,
      message: 'Jenjang atau kelas tidak valid.'
    });
  }

  // VALIDASI PIN

  const expectedPin = process.env[config.pin];

  if (!expectedPin) {
    return reply(503, {
      ok: false,
      message: 'PIN kelas belum dikonfigurasi oleh guru.'
    });
  }

  if (
    typeof password !== 'string' ||
    password !== expectedPin
  ) {
    return reply(401, {
      ok: false,
      message: 'PIN ujian tidak valid.'
    });
  }

  // VALIDASI JAWABAN

  if (
    !data.answers ||
    typeof data.answers !== 'object' ||
    Array.isArray(data.answers)
  ) {
    return reply(400, {
      ok: false,
      message: 'Jawaban tidak ditemukan.'
    });
  }

  const answers = ANSWER_KEY.map((_, i) => {
    const raw = data.answers[i];

    if (
      raw === null ||
      raw === undefined ||
      raw === ''
    ) {
      return '';
    }

    const value =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
          ? Number(raw)
          : NaN;

    return Number.isInteger(value) &&
      value >= 0 &&
      value < LETTERS.length
        ? LETTERS[value]
        : '';
  });

  // HITUNG NILAI

  let benar = 0;
  let salah = 0;
  let kosong = 0;

  ANSWER_KEY.forEach((key, i) => {
    if (!answers[i]) {
      kosong++;
    } else if (answers[i] === key) {
      benar++;
    } else {
      salah++;
    }
  });

  const totalSoal = ANSWER_KEY.length;
  const nilai = Math.round((benar / totalSoal) * 100);
  const waktuSubmit = new Date().toISOString();

  const namaUlangan =
    clean(data.namaUlangan, 150) ||
    'Ulangan Harian Informatika';

  // VALIDASI KONFIGURASI API

  if (!SHEETS_WEB_APP_URL) {
    return reply(503, {
      ok: false,
      message: 'URL Google Sheets belum dikonfigurasi.'
    });
  }

  if (!CONTENT_API_SECRET) {
    return reply(503, {
      ok: false,
      message: 'Secret API belum dikonfigurasi.'
    });
  }

  // KIRIM HASIL KE GOOGLE APPS SCRIPT

  try {
    const response = await fetch(SHEETS_WEB_APP_URL, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({

        action: 'saveExamResult',

        apiSecret: CONTENT_API_SECRET,

        nama,
        jenjang,
        kelas,
        nilai,
        benar,
        salah,
        kosong,
        totalSoal,
        waktuSubmit,
        namaUlangan

      })
    });

    if (!response.ok) {
      throw new Error(
        `Google Sheets HTTP ${response.status}`
      );
    }

    const result = await response.json();

    if (!result.ok) {
      throw new Error(
        result.message || 'Penyimpanan ditolak.'
      );
    }

    if (!result.sheetSaved) {
      throw new Error(
        'Google Sheets belum mengonfirmasi penyimpanan.'
      );
    }

  } catch (error) {

    console.error(
      'Penyimpanan hasil gagal:',
      error
    );

    return reply(502, {
      ok: false,
      message:
        'Hasil belum berhasil disimpan. Hubungi guru sebelum mencoba mengirim ulang.'
    });
  }

  // RESPONS BERHASIL

  return reply(200, {
    ok: true,
    score: nilai,
    correct: benar,
    wrong: salah,
    empty: kosong,
    total: totalSoal,
    submittedAt: waktuSubmit,
    jenjang,
    kelas,
    sheetSaved: true,
    emailSent: false
  });

};


// UTILITAS

function clean(value, max) {
  return typeof value === 'string'
    ? value.trim()
        .replace(/[<>\u0000-\u001f]/g, '')
        .slice(0, max)
    : '';
}


function reply(statusCode, body) {
  return {
    statusCode,

    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },

    body: JSON.stringify(body)
  };
}
