// Helpers de fechas/horarios compartidos entre el flujo de reserva del
// cliente y el panel de administración (para que la dueña pueda bloquear un
// horario manualmente usando exactamente la misma lógica que ven sus
// clientes).

// Cada cuántos minutos se puede EMPEZAR un turno. No es la duración del
// servicio (eso varía por servicio) — es solo la grilla de horarios de
// inicio que se ofrece (09:00, 09:30, 10:00, ...). Hoy es una constante
// compartida por toda la plataforma; si en el futuro algún negocio necesita
// otro intervalo, se puede pasar a ser un campo más de la tabla "negocios".
export const INTERVALO_TURNO_MINUTOS = 30;

const DIAS_A_MOSTRAR = 21; // cuántos días hacia adelante ofrecemos para elegir

const NOMBRES_DIA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

// Exportada además para el panel de admin (vista de reservas por día).
export function aIso(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function horaAMinutos(hora) {
  const [h, m] = (hora || "00:00").slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

export function generarProximosDias(diasAtencion) {
  const dias = [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Arrancamos mañana para no tener que lidiar con horarios de hoy que ya pasaron
  for (let i = 1; dias.length < DIAS_A_MOSTRAR && i < DIAS_A_MOSTRAR + 7; i++) {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() + i);
    const diaSemana = fecha.getDay();

    if ((diasAtencion || []).includes(diaSemana)) {
      dias.push({
        iso: aIso(fecha),
        etiqueta: `${NOMBRES_DIA[diaSemana]} ${String(fecha.getDate()).padStart(2, "0")}/${String(
          fecha.getMonth() + 1
        ).padStart(2, "0")}`,
      });
    }
  }
  return dias;
}

// Genera los horarios de inicio posibles (cada INTERVALO_TURNO_MINUTOS)
// entre apertura y cierre, dejando afuera los que no dejan lugar para que
// el turno (de "duracionMinutos") termine antes del cierre.
export function generarHorariosInicio(horarioApertura, horarioCierre, duracionMinutos) {
  const minutosApertura = horaAMinutos(horarioApertura || "09:00");
  const minutosCierre = horaAMinutos(horarioCierre || "18:00");
  const duracion = duracionMinutos || INTERVALO_TURNO_MINUTOS;

  const horarios = [];
  for (
    let minutos = minutosApertura;
    minutos + duracion <= minutosCierre;
    minutos += INTERVALO_TURNO_MINUTOS
  ) {
    const h = String(Math.floor(minutos / 60)).padStart(2, "0");
    const m = String(minutos % 60).padStart(2, "0");
    horarios.push(`${h}:${m}`);
  }
  return horarios;
}

// Horario de atención de un día puntual ("YYYY-MM-DD"): { desde, hasta }
// ("HH:MM"), o null si ese día de la semana el negocio no atiende.
// "horarios_por_dia" (jsonb, ej. {"4": {"desde": "09:00", "hasta": "20:00"}},
// con 0 = domingo como Date.getDay()) permite un horario distinto por día;
// si un día no figura ahí, vale el horario general (horario_apertura /
// horario_cierre). Los cierres puntuales (feriados, vacaciones del local)
// van aparte, en la tabla "cierres_negocio" (ver fechaCerrada).
export function horarioDelDia(negocio, fechaIso) {
  const [y, m, d] = fechaIso.split("-").map(Number);
  const diaSemana = new Date(y, m - 1, d).getDay();
  return horarioDelDiaSemana(negocio, diaSemana);
}

export function horarioDelDiaSemana(negocio, diaSemana) {
  if (!(negocio?.dias_atencion || []).includes(diaSemana)) return null;
  const propio = negocio.horarios_por_dia?.[String(diaSemana)];
  return {
    desde: (propio?.desde || negocio.horario_apertura || "09:00").slice(0, 5),
    hasta: (propio?.hasta || negocio.horario_cierre || "18:00").slice(0, 5),
  };
}

// El cierre del local que cae en esa fecha, si hay alguno (o undefined).
// "cierres" es una lista de { desde, hasta, motivo } con fechas "YYYY-MM-DD".
export function fechaCerrada(fechaIso, cierres) {
  return (cierres || []).find((cierre) => cierre.desde <= fechaIso && fechaIso <= cierre.hasta);
}

// Devuelve la hora de fin ("HH:MM") de un turno que empieza en "horaInicio"
// y dura "duracionMinutos".
export function horaFin(horaInicio, duracionMinutos) {
  const minutos = horaAMinutos(horaInicio) + (duracionMinutos || 0);
  const h = String(Math.floor(minutos / 60)).padStart(2, "0");
  const m = String(minutos % 60).padStart(2, "0");
  return `${h}:${m}`;
}

// De una lista de horarios de inicio posibles, saca los que se superponen
// con algún turno ya ocupado ese día para esa profesional. "ocupados" es
// una lista de { hora, duracion_minutos }.
export function filtrarHorariosLibres(horariosInicio, duracionMinutos, ocupados) {
  return horariosInicio.filter((horaInicio) => {
    const inicio = horaAMinutos(horaInicio);
    const fin = inicio + duracionMinutos;

    return !(ocupados || []).some((ocupado) => {
      const ocupInicio = horaAMinutos(ocupado.hora);
      const ocupFin = ocupInicio + (ocupado.duracion_minutos || INTERVALO_TURNO_MINUTOS);
      return inicio < ocupFin && ocupInicio < fin;
    });
  });
}
