
const SHEETS_WEB_APP_URL = process.env.SHEETS_WEB_APP_URL;

const ANSWER_KEY = [
  'B', 'C', 'D', 'E', 'A',
  'C', 'B', 'D', 'A', 'E',
  'B', 'C', 'D', 'E', 'A',
  'C', 'B', 'D', 'E', 'A'
];

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

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
  const password = data.password;

  if (!nama) {
    return reply(400, {
      ok: false,
      message: 'Nama lengkap wajib diisi.'
    });
  }

  if (
    !process.env.PASSWORD_SMP7 ||
    typeof password !== 'string' ||
    password !== process.env.PASSWORD_SMP7
  ) {
    return reply(401, {
      ok: false,
      message: 'Password ujian tidak valid.'
    });
  }

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

  if (!SHEETS_WEB_APP_URL) {
    return reply(503, {
      ok: false,
      message: 'URL Google Sheets belum dikonfigurasi.'
    });
  }

  try {
    const response = await fetch(SHEETS_WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nama,
        kelas: 'SMP Kelas 7',
        nilai,
        benar,
        salah,
        kosong,
        totalSoal: ANSWER_KEY.length,
        waktuSubmit,
        judulUlangan:
          'Ulangan Harian Informatika Kelas 7 - Bab 3'
      })
    });

    if (!response.ok) {
      throw new Error(`Google Sheets HTTP ${response.status}`);
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
