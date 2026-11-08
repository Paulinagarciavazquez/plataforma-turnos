// Textos de "Condiciones de reserva" y "Política de privacidad" de la web de
// reservas de cada negocio. Se arman con los datos del negocio (seña,
// política de cancelación, responsable de los datos), así no hay que
// escribirlos a mano para cada cliente.
//
// Roles (igual que en el contrato con cada negocio):
// - El NEGOCIO es el responsable de los datos de sus clientas y quien presta
//   el servicio (Ley 25.326 y Ley 24.240 de Defensa del Consumidor).
// - AGENDA ESTUDIO es la proveedora tecnológica: trata los datos solo por
//   cuenta y orden del negocio (encargada del tratamiento).
//
// Si se cambia algo de fondo, actualizar ACTUALIZADO para que la fecha de
// las páginas cambie también. Los textos son una base razonable, no
// reemplazan la revisión de un abogado (ver claude/camino-a-lanzamiento.md).

import { MINUTOS_PARA_PAGAR } from "./reservas";

export const ACTUALIZADO = "8 de noviembre de 2026";

export const HORAS_CANCELACION_POR_DEFECTO = 24;

// Qué pasa con la seña si la clienta avisa con la anticipación pedida.
export const OPCIONES_SENA_A_TIEMPO = {
  reprograma: "se usa para reprogramar el turno",
  devuelve: "se devuelve completa",
};

export function horasCancelacion(negocio) {
  const horas = Number(negocio?.horas_cancelacion);
  return Number.isFinite(horas) && horas >= 0 ? horas : HORAS_CANCELACION_POR_DEFECTO;
}

function senaATiempo(negocio) {
  return negocio?.sena_cancelacion_a_tiempo === "devuelve" ? "devuelve" : "reprograma";
}

function textoHoras(horas) {
  return horas === 1 ? "1 hora" : `${horas} horas`;
}

function textoSena(negocio) {
  const valor = Number(negocio?.porcentaje_o_monto_sena) || 0;
  if (negocio?.tipo_sena === "monto_fijo") {
    return `una seña de $${valor.toLocaleString("es-AR")}`;
  }
  return `una seña del ${valor}% del precio del servicio`;
}

function quienEsResponsable(negocio) {
  const titular = negocio?.responsable_nombre?.trim();
  return titular && titular !== negocio?.nombre ? `${negocio.nombre} (${titular})` : negocio?.nombre;
}

function comoContactar(negocio) {
  const email = negocio?.email_contacto?.trim();
  return email ? `escribiendo a ${email}` : "por sus canales de contacto habituales";
}

// Una línea para mostrar junto a la casilla de aceptación y en la
// confirmación del turno.
export function resumenCancelacion(negocio) {
  const horas = textoHoras(horasCancelacion(negocio));
  const aTiempo = senaATiempo(negocio) === "devuelve" ? "te devolvemos la seña" : "reprogramás sin perder la seña";
  return `Si avisás con al menos ${horas} de anticipación, ${aTiempo}. Con menos aviso o si no venís, la seña no se devuelve.`;
}

export function condicionesDeReserva(negocio) {
  const horas = textoHoras(horasCancelacion(negocio));
  const aTiempo = OPCIONES_SENA_A_TIEMPO[senaATiempo(negocio)];
  const extra = negocio?.condiciones_extra?.trim();

  const secciones = [
    {
      titulo: "Cómo se confirma tu turno",
      parrafos: [
        `Para reservar online se pide ${textoSena(negocio)}. El turno queda confirmado recién cuando el pago de la seña se acredita.`,
        `Mientras pagás, el horario queda guardado para vos durante ${MINUTOS_PARA_PAGAR} minutos. Si en ese tiempo el pago no se completa, el horario vuelve a quedar libre para otras personas.`,
        "La seña es parte del precio del servicio: se descuenta del total y el resto se abona en el local.",
      ],
    },
    {
      titulo: "Si necesitás cancelar o reprogramar",
      parrafos: [
        `Avisá con al menos ${horas} de anticipación al horario del turno y la seña ${aTiempo}.`,
        "Si avisás con menos anticipación, o si no te presentás al turno, la seña no se devuelve: compensa el horario que quedó reservado para vos.",
        `Para cancelar o reprogramar, comunicate con el negocio ${comoContactar(negocio)}.`,
      ],
    },
    {
      titulo: "Si el negocio cancela",
      parrafos: [
        "Si el negocio tiene que cancelar o mover tu turno, te avisa lo antes posible y podés elegir entre reprogramarlo o recibir la devolución completa de la seña.",
      ],
    },
    {
      titulo: "Pagos y devoluciones",
      parrafos: [
        "Los pagos se procesan con Mercado Pago. Ni el negocio ni la plataforma de reservas ven ni guardan los datos de tu tarjeta.",
        "Cuando corresponde una devolución, se hace por el mismo medio de pago, dentro de los plazos de Mercado Pago.",
      ],
    },
  ];

  if (extra) {
    secciones.push({ titulo: "Otras condiciones del negocio", parrafos: extra.split(/\n+/).filter(Boolean) });
  }

  secciones.push({
    titulo: "Quién presta el servicio",
    parrafos: [
      `El servicio lo presta ${quienEsResponsable(negocio)}${negocio?.responsable_cuit ? `, CUIT ${negocio.responsable_cuit}` : ""}${negocio?.responsable_domicilio ? `, con domicilio en ${negocio.responsable_domicilio}` : ""}. Cualquier consulta o reclamo sobre tu turno se hace con el negocio, ${comoContactar(negocio)}.`,
      "Esta web de reservas funciona con Agenda Estudio (agenda-estudio.com.ar), que provee la tecnología y no es parte del servicio que contratás.",
    ],
  });

  return { titulo: "Condiciones de reserva", secciones };
}

export function politicaDePrivacidad(negocio) {
  const responsable = quienEsResponsable(negocio);
  const datosResponsable = [
    negocio?.responsable_cuit ? `CUIT ${negocio.responsable_cuit}` : null,
    negocio?.responsable_domicilio ? `domicilio en ${negocio.responsable_domicilio}` : null,
  ].filter(Boolean);

  return {
    titulo: "Política de privacidad",
    secciones: [
      {
        titulo: "Quién es responsable de tus datos",
        parrafos: [
          `El responsable de los datos que cargás al reservar es ${responsable}${datosResponsable.length ? ` (${datosResponsable.join(", ")})` : ""}. Podés comunicarte ${comoContactar(negocio)}.`,
          "La web de reservas funciona con Agenda Estudio (agenda-estudio.com.ar), que trata los datos solo por cuenta y orden del negocio, para hacer funcionar las reservas, y no los usa para nada más.",
        ],
      },
      {
        titulo: "Qué datos guardamos",
        lista: [
          "Tu nombre, teléfono y email.",
          "Los datos de tu turno: servicio, profesional, día, horario y monto de la seña.",
          "El estado del pago y el número de operación de Mercado Pago. Los datos de tu tarjeta los procesa Mercado Pago y no llegan ni al negocio ni a la plataforma.",
          "Un código anónimo calculado a partir de tu conexión, para evitar reservas falsas. Tu dirección IP no se guarda.",
        ],
      },
      {
        titulo: "Para qué los usamos",
        lista: [
          "Gestionar tu turno y la seña.",
          "Mandarte el comprobante y un recordatorio por email antes del turno.",
          "Contactarte si hay algún cambio en tu turno.",
        ],
        parrafos: [
          "No vendemos ni cedemos tus datos, y no los usamos para publicidad sin tu consentimiento.",
        ],
      },
      {
        titulo: "Con quién se comparten",
        parrafos: [
          "Solo con los proveedores que hacen funcionar la web, y solo para eso: Mercado Pago (pagos), Supabase (base de datos), Vercel (alojamiento de la web) y Resend (envío de emails).",
          "Algunos de estos proveedores tienen sus servidores fuera de Argentina, por ejemplo en Estados Unidos. Al aceptar esta política prestás tu consentimiento para que tus datos se alojen allí, con las mismas finalidades.",
        ],
      },
      {
        titulo: "Cuánto tiempo los guardamos",
        parrafos: [
          "Mientras sean necesarios para gestionar tus turnos y, después, por el plazo que exijan las obligaciones legales o contables del negocio. Podés pedir que se borren antes, salvo que la ley obligue a conservarlos.",
        ],
      },
      {
        titulo: "Tus derechos",
        parrafos: [
          `Podés pedir acceder a tus datos, corregirlos, actualizarlos o borrarlos ${comoContactar(negocio)}. Brindar los datos es voluntario, pero sin nombre, teléfono y email no podemos tomar la reserva.`,
          "El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley N° 25.326.",
          "La Agencia de Acceso a la Información Pública, órgano de control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.",
        ],
      },
      {
        titulo: "Cookies",
        parrafos: [
          "Esta web no usa cookies de publicidad ni de seguimiento. Solo usa lo indispensable para que la reserva funcione.",
        ],
      },
    ],
  };
}
