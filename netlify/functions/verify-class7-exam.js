
const CLASS_CONFIG = {
  Obedient:    { jenjang: 'SMP', pinEnv: 'PIN_SMP7' },
  Persistent:  { jenjang: 'SMP', pinEnv: 'PIN_SMP7' },
  Supportive:  { jenjang: 'SMP', pinEnv: 'PIN_SMP7' },
  Confident:   { jenjang: 'SMP', pinEnv: 'PIN_SMP7' },

  Respectful:  { jenjang: 'SMP', pinEnv: 'PIN_SMP8' },
  Reflective:  { jenjang: 'SMP', pinEnv: 'PIN_SMP8' },
  Inspiring:   { jenjang: 'SMP', pinEnv: 'PIN_SMP8' },

  Motivated:   { jenjang: 'SMA', pinEnv: 'PIN_SMA10' },
  Courteous:   { jenjang: 'SMA', pinEnv: 'PIN_SMA11' },
  Leader:      { jenjang: 'SMA', pinEnv: 'PIN_SMA12' },

  Innovative:  { jenjang: 'SMK', pinEnv: 'PIN_SMK10' },
  Industrious: { jenjang: 'SMK', pinEnv: 'PIN_SMK11' }
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

  const name = clean(data.name, 100);
  const jenjang = clean(data.jenjang, 10);
  const kelas = clean(data.kelas, 30);
  const password = data.password;

  if (!name || !jenjang || !kelas || !password) {
    return reply(400, {
      ok: false,
      message: 'Nama, jenjang, kelas, dan PIN wajib diisi.'
    });
  }

  const config = CLASS_CONFIG[kelas];

  if (!config) {
    return reply(400, {
      ok: false,
      message: 'Kelas tidak terdaftar.'
    });
  }

  if (config.jenjang !== jenjang) {
    return reply(400, {
      ok: false,
      message: 'Jenjang tidak sesuai dengan kelas.'
    });
  }

  const expectedPin = process.env[config.pinEnv];

  if (!expectedPin) {
    return reply(503, {
      ok: false,
      message: 'PIN kelas belum dikonfigurasi.'
    });
  }

  if (
    typeof password !== 'string' ||
    password !== expectedPin
  ) {
    return reply(401, {
      ok: false,
      message: 'PIN yang Anda masukkan salah.'
    });
  }

  return reply(200, {
    ok: true,
    message: 'PIN berhasil diverifikasi.',
    student: {
      name,
      jenjang,
      kelas
    }
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
