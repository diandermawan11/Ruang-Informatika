
const CLASS_CONFIG = {
  Obedient:    { jenjang: 'SMP', pin: 'PIN_SMP7' },
  Persistent:  { jenjang: 'SMP', pin: 'PIN_SMP7' },
  Supportive:  { jenjang: 'SMP', pin: 'PIN_SMP7' },
  Confident:   { jenjang: 'SMP', pin: 'PIN_SMP7' },

  Respectful:  { jenjang: 'SMP', pin: 'PIN_SMP8' },
  Reflective:  { jenjang: 'SMP', pin: 'PIN_SMP8' },
  Inspiring:   { jenjang: 'SMP', pin: 'PIN_SMP8' },

  Motivated:   { jenjang: 'SMA', pin: 'PIN_SMA10' },
  Courteous:   { jenjang: 'SMA', pin: 'PIN_SMA11' },
  Leader:      { jenjang: 'SMA', pin: 'PIN_SMA12' },

  Innovative:  { jenjang: 'SMK', pin: 'PIN_SMK10' },
  Industrious: { jenjang: 'SMK', pin: 'PIN_SMK11' }
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
      message: 'Data tidak valid.'
    });
  }

  const nama = clean(data.name, 100);
  const jenjang = clean(data.jenjang, 10);
  const kelas = clean(data.kelas, 30);
  const password = data.password;

  if (!nama || !jenjang || !kelas) {
    return reply(400, {
      ok: false,
      message: 'Nama, jenjang, dan kelas wajib diisi.'
    });
  }

  const config = CLASS_CONFIG[kelas];

  if (!config || config.jenjang !== jenjang) {
    return reply(400, {
      ok: false,
      message: 'Pilihan jenjang atau kelas tidak valid.'
    });
  }

  const expected = process.env[config.pin];

  if (!expected) {
    return reply(503, {
      ok: false,
      message: 'PIN kelas belum dikonfigurasi oleh guru.'
    });
  }

  if (
    typeof password !== 'string' ||
    password !== expected
  ) {
    return reply(401, {
      ok: false,
      message: 'PIN ujian salah.'
    });
  }

  return reply(200, {
    ok: true,
    message: 'Verifikasi berhasil.',
    name: nama,
    jenjang,
    kelas
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
