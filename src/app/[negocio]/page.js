"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { generarProximosDias, generarHorariosInicio, filtrarHorariosLibres } from "../../lib/horarios";
import { formatearFechaCorta } from "../../lib/formatearFecha";
import SkinPilotoByOlivia from "./SkinPilotoByOlivia";

function calcularMontoSena(negocio, servicio) {
  if (!negocio || !servicio) return 0;
  const precioServicio = Number(servicio.precio) || 0;
  const valorSena = Number(negocio.porcentaje_o_monto_sena) || 0;

  if (negocio.tipo_sena === "monto_fijo") {
    return valorSena;
  }
  // Por defecto (o tipo_sena === "porcentaje"), tratamos el valor como %
  return Math.round((precioServicio * valorSena) / 100);
}

export default function ReservaNegocio({ params }) {
  const { negocio: slug } = use(params);

  const [cargando, setCargando] = useState(true);
  const [datosNegocio, setDatosNegocio] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const [pantallaActual, setPantallaActual] = useState("landing");
  const [historialPantallas, setHistorialPantallas] = useState([]);
  const [elecciones, setElecciones] = useState({
    sucursal: null,
    servicio: null,
    profesional: null,
    fecha: null,
    hora: null,
  });
  const [profesionalesDelServicio, setProfesionalesDelServicio] = useState([]);
  const [diasDisponibles, setDiasDisponibles] = useState([]);
  const [cargandoDias, setCargandoDias] = useState(false);
  const [horariosDisponibles, setHorariosDisponibles] = useState([]);
  const [cargandoHorarios, setCargandoHorarios] = useState(false);

  const [datosCliente, setDatosCliente] = useState({ nombre: "", telefono: "", email: "" });
  const [enviandoReserva, setEnviandoReserva] = useState(false);
  const [errorReserva, setErrorReserva] = useState(null);
  const [reservaConfirmada, setReservaConfirmada] = useState(null);

  useEffect(() => {
    async function cargarDatos() {
      setCargando(true);

      const { data: negocio, error: errNegocio } = await supabase
        .from("negocios")
        .select("*")
        .eq("slug", slug)
        .single();

      if (errNegocio || !negocio) {
        setDatosNegocio(null);
        setCargando(false);
        return;
      }
      setDatosNegocio(negocio);

      const { data: listaSucursales } = await supabase
        .from("sucursales")
        .select("*")
        .eq("negocio_id", negocio.id);

      setSucursales(listaSucursales || []);

      // Traemos los servicios junto con los profesionales vinculados a cada uno
      // (vía la tabla puente servicios_profesionales), así sabemos de entrada
      // si hay que preguntar profesional o si se puede saltear ese paso.
      const { data: listaServicios, error: errServicios } = await supabase
        .from("servicios")
        .select(
          "id, nombre, descripcion, precio, duracion_minutos, categoria, servicios_profesionales(profesional_id, profesionales(id, nombre, sucursal_id))"
        )
        .eq("negocio_id", negocio.id);

      if (errServicios) {
        console.error("Error cargando servicios:", errServicios);
      }

      setServicios(listaServicios || []);
      setCargando(false);
    }

    cargarDatos();
  }, [slug]);

  // Avanza a una pantalla dejando registrada la actual en el historial, para
  // poder volver con "volverAtras" sin importar qué pasos se saltearon (por
  // ejemplo, si el negocio tiene una sola sucursal o el servicio un solo
  // profesional, esos pasos ni entran al historial).
  const irAPantalla = (pantalla) => {
    setHistorialPantallas((prev) => [...prev, pantallaActual]);
    setPantallaActual(pantalla);
  };

  const volverAtras = () => {
    if (historialPantallas.length === 0) return;
    const pantallaAnterior = historialPantallas[historialPantallas.length - 1];
    setHistorialPantallas(historialPantallas.slice(0, -1));
    setPantallaActual(pantallaAnterior);
    setErrorReserva(null);
  };

  const manejarReserva = () => {
    if (sucursales.length <= 1) {
      setElecciones((prev) => ({ ...prev, sucursal: sucursales[0] || null }));
      irAPantalla("servicio");
    } else {
      irAPantalla("sucursal");
    }
  };

  const elegirSucursal = (sucursal) => {
    setElecciones((prev) => ({ ...prev, sucursal }));
    irAPantalla("servicio");
  };

  const irAElegirDia = async (profesional) => {
    irAPantalla("dia");
    setCargandoDias(true);

    const todosLosDias = generarProximosDias(datosNegocio.dias_atencion);

    if (!profesional) {
      setDiasDisponibles(todosLosDias);
      setCargandoDias(false);
      return;
    }

    // Si la profesional tiene alguna ausencia cargada (no puede trabajar tal
    // día), sacamos esos días de la lista para que no se puedan elegir.
    const { data: ausencias, error } = await supabase
      .from("ausencias_profesionales")
      .select("fecha")
      .eq("negocio_id", datosNegocio.id)
      .eq("profesional_id", profesional.id);

    if (error) {
      console.error("Error cargando ausencias del profesional:", error);
    }

    const fechasAusente = new Set((ausencias || []).map((a) => a.fecha));
    setDiasDisponibles(todosLosDias.filter((dia) => !fechasAusente.has(dia.iso)));
    setCargandoDias(false);
  };

  const elegirServicio = (servicio) => {
    const profesionalesVinculados = (servicio.servicios_profesionales || [])
      .map((vinculo) => vinculo.profesionales)
      .filter(Boolean)
      // Si el negocio usa sucursales, solo ofrecemos profesionales que
      // trabajen en la sucursal elegida. Un profesional sin sucursal
      // asignada (sucursal_id null) se entiende como "trabaja en todas".
      .filter(
        (profesional) =>
          !elecciones.sucursal ||
          !profesional.sucursal_id ||
          profesional.sucursal_id === elecciones.sucursal.id
      );

    if (profesionalesVinculados.length <= 1) {
      // Un solo profesional (o ninguno cargado todavía): se salta la pregunta
      const profesionalElegido = profesionalesVinculados[0] || null;
      setElecciones((prev) => ({
        ...prev,
        servicio,
        profesional: profesionalElegido,
      }));
      irAElegirDia(profesionalElegido);
    } else {
      setElecciones((prev) => ({ ...prev, servicio, profesional: null }));
      setProfesionalesDelServicio(profesionalesVinculados);
      irAPantalla("profesional");
    }
  };

  const elegirProfesional = (profesional) => {
    setElecciones((prev) => ({ ...prev, profesional }));
    irAElegirDia(profesional);
  };

  const elegirDia = async (fechaIso) => {
    setElecciones((prev) => ({ ...prev, fecha: fechaIso, hora: null }));
    setCargandoHorarios(true);
    setPantallaActual("horario");

    const duracionServicio = elecciones.servicio.duracion_minutos;
    const horariosInicioPosibles = generarHorariosInicio(
      datosNegocio.horario_apertura,
      datosNegocio.horario_cierre,
      duracionServicio
    );

    if (!elecciones.profesional) {
      // No pudimos determinar un profesional puntual (caso borde: servicio sin
      // profesionales cargados). Por ahora mostramos todos los horarios sin
      // revisar ocupados.
      setHorariosDisponibles(horariosInicioPosibles);
      setCargandoHorarios(false);
      return;
    }

    // Consultamos la vista pública "turnos_ocupados" (sin datos del cliente)
    // en vez de la tabla "reservas" directamente: esa tabla solo la puede leer
    // el dueño del negocio por RLS, así que una consulta anónima ahí siempre
    // devuelve vacío y nunca detectaría un horario ya tomado.
    const { data: reservasDelDia, error } = await supabase
      .from("turnos_ocupados")
      .select("hora, duracion_minutos")
      .eq("negocio_id", datosNegocio.id)
      .eq("profesional_id", elecciones.profesional.id)
      .eq("fecha", fechaIso);

    if (error) {
      console.error("Error cargando turnos ocupados del día:", error);
    }

    setHorariosDisponibles(
      filtrarHorariosLibres(horariosInicioPosibles, duracionServicio, reservasDelDia)
    );
    setCargandoHorarios(false);
  };

  const elegirHorario = (hora) => {
    setElecciones((prev) => ({ ...prev, hora }));
    setErrorReserva(null);
    irAPantalla("datos");
  };

  const actualizarDatoCliente = (campo, valor) => {
    setDatosCliente((prev) => ({ ...prev, [campo]: valor }));
  };

  const confirmarReserva = async (evento) => {
    evento.preventDefault();

    const nombre = datosCliente.nombre.trim();
    const telefono = datosCliente.telefono.trim();
    const email = datosCliente.email.trim();

    if (!nombre || !telefono) {
      setErrorReserva("Necesitamos al menos tu nombre y un teléfono de contacto.");
      return;
    }

    setEnviandoReserva(true);
    setErrorReserva(null);

    const montoSena = calcularMontoSena(datosNegocio, elecciones.servicio);

    // Generamos el id acá mismo (en vez de dejar que lo genere Supabase) para
    // poder usarlo enseguida al crear el pago, sin tener que releer la fila:
    // como el visitante que reserva es anónimo, la política de RLS de SELECT
    // en "reservas" (que solo deja ver al dueño del negocio) bloquearía el
    // RETURNING de un .select() después del insert.
    const reservaId = crypto.randomUUID();

    const { error } = await supabase.from("reservas").insert({
      id: reservaId,
      negocio_id: datosNegocio.id,
      sucursal_id: elecciones.sucursal?.id || null,
      servicio_id: elecciones.servicio.id,
      profesional_id: elecciones.profesional?.id || null,
      nombre_cliente: nombre,
      telefono_cliente: telefono,
      email_cliente: email || null,
      fecha: elecciones.fecha,
      hora: elecciones.hora,
      duracion_minutos: elecciones.servicio.duracion_minutos,
      estado: "pendiente_pago",
      monto_sena: montoSena,
    });

    if (error) {
      setEnviandoReserva(false);
      console.error("Error guardando la reserva:", error);
      setErrorReserva("No pudimos guardar tu reserva. Probá de nuevo en unos segundos.");
      return;
    }

    // Negocios en "modo demo" (por ahora, el piloto): en vez de ir a
    // Mercado Pago de verdad, simulamos la aprobación al toque para que
    // cualquiera pueda recorrer el flujo completo sin necesitar una cuenta
    // de prueba. El backend vuelve a chequear "modo_demo" antes de confirmar
    // nada, así que esto nunca salta un cobro real de un negocio real.
    if (datosNegocio.modo_demo) {
      try {
        const respuestaDemo = await fetch("/api/simular-pago-demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservaId }),
        });

        const datosDemo = await respuestaDemo.json();
        setEnviandoReserva(false);

        if (!respuestaDemo.ok) {
          setErrorReserva(datosDemo.error || "No pudimos simular el pago. Probá de nuevo.");
          return;
        }

        setReservaConfirmada(datosDemo);
        setPantallaActual("confirmacion");
      } catch (errorDemo) {
        setEnviandoReserva(false);
        console.error("Error simulando el pago demo:", errorDemo);
        setErrorReserva("No pudimos simular el pago. Probá de nuevo.");
      }
      return;
    }

    // La reserva ya quedó guardada como "pendiente_pago". Ahora le pedimos al
    // servidor que cree la preferencia de pago en la cuenta de Mercado Pago
    // de ESTE negocio (no la nuestra) y redirigimos al cliente a pagar ahí.
    try {
      const respuesta = await fetch("/api/crear-preferencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negocioId: datosNegocio.id,
          reservaId,
          monto: montoSena,
          descripcion: `Seña - ${elecciones.servicio.nombre}`,
          slug,
          origin: window.location.origin,
        }),
      });

      const datos = await respuesta.json();

      if (!respuesta.ok || !datos.url) {
        setEnviandoReserva(false);
        setErrorReserva(
          datos.error || "No pudimos iniciar el pago. Tu reserva quedó guardada, contactanos para coordinar la seña."
        );
        return;
      }

      // Redirigimos la pestaña entera al checkout de Mercado Pago.
      window.location.href = datos.url;
    } catch (errorPago) {
      setEnviandoReserva(false);
      console.error("Error iniciando el pago:", errorPago);
      setErrorReserva(
        "No pudimos iniciar el pago. Tu reserva quedó guardada, contactanos para coordinar la seña."
      );
    }
  };

  const volverAlInicio = () => {
    setElecciones({
      sucursal: null,
      servicio: null,
      profesional: null,
      fecha: null,
      hora: null,
    });
    setDatosCliente({ nombre: "", telefono: "", email: "" });
    setErrorReserva(null);
    setReservaConfirmada(null);
    setPantallaActual("landing");

    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  };

  // Cuando Mercado Pago redirige de vuelta ("back_url"), la URL trae
  // ?pago=exito|fallo|pendiente&reserva=<id> (más los parámetros propios de
  // Mercado Pago, como payment_id). Ese es el único momento en el que se
  // llega a la pantalla de confirmación: nunca confiamos en esos parámetros
  // por sí solos, siempre se verifica el pago real del lado del servidor.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const parametros = new URLSearchParams(window.location.search);
    const reservaId = parametros.get("reserva");
    const pago = parametros.get("pago");

    if (!reservaId || !pago) return;

    const paymentId = parametros.get("payment_id") || parametros.get("collection_id");

    setPantallaActual("verificando");

    async function verificarPago() {
      try {
        const respuesta = await fetch("/api/verificar-pago", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservaId, paymentId }),
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
          setErrorReserva(datos.error || "No pudimos verificar tu pago. Contactanos para confirmarlo.");
          setPantallaActual("landing");
          return;
        }

        setReservaConfirmada(datos);
        setPantallaActual("confirmacion");
      } catch (errorVerificacion) {
        console.error("Error verificando el pago:", errorVerificacion);
        setErrorReserva("No pudimos verificar tu pago. Contactanos para confirmarlo.");
        setPantallaActual("landing");
      }
    }

    verificarPago();
    // Solo se ejecuta al entrar a la página (lectura de query params de la URL).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si el pago quedó rechazado, dejamos que el cliente reintente sin tener
  // que cargar de nuevo todo el flujo: ya tenemos el id de la reserva y el
  // monto guardados en reservaConfirmada.
  const reintentarPago = async () => {
    if (!reservaConfirmada) return;

    setEnviandoReserva(true);
    setErrorReserva(null);

    try {
      const respuesta = await fetch("/api/crear-preferencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negocioId: reservaConfirmada.negocioId,
          reservaId: reservaConfirmada.reservaId,
          monto: reservaConfirmada.montoSena,
          descripcion: `Seña - ${reservaConfirmada.servicio?.nombre || "turno"}`,
          slug,
          origin: window.location.origin,
        }),
      });

      const datos = await respuesta.json();

      if (!respuesta.ok || !datos.url) {
        setEnviandoReserva(false);
        setErrorReserva(
          datos.error || "No pudimos reiniciar el pago. Contactanos para coordinar la seña."
        );
        return;
      }

      window.location.href = datos.url;
    } catch (errorPago) {
      setEnviandoReserva(false);
      console.error("Error reintentando el pago:", errorPago);
      setErrorReserva("No pudimos reiniciar el pago. Contactanos para coordinar la seña.");
    }
  };

  if (cargando) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>Cargando...</p>
      </main>
    );
  }

  if (!datosNegocio) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center">
        <p>No encontramos este negocio. Revisá el link e intentá de nuevo.</p>
      </main>
    );
  }

  const colorPrimario = datosNegocio.color_primario || "#D9A79C";
  const colorSecundario = datosNegocio.color_secundario || "#3A2E2A";
  const formatearPrecio = (precio) => `$${Number(precio).toLocaleString("es-AR")}`;

  // Si el negocio usa sucursales, un servicio solo se ofrece en la sucursal
  // elegida cuando: no tiene ningún profesional vinculado todavía (no lo
  // restringimos, se asume disponible en cualquier sucursal), o al menos uno
  // de sus profesionales vinculados trabaja ahí (sin sucursal asignada =
  // trabaja en todas). Así "Depilación" puede existir solo en Chacras sin
  // aparecer como opción en Centro, sin tener que duplicar nada.
  const serviciosEnSucursal = servicios.filter((servicio) => {
    if (!elecciones.sucursal) return true;
    const vinculados = (servicio.servicios_profesionales || [])
      .map((vinculo) => vinculo.profesionales)
      .filter(Boolean);
    if (vinculados.length === 0) return true;
    return vinculados.some(
      (p) => !p.sucursal_id || p.sucursal_id === elecciones.sucursal.id
    );
  });

  // Agrupar servicios por categoría (por ejemplo Manos / Pies / Combos) es
  // opcional: si el negocio no cargó categorías, esto queda vacío y se
  // muestra la lista plana de siempre. "Otros" agrupa los servicios sin
  // categoría cuando conviven con servicios que sí la tienen.
  const categoriasDeServicios = Array.from(
    new Set(serviciosEnSucursal.map((s) => s.categoria).filter(Boolean))
  );
  const hayServiciosSinCategoria = serviciosEnSucursal.some((s) => !s.categoria);
  const categoriasDisponibles =
    categoriasDeServicios.length > 0
      ? [...categoriasDeServicios, ...(hayServiciosSinCategoria ? ["Otros"] : [])]
      : [];
  const categoriaMostrada =
    categoriaActiva && categoriasDisponibles.includes(categoriaActiva)
      ? categoriaActiva
      : categoriasDisponibles[0];
  const serviciosAMostrar =
    categoriasDisponibles.length > 0
      ? serviciosEnSucursal.filter((s) => (s.categoria || "Otros") === categoriaMostrada)
      : serviciosEnSucursal;

  // Piloto "by olivia": usa una interfaz visual a medida (piel a medida),
  // reutilizando toda la lógica de reserva/pago/mail definida arriba sin
  // ningún cambio. Por ahora se identifica por slug -- el día que haya más
  // negocios con diseño propio, esto puede pasar a ser una configuración
  // del negocio en vez de estar hardcodeado acá.
  if (slug === "unas-test") {
    return (
      <SkinPilotoByOlivia
        datosNegocio={datosNegocio}
        pantallaActual={pantallaActual}
        volverAtras={volverAtras}
        manejarReserva={manejarReserva}
        sucursales={sucursales}
        elegirSucursal={elegirSucursal}
        serviciosAMostrar={serviciosAMostrar}
        categoriasDisponibles={categoriasDisponibles}
        categoriaMostrada={categoriaMostrada}
        setCategoriaActiva={setCategoriaActiva}
        elegirServicio={elegirServicio}
        formatearPrecio={formatearPrecio}
        profesionalesDelServicio={profesionalesDelServicio}
        elegirProfesional={elegirProfesional}
        diasDisponibles={diasDisponibles}
        cargandoDias={cargandoDias}
        elegirDia={elegirDia}
        horariosDisponibles={horariosDisponibles}
        cargandoHorarios={cargandoHorarios}
        elegirHorario={elegirHorario}
        elecciones={elecciones}
        datosCliente={datosCliente}
        actualizarDatoCliente={actualizarDatoCliente}
        confirmarReserva={confirmarReserva}
        errorReserva={errorReserva}
        enviandoReserva={enviandoReserva}
        reservaConfirmada={reservaConfirmada}
        reintentarPago={reintentarPago}
        volverAlInicio={volverAlInicio}
      />
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      {datosNegocio.modo_demo && (
        <div className="bg-black text-white text-center text-xs font-medium py-2 px-4">
          Estás viendo una demo — no se cobra plata real, el pago se simula automáticamente.
        </div>
      )}
      {pantallaActual === "landing" && (
        <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
          {datosNegocio.logo_url ? (
            <img
              src={datosNegocio.logo_url}
              alt={datosNegocio.nombre}
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <h1 className="text-3xl font-semibold" style={{ color: colorSecundario }}>
              {datosNegocio.nombre}
            </h1>
          )}

          {datosNegocio.texto_bienvenida && (
            <p className="max-w-md text-base" style={{ color: colorSecundario }}>
              {datosNegocio.texto_bienvenida}
            </p>
          )}

          <button
            onClick={manejarReserva}
            className="rounded-full px-8 py-3 text-white font-medium"
            style={{ backgroundColor: colorPrimario }}
          >
            Reservar ahora
          </button>
        </section>
      )}

      {pantallaActual === "sucursal" && (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <div className="w-full max-w-sm">
            <button
              onClick={volverAtras}
              className="text-sm font-medium"
              style={{ color: colorPrimario }}
            >
              ← Volver
            </button>
          </div>
          <h2 className="text-xl font-semibold" style={{ color: colorSecundario }}>
            Elegí una sucursal
          </h2>
          <div className="flex w-full max-w-sm flex-col gap-3">
            {sucursales.map((sucursal) => (
              <button
                key={sucursal.id}
                onClick={() => elegirSucursal(sucursal)}
                className="rounded-lg border px-4 py-3 text-left hover:bg-black/5"
              >
                <span className="block font-medium">{sucursal.nombre}</span>
                {sucursal.direccion && (
                  <span className="block text-sm text-gray-500">{sucursal.direccion}</span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {pantallaActual === "servicio" && (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <div className="w-full max-w-sm">
            <button
              onClick={volverAtras}
              className="text-sm font-medium"
              style={{ color: colorPrimario }}
            >
              ← Volver
            </button>
          </div>
          <h2 className="text-xl font-semibold" style={{ color: colorSecundario }}>
            Elegí un servicio
          </h2>

          {categoriasDisponibles.length > 1 && (
            <div className="flex flex-wrap justify-center gap-2">
              {categoriasDisponibles.map((categoria) => (
                <button
                  key={categoria}
                  onClick={() => setCategoriaActiva(categoria)}
                  className="rounded-full border px-4 py-1.5 text-sm font-medium"
                  style={
                    categoria === categoriaMostrada
                      ? { backgroundColor: colorPrimario, borderColor: colorPrimario, color: "#fff" }
                      : { borderColor: "rgba(0,0,0,0.15)", color: colorSecundario }
                  }
                >
                  {categoria}
                </button>
              ))}
            </div>
          )}

          <div className="flex w-full max-w-sm flex-col gap-3">
            {serviciosAMostrar.length === 0 && (
              <p className="text-center text-sm text-gray-500">
                {servicios.length === 0
                  ? "Este negocio todavía no tiene servicios cargados."
                  : "Esta sucursal no tiene servicios cargados todavía."}
              </p>
            )}
            {serviciosAMostrar.map((servicio) => (
              <button
                key={servicio.id}
                onClick={() => elegirServicio(servicio)}
                className="rounded-lg border px-4 py-3 text-left hover:bg-black/5"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{servicio.nombre}</span>
                  <span className="whitespace-nowrap font-medium" style={{ color: colorPrimario }}>
                    {formatearPrecio(servicio.precio)}
                  </span>
                </span>
                {servicio.descripcion && (
                  <span className="block text-sm text-gray-500">{servicio.descripcion}</span>
                )}
                <span className="block text-xs text-gray-400">
                  {servicio.duracion_minutos} min
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {pantallaActual === "profesional" && (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <div className="w-full max-w-sm">
            <button
              onClick={volverAtras}
              className="text-sm font-medium"
              style={{ color: colorPrimario }}
            >
              ← Volver
            </button>
          </div>
          <h2 className="text-xl font-semibold" style={{ color: colorSecundario }}>
            ¿Con quién preferís tu turno?
          </h2>
          <div className="flex w-full max-w-sm flex-col gap-3">
            {profesionalesDelServicio.map((profesional) => (
              <button
                key={profesional.id}
                onClick={() => elegirProfesional(profesional)}
                className="rounded-lg border px-4 py-3 text-left hover:bg-black/5"
              >
                <span className="font-medium">{profesional.nombre}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {pantallaActual === "dia" && (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <div className="w-full max-w-sm">
            <button
              onClick={volverAtras}
              className="text-sm font-medium"
              style={{ color: colorPrimario }}
            >
              ← Volver
            </button>
          </div>
          <h2 className="text-xl font-semibold" style={{ color: colorSecundario }}>
            Elegí un día
          </h2>
          {cargandoDias ? (
            <p className="text-sm text-gray-500">Buscando días disponibles...</p>
          ) : diasDisponibles.length === 0 ? (
            <p className="text-sm text-gray-500">
              No hay días disponibles por ahora. Probá de nuevo más tarde.
            </p>
          ) : (
            <div className="grid w-full max-w-sm grid-cols-3 gap-2">
              {diasDisponibles.map((dia) => (
                <button
                  key={dia.iso}
                  onClick={() => elegirDia(dia.iso)}
                  className="rounded-lg border px-2 py-3 text-center text-sm hover:bg-black/5"
                >
                  {dia.etiqueta}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {pantallaActual === "horario" && (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <div className="w-full max-w-sm">
            <button
              onClick={volverAtras}
              className="text-sm font-medium"
              style={{ color: colorPrimario }}
            >
              ← Volver
            </button>
          </div>
          <h2 className="text-xl font-semibold" style={{ color: colorSecundario }}>
            Elegí un horario
          </h2>
          {cargandoHorarios ? (
            <p className="text-sm text-gray-500">Buscando horarios disponibles...</p>
          ) : horariosDisponibles.length === 0 ? (
            <p className="text-sm text-gray-500">
              No quedan horarios libres ese día. Probá con otro día.
            </p>
          ) : (
            <div className="grid w-full max-w-sm grid-cols-3 gap-2">
              {horariosDisponibles.map((hora) => (
                <button
                  key={hora}
                  onClick={() => elegirHorario(hora)}
                  className="rounded-lg border px-2 py-3 text-center text-sm hover:bg-black/5"
                >
                  {hora}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {pantallaActual === "datos" && (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <div className="w-full max-w-sm">
            <button
              onClick={volverAtras}
              className="text-sm font-medium"
              style={{ color: colorPrimario }}
            >
              ← Volver
            </button>
          </div>
          <h2 className="text-xl font-semibold" style={{ color: colorSecundario }}>
            Tus datos
          </h2>
          <form onSubmit={confirmarReserva} className="flex w-full max-w-sm flex-col gap-3">
            <input
              type="text"
              placeholder="Nombre y apellido"
              value={datosCliente.nombre}
              onChange={(e) => actualizarDatoCliente("nombre", e.target.value)}
              className="rounded-lg border px-4 py-3"
              required
            />
            <input
              type="tel"
              placeholder="Teléfono"
              value={datosCliente.telefono}
              onChange={(e) => actualizarDatoCliente("telefono", e.target.value)}
              className="rounded-lg border px-4 py-3"
              required
            />
            <input
              type="email"
              placeholder="Email (opcional)"
              value={datosCliente.email}
              onChange={(e) => actualizarDatoCliente("email", e.target.value)}
              className="rounded-lg border px-4 py-3"
            />

            {errorReserva && <p className="text-sm text-red-600">{errorReserva}</p>}

            <button
              type="submit"
              disabled={enviandoReserva}
              className="rounded-full px-8 py-3 text-white font-medium disabled:opacity-60"
              style={{ backgroundColor: colorPrimario }}
            >
              {enviandoReserva ? "Confirmando..." : "Confirmar reserva"}
            </button>
          </form>
        </section>
      )}

      {pantallaActual === "verificando" && (
        <section className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
          <p className="text-sm text-gray-500">Confirmando tu pago, un momento...</p>
        </section>
      )}

      {pantallaActual === "confirmacion" && reservaConfirmada && (
        <section className="flex flex-1 flex-col items-center">
          <div
            className="flex w-full flex-col items-center gap-4 px-6 py-16 text-center"
            style={{ background: `linear-gradient(135deg, ${colorPrimario}, ${colorSecundario})` }}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/50 bg-white/15">
              {reservaConfirmada.estadoPago === "rechazado" ? (
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              ) : (
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              )}
            </div>
            <h2 className="text-2xl font-semibold text-white">
              {reservaConfirmada.estadoPago === "aprobado" && "¡Turno confirmado!"}
              {reservaConfirmada.estadoPago === "pendiente" && "Pago en proceso"}
              {reservaConfirmada.estadoPago === "rechazado" && "El pago no se pudo procesar"}
              {(reservaConfirmada.estadoPago === "sin_pago" || reservaConfirmada.estadoPago === "error") &&
                "Reserva guardada"}
            </h2>
            <p className="max-w-xs text-sm text-white/85">
              {reservaConfirmada.estadoPago === "aprobado" &&
                `Guardamos tu lugar${reservaConfirmada.nombreNegocio ? ` en ${reservaConfirmada.nombreNegocio}` : ""}.`}
              {reservaConfirmada.estadoPago === "pendiente" &&
                "Tu pago está en revisión. Te vamos a confirmar el turno apenas se acredite."}
              {reservaConfirmada.estadoPago === "rechazado" &&
                "Tu reserva quedó guardada, pero el pago fue rechazado. Podés reintentarlo."}
              {(reservaConfirmada.estadoPago === "sin_pago" || reservaConfirmada.estadoPago === "error") &&
                "Tu reserva quedó guardada como pendiente de pago."}
            </p>
          </div>

          <div className="-mt-8 w-full max-w-sm rounded-2xl border bg-white px-6 py-6 shadow-sm mx-6">
            <div className="flex items-baseline justify-between gap-3 border-b py-3 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Servicio
              </span>
              <span className="text-right font-medium">{reservaConfirmada.servicio?.nombre}</span>
            </div>
            {reservaConfirmada.sucursal && (
              <div className="flex items-baseline justify-between gap-3 border-b py-3 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Sucursal
                </span>
                <span className="text-right font-medium">{reservaConfirmada.sucursal.nombre}</span>
              </div>
            )}
            {reservaConfirmada.profesional && (
              <div className="flex items-baseline justify-between gap-3 border-b py-3 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Profesional
                </span>
                <span className="text-right font-medium">{reservaConfirmada.profesional.nombre}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-3 border-b py-3 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Día y horario
              </span>
              <span className="text-right font-medium">
                {formatearFechaCorta(reservaConfirmada.fecha)} · {reservaConfirmada.hora}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3 pt-4">
              <span className="text-sm font-medium">Seña</span>
              <span className="text-lg font-semibold" style={{ color: colorPrimario }}>
                {formatearPrecio(reservaConfirmada.montoSena)}
              </span>
            </div>
          </div>

          {errorReserva && (
            <p className="mt-4 max-w-sm px-6 text-center text-sm text-red-600">{errorReserva}</p>
          )}

          {reservaConfirmada.estadoPago === "rechazado" && (
            <button
              onClick={reintentarPago}
              disabled={enviandoReserva}
              className="mt-6 rounded-full px-8 py-3 text-white font-medium disabled:opacity-60"
              style={{ backgroundColor: colorPrimario }}
            >
              {enviandoReserva ? "Redirigiendo..." : "Reintentar pago"}
            </button>
          )}

          <p className="mt-5 max-w-sm px-6 text-center text-xs text-gray-500">
            {reservaConfirmada.estadoPago === "aprobado"
              ? "Si necesitás cancelar o reprogramar, contactanos con anticipación."
              : "Si tenés dudas sobre el pago, contactanos y lo resolvemos juntos."}
          </p>

          <button
            onClick={volverAlInicio}
            className="mb-16 mt-6 rounded-full px-8 py-3 font-medium"
            style={{ color: colorPrimario, border: `1px solid ${colorPrimario}` }}
          >
            Volver al inicio
          </button>
        </section>
      )}
    </main>
  );
}
