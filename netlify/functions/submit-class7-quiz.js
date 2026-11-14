
const SHEETS_WEB_APP_URL = process.env.SHEETS_WEB_APP_URL;

const ANSWER_KEY = [
  'B', 'C', 'D', 'E', 'A',
  'C', 'B', 'D', 'A', 'E',
  'B', 'C', 'D', 'E', 'A',
  'C', 'B', 'D', 'E', 'A'
];

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

// Daftar jenjang, kelas, dan PIN masing-masing.
const CLASS_CONFIG = {
  Obedient:    { jenjang: 'SMP', pin: 'PIN_OBEDIENT' },
  Persistent:  { jenjang: 'SMP', pin: 'PIN_PERSISTENT' },
  Supportive:  { jenjang: 'SMP', pin: 'PIN_SUPPORTIVE' },
  Confident:   { jenjang: 'SMP', pin: 'PIN_CONFIDENT' },

  Respectful:  { jenjang: 'SMP', pin: 'PIN_RESPECTFUL' },
  Reflective:  { jenjang: 'SMP', pin: 'PIN_REFLECTIVE' },
  Inspiring:   { jenjang: 'SMP', pin: 'PIN_INSPIRING' },

  Motivated:   { jenjang: 'SMA', pin: 'PIN_MOTIVATED' },
  Courteous:   { jenjang: 'SMA', pin: 'PIN_COURTEOUS' },
  Leader:      { jenjang: 'SMA', pin: 'PIN_LEADER' },

  Innovative:  { jenjang: 'SMK', pin: 'PIN_INNOVATIVE' },
  Industrious: { jenjang: 'SMK', pin: 'PIN_INDUSTRIOUS' }
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
  const kelas = clean(data.kelas, 30);
  const jenjang = clean(data.jenjang, 10);
  const password = data.password;

  if (!nama || !kelas || !jenjang) {
    return reply(400, {
      ok: false,
      message: 'Nama, jenjang, dan kelas wajib diisi.'
    });
  }

  // Periksa apakah kelas terdaftar.
  if (!Object.prototype.hasOwnProperty.call(CLASS_CONFIG, kelas)) {
    return reply(400, {
      ok: false,
      message: 'Kelas tidak terdaftar.'
    });
  }

  const config = CLASS_CONFIG[kelas];

  // Pastikan jenjang sesuai dengan kelas.
  if (config.jenjang !== jenjang) {
    return reply(400, {
      ok: false,
      message: 'Jenjang tidak sesuai dengan kelas.'
    });
  }

  // Verifikasi PIN berdasarkan kelas.
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

  // Periksa jawaban siswa.
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
    const value = data.answers[i];

    return Number.isInteger(value) &&
      value >= 0 &&
      value < LETTERS.length
        ? LETTERS[value]
        : '';
  });

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

  const nilai = benar * 5;
  const waktuSubmit = new Date().toISOString();

  const namaUlangan =
    clean(data.namaUlangan, 150) ||
    'Ulangan Harian Informatika';

  if (!SHEETS_WEB_APP_URL) {
    return reply(503, {
      ok: false,
      message: 'URL Google Sheets belum dikonfigurasi.'
    });
  }

  // Kirim hasil ke Google Sheets.
  try {
    const response = await fetch(SHEETS_WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nama: nama,
        jenjang: jenjang,
        kelas: kelas,
        nilai: nilai,
        benar: benar,
        salah: salah,
        kosong: kosong,
        totalSoal: ANSWER_KEY.length,
        waktuSubmit: waktuSubmit,
        namaUlangan: namaUlangan
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

  } catch (error) {
    console.error('Penyimpanan hasil gagal:', error);

    return reply(502, {
      ok: false,
      message:
        'Hasil belum berhasil disimpan. Hubungi guru sebelum mencoba mengirim ulang.'
    });
  }

  return reply(200, {
    ok: true,
    score: nilai,
    correct: benar,
    wrong: salah,
    empty: kosong,
    submittedAt: waktuSubmit,
    jenjang: jenjang,
    kelas: kelas,
    sheetSaved: true,
    emailSent: false
  });
};

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
