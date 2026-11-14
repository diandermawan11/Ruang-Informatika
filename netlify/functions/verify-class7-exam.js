
const CLASS_CONFIG = {
  Obedient:    { jenjang:"SMP", pinEnv:"PIN_OBEDIENT" },
  Persistent:  { jenjang:"SMP", pinEnv:"PIN_PERSISTENT" },
  Supportive:  { jenjang:"SMP", pinEnv:"PIN_SUPPORTIVE" },
  Confident:   { jenjang:"SMP", pinEnv:"PIN_CONFIDENT" },

  Respectful:  { jenjang:"SMP", pinEnv:"PIN_RESPECTFUL" },
  Reflective:  { jenjang:"SMP", pinEnv:"PIN_REFLECTIVE" },
  Inspiring:   { jenjang:"SMP", pinEnv:"PIN_INSPIRING" },

  Motivated:   { jenjang:"SMA", pinEnv:"PIN_MOTIVATED" },
  Courteous:   { jenjang:"SMA", pinEnv:"PIN_COURTEOUS" },
  Leader:      { jenjang:"SMA", pinEnv:"PIN_LEADER" },

  Innovative:  { jenjang:"SMK", pinEnv:"PIN_INNOVATIVE" },
  Industrious: { jenjang:"SMK", pinEnv:"PIN_INDUSTRIOUS" }
};

exports.handler = async event => {
  if(event.httpMethod !== "POST"){
    return reply(405,{ok:false,message:"Metode tidak diizinkan."});
  }

  let data;

  try{
    data = JSON.parse(event.body || "{}");
  }catch{
    return reply(400,{ok:false,message:"Data tidak valid."});
  }

  const kelas = data.kelas;
  const jenjang = data.jenjang;

  if(typeof data.password !== "string" || !data.password){
    return reply(400,{ok:false,message:"PIN wajib diisi."});
  }

  // Mendukung sistem ujian lama.
  if(!kelas && !jenjang){
    const oldPin = process.env.PASSWORD_SMP7 || process.env.PIN_SMP7;

    if(!oldPin){
      return reply(503,{ok:false,message:"PIN lama belum dikonfigurasi."});
    }

    if(data.password !== oldPin){
      return reply(401,{ok:false,message:"PIN ujian salah."});
    }

    return reply(200,{ok:true});
  }

  const config = CLASS_CONFIG[kelas];

  if(!config){
    return reply(400,{ok:false,message:"Kelas tidak terdaftar."});
  }

  if(config.jenjang !== jenjang){
    return reply(400,{ok:false,message:"Jenjang tidak sesuai."});
  }

  const expected = process.env[config.pinEnv];

  if(!expected){
    return reply(503,{
      ok:false,
      message:`PIN kelas ${kelas} belum dikonfigurasi.`
    });
  }

  if(data.password !== expected){
    return reply(401,{
      ok:false,
      message:"PIN kelas tidak valid."
    });
  }

  return reply(200,{
    ok:true,
    jenjang,
    kelas,
    message:"PIN berhasil diverifikasi."
  });
};

function reply(statusCode,body){
  return {
    statusCode,
    headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"no-store"
    },
    body:JSON.stringify(body)
  };
}
