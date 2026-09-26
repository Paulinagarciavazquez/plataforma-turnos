"use client";

import { formatearFechaCorta } from "../../lib/formatearFecha";

// Skin visual a medida ("piel a medida") para el piloto de by olivia nails
// studio. No tiene lógica propia: recibe todo (estado y funciones) como
// props desde page.js, que sigue siendo la única fuente de verdad del flujo
// de reserva. Esto sigue la misma filosofía usada en el Paso 4: un diseño
// bespoke por negocio real, reutilizando el motor de reservas/pago/mail
// compartido de abajo.

function inicialesDe(nombre) {
  if (!nombre) return "?";
  return nombre.trim().charAt(0).toUpperCase();
}

export default function SkinPilotoByOlivia({
  datosNegocio,
  pantallaActual,
  volverAtras,
  manejarReserva,
  sucursales,
  elegirSucursal,
  serviciosAMostrar,
  categoriasDisponibles,
  categoriaMostrada,
  setCategoriaActiva,
  elegirServicio,
  formatearPrecio,
  profesionalesDelServicio,
  elegirProfesional,
  diasDisponibles,
  cargandoDias,
  elegirDia,
  horariosDisponibles,
  cargandoHorarios,
  elegirHorario,
  elecciones,
  datosCliente,
  actualizarDatoCliente,
  confirmarReserva,
  errorReserva,
  enviandoReserva,
  reservaConfirmada,
  reintentarPago,
  volverAlInicio,
}) {
  // Pasos posibles del flujo, en orden. Se arma según lo que ya sabemos que
  // se va a preguntar (una sola sucursal o un solo profesional se saltean),
  // igual que la lógica de page.js — es solo para mostrar el contador de
  // pasos, no afecta la navegación real.
  const pasosOrden = [
    ...(sucursales.length > 1 ? ["sucursal"] : []),
    "servicio",
    ...(profesionalesDelServicio.length > 1 ? ["profesional"] : []),
    "dia",
    "horario",
    "datos",
  ];
  const indicePaso = pasosOrden.indexOf(pantallaActual);
  const totalPasos = pasosOrden.length;
  const hayEncabezadoDePaso = indicePaso >= 0;

  const encabezadoPaso = hayEncabezadoDePaso && (
    <header className="bo-step-top">
      <button onClick={volverAtras} className="bo-step-back">
        ← Volver
      </button>
      <div className="bo-step-mark">{datosNegocio.nombre}</div>
      <div className="bo-step-count">
        Paso {indicePaso + 1} de {totalPasos}
      </div>
    </header>
  );

  const puntosProgreso = hayEncabezadoDePaso && (
    <div className="bo-progress-dots">
      {pasosOrden.map((paso, i) => (
        <span key={paso} className={i <= indicePaso ? "bo-dot bo-dot-active" : "bo-dot"} />
      ))}
    </div>
  );

  return (
    <div className="piel-by-olivia">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Italiana&family=Bebas+Neue&family=Cormorant+Garamond:ital,wght@0,500;1,500&family=Jost:wght@400;500;600&display=swap"
      />
      <style>{`
        .piel-by-olivia {
          --bo-burgundy: #890620;
          --bo-berry: #B6465F;
          --bo-taupe: #DA9F93;
          --bo-almond: #EBD4CB;
          --bo-cream: #FBF6F3;
          --bo-ink: #2B1116;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--bo-cream);
          color: var(--bo-ink);
          font-family: 'Jost', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .piel-by-olivia * { box-sizing: border-box; }
        .piel-by-olivia .bo-display { font-family: 'Italiana', Georgia, serif; font-weight: 400; margin: 0; }
        .piel-by-olivia .bo-quote { font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; font-weight: 500; }
        .piel-by-olivia .bo-eyebrow {
          font-family: 'Jost', sans-serif; font-size: 13px; font-weight: 600;
          letter-spacing: 3px; text-transform: uppercase; margin: 0 0 14px;
        }
        .piel-by-olivia a { text-decoration: none; }
        .piel-by-olivia .bo-btn-primary {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 18px 44px; background: var(--bo-burgundy); color: var(--bo-cream);
          font-family: 'Jost', sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 2px;
          text-transform: uppercase; border-radius: 999px; border: 1px solid var(--bo-burgundy);
          cursor: pointer; transition: background 0.15s, border-color 0.15s;
        }
        .piel-by-olivia .bo-btn-primary:hover { background: #6e0419; border-color: #6e0419; }
        .piel-by-olivia .bo-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .piel-by-olivia .bo-btn-outline {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 16px 38px; background: transparent; color: var(--bo-burgundy);
          font-family: 'Jost', sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 2px;
          text-transform: uppercase; border-radius: 999px; border: 2px solid var(--bo-burgundy); cursor: pointer;
        }
        .piel-by-olivia .bo-btn-outline:hover { background: rgba(137,6,32,0.08); }
        .piel-by-olivia .bo-step-top {
          display: flex; align-items: center; justify-content: space-between;
          padding: 24px 28px;
          background: linear-gradient(90deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.35) 100%), linear-gradient(90deg, var(--bo-burgundy) 0%, var(--bo-berry) 38%, var(--bo-taupe) 68%, var(--bo-almond) 100%);
        }
        .piel-by-olivia .bo-step-back {
          background: none; border: none; padding: 0; cursor: pointer;
          font-family: 'Jost', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 1px;
          text-transform: uppercase; color: var(--bo-cream);
        }
        .piel-by-olivia .bo-step-mark { font-family: 'Italiana', Georgia, serif; font-size: 18px; color: var(--bo-cream); }
        .piel-by-olivia .bo-step-count {
          font-family: 'Jost', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 2px;
          text-transform: uppercase; color: rgba(251,246,243,0.85);
        }
        .piel-by-olivia .bo-progress-dots { display: flex; gap: 8px; justify-content: center; margin: 32px 0; }
        .piel-by-olivia .bo-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(137,6,32,0.18); }
        .piel-by-olivia .bo-dot-active { background: linear-gradient(135deg, var(--bo-burgundy), var(--bo-berry)); }
        .piel-by-olivia .bo-main { flex: 1; padding: 8px 24px 100px; }
        .piel-by-olivia .bo-titulo-wrap { text-align: center; margin: 0 auto 36px; max-width: 480px; }
        .piel-by-olivia .bo-titulo { font-size: 34px; margin-bottom: 8px; }
        .piel-by-olivia .bo-subtitulo { font-size: 14px; color: rgba(43,17,22,0.6); }
        .piel-by-olivia .bo-lista { display: flex; flex-direction: column; gap: 14px; max-width: 480px; margin: 0 auto; }
        .piel-by-olivia .bo-option-card {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 20px 22px; border: 1.5px solid rgba(43,17,22,0.15); border-radius: 12px;
          background: #fff; cursor: pointer; text-align: left; width: 100%; font: inherit; color: inherit;
        }
        .piel-by-olivia .bo-option-card:hover { border-color: var(--bo-berry); }
        .piel-by-olivia .bo-option-name { font-size: 16px; font-weight: 500; }
        .piel-by-olivia .bo-option-meta { font-size: 13px; color: rgba(43,17,22,0.55); margin-top: 4px; }
        .piel-by-olivia .bo-option-price { font-size: 14px; font-weight: 600; color: var(--bo-burgundy); white-space: nowrap; }
        .piel-by-olivia .bo-tab-row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; max-width: 480px; margin: 0 auto 28px; }
        .piel-by-olivia .bo-tab-btn {
          padding: 10px 22px; border: 1.5px solid rgba(43,17,22,0.15); border-radius: 999px;
          font-family: 'Jost', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;
          cursor: pointer; color: var(--bo-ink); background: #fff;
        }
        .piel-by-olivia .bo-tab-btn.bo-tab-active { background: var(--bo-burgundy); border-color: var(--bo-burgundy); color: var(--bo-cream); }
        .piel-by-olivia .bo-pro-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; max-width: 560px; margin: 0 auto; }
        .piel-by-olivia .bo-pro-card {
          display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;
          padding: 22px 12px; border: 1.5px solid rgba(43,17,22,0.15); border-radius: 12px; cursor: pointer;
          background: #fff; font: inherit; color: inherit;
        }
        .piel-by-olivia .bo-pro-card:hover { border-color: var(--bo-berry); }
        .piel-by-olivia .bo-pro-avatar {
          width: 60px; height: 60px; border-radius: 50%;
          background: linear-gradient(155deg, var(--bo-almond) 0%, var(--bo-taupe) 60%, var(--bo-berry) 130%);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Italiana', Georgia, serif; font-size: 22px; color: var(--bo-cream);
        }
        .piel-by-olivia .bo-pro-name { font-size: 14px; font-weight: 500; }
        .piel-by-olivia .bo-day-row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; max-width: 560px; margin: 0 auto; }
        .piel-by-olivia .bo-day-chip {
          padding: 13px 20px; border: 1.5px solid rgba(43,17,22,0.15); border-radius: 999px; cursor: pointer;
          font-family: 'Jost', sans-serif; font-size: 14px; font-weight: 500; background: #fff; color: inherit;
        }
        .piel-by-olivia .bo-day-chip:hover { border-color: var(--bo-berry); }
        .piel-by-olivia .bo-time-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; max-width: 480px; margin: 0 auto; }
        .piel-by-olivia .bo-time-slot {
          display: flex; align-items: center; justify-content: center; padding: 13px 0;
          border: 1.5px solid rgba(43,17,22,0.15); border-radius: 999px; cursor: pointer;
          font-family: 'Jost', sans-serif; font-size: 14px; font-weight: 500; background: #fff; color: inherit;
        }
        .piel-by-olivia .bo-time-slot:hover { border-color: var(--bo-berry); }
        .piel-by-olivia .bo-form { display: flex; flex-direction: column; gap: 14px; max-width: 420px; margin: 0 auto; }
        .piel-by-olivia .bo-input {
          padding: 16px 18px; border: 1.5px solid rgba(43,17,22,0.15); border-radius: 12px;
          font-family: 'Jost', sans-serif; font-size: 15px; color: var(--bo-ink); background: #fff;
        }
        .piel-by-olivia .bo-input:focus { outline: none; border-color: var(--bo-burgundy); }
        .piel-by-olivia .bo-error { font-size: 13px; color: #a1213a; margin: 0; }
        .piel-by-olivia .bo-hero {
          position: relative; flex: 1; min-height: 560px; display: flex; flex-direction: column;
          align-items: center; justify-content: center; text-align: center; gap: 18px; padding: 90px 24px;
          background: linear-gradient(135deg, var(--bo-burgundy) 0%, var(--bo-berry) 38%, var(--bo-taupe) 68%, var(--bo-almond) 100%);
        }
        .piel-by-olivia .bo-hero::before {
          content: ""; position: absolute; inset: 0;
          background: radial-gradient(ellipse at 50% 45%, rgba(28,8,12,0.35) 0%, rgba(28,8,12,0.12) 55%, rgba(28,8,12,0) 78%);
          pointer-events: none;
        }
        .piel-by-olivia .bo-hero > * { position: relative; z-index: 1; }
        .piel-by-olivia .bo-hero-logo { width: 76px; height: 76px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(251,246,243,0.85); }
        .piel-by-olivia .bo-hero-titulo { font-size: 68px; line-height: 1; color: var(--bo-cream); }
        .piel-by-olivia .bo-hero-texto { font-size: 19px; color: rgba(251,246,243,0.92); max-width: 480px; margin: 0; }
        .piel-by-olivia .bo-verificando { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; padding: 80px 24px; text-align: center; }
        .piel-by-olivia .bo-spinner {
          width: 34px; height: 34px; border-radius: 50%;
          border: 3px solid rgba(137,6,32,0.15); border-top-color: var(--bo-burgundy);
          animation: bo-spin 0.8s linear infinite;
        }
        @keyframes bo-spin { to { transform: rotate(360deg); } }
        .piel-by-olivia .bo-confirm-hero {
          position: relative; padding: 80px 24px 68px; text-align: center;
          background: linear-gradient(90deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.35) 100%), linear-gradient(135deg, var(--bo-burgundy) 0%, var(--bo-berry) 38%, var(--bo-taupe) 68%, var(--bo-almond) 100%);
        }
        .piel-by-olivia .bo-check-badge {
          width: 62px; height: 62px; margin: 0 auto 22px; border-radius: 50%;
          background: rgba(251,246,243,0.16); border: 1.5px solid rgba(251,246,243,0.55);
          display: flex; align-items: center; justify-content: center;
        }
        .piel-by-olivia .bo-confirm-titulo { font-size: 38px; color: var(--bo-cream); margin-bottom: 10px; }
        .piel-by-olivia .bo-confirm-sub { font-size: 14px; color: rgba(251,246,243,0.88); max-width: 400px; margin: 0 auto; }
        .piel-by-olivia .bo-summary-card {
          max-width: 460px; margin: -36px auto 0; background: #fff; border: 1.5px solid rgba(43,17,22,0.12);
          border-radius: 14px; padding: 30px; position: relative;
        }
        .piel-by-olivia .bo-summary-row { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding: 13px 0; border-bottom: 1px solid rgba(43,17,22,0.1); }
        .piel-by-olivia .bo-summary-row:last-of-type { border-bottom: none; }
        .piel-by-olivia .bo-summary-label { font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: rgba(43,17,22,0.5); }
        .piel-by-olivia .bo-summary-value { font-size: 14px; font-weight: 500; text-align: right; }
        .piel-by-olivia .bo-sena-total { display: flex; align-items: baseline; justify-content: space-between; padding-top: 18px; margin-top: 6px; border-top: 1.5px solid rgba(43,17,22,0.15); }
        .piel-by-olivia .bo-notice { max-width: 460px; margin: 20px auto 0; padding: 15px 20px; border-radius: 12px; background: rgba(137,6,32,0.05); font-size: 13px; color: rgba(43,17,22,0.65); text-align: center; }
        .piel-by-olivia .bo-confirm-actions { max-width: 460px; margin: 24px auto 0; display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 0 24px 40px; }
        .piel-by-olivia .bo-demo-banner {
          background: var(--bo-ink);
          color: var(--bo-cream);
          text-align: center;
          font-family: 'Jost', sans-serif;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.5px;
          padding: 9px 16px;
        }
        @media (max-width: 640px) {
          .piel-by-olivia .bo-hero-titulo { font-size: 44px; }
          .piel-by-olivia .bo-pro-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .piel-by-olivia .bo-step-mark { display: none; }
        }
      `}</style>

      {datosNegocio.modo_demo && (
        <div className="bo-demo-banner">
          Estás viendo una demo — no se cobra plata real, el pago se simula automáticamente.
        </div>
      )}

      {pantallaActual === "landing" && (
        <section className="bo-hero">
          {datosNegocio.logo_url && (
            <img src={datosNegocio.logo_url} alt={datosNegocio.nombre} className="bo-hero-logo" />
          )}
          <div className="bo-eyebrow" style={{ color: "rgba(251,246,243,0.85)" }}>
            Reservá tu turno online
          </div>
          <h1 className="bo-display bo-hero-titulo">{datosNegocio.nombre}</h1>
          {datosNegocio.texto_bienvenida && (
            <p className="bo-quote bo-hero-texto">{datosNegocio.texto_bienvenida}</p>
          )}
          <button
            onClick={manejarReserva}
            className="bo-btn-primary"
            style={{ background: "#FBF6F3", color: "var(--bo-burgundy)", borderColor: "#FBF6F3" }}
          >
            Reservar ahora
          </button>
        </section>
      )}

      {pantallaActual === "sucursal" && (
        <>
          {encabezadoPaso}
          <main className="bo-main">
            {puntosProgreso}
            <div className="bo-titulo-wrap">
              <div className="bo-eyebrow" style={{ color: "var(--bo-berry)" }}>
                Reservar turno
              </div>
              <h2 className="bo-display bo-titulo">Elegí una sucursal</h2>
            </div>
            <div className="bo-lista">
              {sucursales.map((sucursal) => (
                <button key={sucursal.id} onClick={() => elegirSucursal(sucursal)} className="bo-option-card">
                  <div>
                    <div className="bo-option-name">{sucursal.nombre}</div>
                    {sucursal.direccion && <div className="bo-option-meta">{sucursal.direccion}</div>}
                  </div>
                </button>
              ))}
            </div>
          </main>
        </>
      )}

      {pantallaActual === "servicio" && (
        <>
          {encabezadoPaso}
          <main className="bo-main">
            {puntosProgreso}
            <div className="bo-titulo-wrap">
              <div className="bo-eyebrow" style={{ color: "var(--bo-berry)" }}>
                Reservar turno
              </div>
              <h2 className="bo-display bo-titulo">Elegí tu servicio</h2>
            </div>

            {categoriasDisponibles.length > 1 && (
              <div className="bo-tab-row">
                {categoriasDisponibles.map((categoria) => (
                  <button
                    key={categoria}
                    onClick={() => setCategoriaActiva(categoria)}
                    className={categoria === categoriaMostrada ? "bo-tab-btn bo-tab-active" : "bo-tab-btn"}
                  >
                    {categoria}
                  </button>
                ))}
              </div>
            )}

            <div className="bo-lista">
              {serviciosAMostrar.length === 0 && (
                <p className="bo-subtitulo" style={{ textAlign: "center" }}>
                  Todavía no hay servicios cargados.
                </p>
              )}
              {serviciosAMostrar.map((servicio) => (
                <button key={servicio.id} onClick={() => elegirServicio(servicio)} className="bo-option-card">
                  <div>
                    <div className="bo-option-name">{servicio.nombre}</div>
                    {servicio.descripcion && <div className="bo-option-meta">{servicio.descripcion}</div>}
                    <div className="bo-option-meta">{servicio.duracion_minutos} min</div>
                  </div>
                  <span className="bo-option-price">{formatearPrecio(servicio.precio)}</span>
                </button>
              ))}
            </div>
          </main>
        </>
      )}

      {pantallaActual === "profesional" && (
        <>
          {encabezadoPaso}
          <main className="bo-main">
            {puntosProgreso}
            <div className="bo-titulo-wrap">
              <div className="bo-eyebrow" style={{ color: "var(--bo-berry)" }}>
                Reservar turno
              </div>
              <h2 className="bo-display bo-titulo">¿Con quién preferís tu turno?</h2>
              {elecciones.servicio && <p className="bo-subtitulo">{elecciones.servicio.nombre}</p>}
            </div>
            <div className="bo-pro-grid">
              {profesionalesDelServicio.map((profesional) => (
                <button key={profesional.id} onClick={() => elegirProfesional(profesional)} className="bo-pro-card">
                  <div className="bo-pro-avatar">{inicialesDe(profesional.nombre)}</div>
                  <div className="bo-pro-name">{profesional.nombre}</div>
                </button>
              ))}
            </div>
          </main>
        </>
      )}

      {pantallaActual === "dia" && (
        <>
          {encabezadoPaso}
          <main className="bo-main">
            {puntosProgreso}
            <div className="bo-titulo-wrap">
              <div className="bo-eyebrow" style={{ color: "var(--bo-berry)" }}>
                Reservar turno
              </div>
              <h2 className="bo-display bo-titulo">Elegí un día</h2>
              {elecciones.servicio && (
                <p className="bo-subtitulo">
                  {elecciones.servicio.nombre}
                  {elecciones.profesional ? ` con ${elecciones.profesional.nombre}` : ""}
                </p>
              )}
            </div>
            {cargandoDias ? (
              <p className="bo-subtitulo" style={{ textAlign: "center" }}>
                Buscando días disponibles...
              </p>
            ) : diasDisponibles.length === 0 ? (
              <p className="bo-subtitulo" style={{ textAlign: "center" }}>
                No hay días disponibles por ahora. Probá de nuevo más tarde.
              </p>
            ) : (
              <div className="bo-day-row">
                {diasDisponibles.map((dia) => (
                  <button key={dia.iso} onClick={() => elegirDia(dia.iso)} className="bo-day-chip">
                    {dia.etiqueta}
                  </button>
                ))}
              </div>
            )}
          </main>
        </>
      )}

      {pantallaActual === "horario" && (
        <>
          {encabezadoPaso}
          <main className="bo-main">
            {puntosProgreso}
            <div className="bo-titulo-wrap">
              <div className="bo-eyebrow" style={{ color: "var(--bo-berry)" }}>
                Reservar turno
              </div>
              <h2 className="bo-display bo-titulo">Elegí un horario</h2>
            </div>
            {cargandoHorarios ? (
              <p className="bo-subtitulo" style={{ textAlign: "center" }}>
                Buscando horarios disponibles...
              </p>
            ) : horariosDisponibles.length === 0 ? (
              <p className="bo-subtitulo" style={{ textAlign: "center" }}>
                No quedan horarios libres ese día. Probá con otro día.
              </p>
            ) : (
              <div className="bo-time-grid">
                {horariosDisponibles.map((hora) => (
                  <button key={hora} onClick={() => elegirHorario(hora)} className="bo-time-slot">
                    {hora}
                  </button>
                ))}
              </div>
            )}
          </main>
        </>
      )}

      {pantallaActual === "datos" && (
        <>
          {encabezadoPaso}
          <main className="bo-main">
            {puntosProgreso}
            <div className="bo-titulo-wrap">
              <div className="bo-eyebrow" style={{ color: "var(--bo-berry)" }}>
                Reservar turno
              </div>
              <h2 className="bo-display bo-titulo">Tus datos</h2>
            </div>
            <form onSubmit={confirmarReserva} className="bo-form">
              <input
                type="text"
                placeholder="Nombre y apellido"
                value={datosCliente.nombre}
                onChange={(e) => actualizarDatoCliente("nombre", e.target.value)}
                className="bo-input"
                required
              />
              <input
                type="tel"
                placeholder="Teléfono"
                value={datosCliente.telefono}
                onChange={(e) => actualizarDatoCliente("telefono", e.target.value)}
                className="bo-input"
                required
              />
              <input
                type="email"
                placeholder="Email (opcional)"
                value={datosCliente.email}
                onChange={(e) => actualizarDatoCliente("email", e.target.value)}
                className="bo-input"
              />
              {errorReserva && <p className="bo-error">{errorReserva}</p>}
              <button type="submit" disabled={enviandoReserva} className="bo-btn-primary">
                {enviandoReserva ? "Confirmando..." : "Pagar seña y confirmar"}
              </button>
              <p className="bo-subtitulo" style={{ textAlign: "center" }}>
                Pago seguro procesado por Mercado Pago
              </p>
            </form>
          </main>
        </>
      )}

      {pantallaActual === "verificando" && (
        <section className="bo-verificando">
          <div className="bo-spinner" />
          <p className="bo-quote" style={{ fontSize: 20 }}>
            Confirmando tu pago, un momento...
          </p>
        </section>
      )}

      {pantallaActual === "confirmacion" && reservaConfirmada && (
        <section style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div className="bo-confirm-hero">
            <div className="bo-display" style={{ fontSize: 16, color: "rgba(251,246,243,0.85)", marginBottom: 22 }}>
              {datosNegocio.nombre}
            </div>
            <div className="bo-check-badge">
              {reservaConfirmada.estadoPago === "rechazado" ? (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FBF6F3"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              ) : (
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FBF6F3"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              )}
            </div>
            <h2 className="bo-display bo-confirm-titulo">
              {reservaConfirmada.estadoPago === "aprobado" && "¡Turno confirmado!"}
              {reservaConfirmada.estadoPago === "pendiente" && "Pago en proceso"}
              {reservaConfirmada.estadoPago === "rechazado" && "El pago no se pudo procesar"}
              {(reservaConfirmada.estadoPago === "sin_pago" || reservaConfirmada.estadoPago === "error") &&
                "Reserva guardada"}
            </h2>
            <p className="bo-confirm-sub">
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

          <div className="bo-summary-card">
            <div className="bo-summary-row">
              <span className="bo-summary-label">Servicio</span>
              <span className="bo-summary-value">{reservaConfirmada.servicio?.nombre}</span>
            </div>
            {reservaConfirmada.sucursal && (
              <div className="bo-summary-row">
                <span className="bo-summary-label">Sucursal</span>
                <span className="bo-summary-value">{reservaConfirmada.sucursal.nombre}</span>
              </div>
            )}
            {reservaConfirmada.profesional && (
              <div className="bo-summary-row">
                <span className="bo-summary-label">Profesional</span>
                <span className="bo-summary-value">{reservaConfirmada.profesional.nombre}</span>
              </div>
            )}
            <div className="bo-summary-row">
              <span className="bo-summary-label">Día y horario</span>
              <span className="bo-summary-value">
                {formatearFechaCorta(reservaConfirmada.fecha)} · {reservaConfirmada.hora}
              </span>
            </div>
            <div className="bo-sena-total">
              <span className="bo-display" style={{ fontSize: 15 }}>
                Seña
              </span>
              <span className="bo-display" style={{ fontSize: 24, color: "var(--bo-burgundy)" }}>
                {formatearPrecio(reservaConfirmada.montoSena)}
              </span>
            </div>
          </div>

          {errorReserva && (
            <p className="bo-error" style={{ textAlign: "center", maxWidth: 460, margin: "16px auto 0" }}>
              {errorReserva}
            </p>
          )}

          <div className="bo-confirm-actions">
            {reservaConfirmada.estadoPago === "rechazado" && (
              <button onClick={reintentarPago} disabled={enviandoReserva} className="bo-btn-primary">
                {enviandoReserva ? "Redirigiendo..." : "Reintentar pago"}
              </button>
            )}
            <p className="bo-subtitulo" style={{ textAlign: "center", maxWidth: 400 }}>
              {reservaConfirmada.estadoPago === "aprobado"
                ? "Si necesitás cancelar o reprogramar, contactanos con anticipación."
                : "Si tenés dudas sobre el pago, contactanos y lo resolvemos juntos."}
            </p>
            <button onClick={volverAlInicio} className="bo-btn-outline">
              Volver al inicio
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
