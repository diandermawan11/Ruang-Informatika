
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return reply(405, { ok: false, message: 'Metode tidak diizinkan.' });
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch {
    return reply(400, { ok: false, message: 'Data tidak valid.' });
  }

  const expected = process.env.PASSWORD_SMP7;

  if (!expected) {
    return reply(503, {
      ok: false,
      message: 'Password belum dikonfigurasi oleh guru.'
    });
  }

  if (typeof data.password !== 'string' ||
      data.password !== expected) {
    return reply(401, {
      ok: false,
      message: 'Password ujian salah.'
    });
  }

  return reply(200, { ok: true });
};

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
