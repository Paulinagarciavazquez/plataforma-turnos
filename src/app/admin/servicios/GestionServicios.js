"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function formatearPrecio(precio) {
  return `$${Number(precio || 0).toLocaleString("es-AR")}`;
}

function formatearDuracion(minutos) {
  const m = Number(minutos || 0);
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m / 60} h`;
}

const SIN_CATEGORIA = "Sin categoría";

export default function GestionServicios({ negocio }) {
  const [formNuevoAbierto, setFormNuevoAbierto] = useState(false);
  const [profesionales, setProfesionales] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [vinculos, setVinculos] = useState([]); // { servicio_id, profesional_id }
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [recargar, setRecargar] = useState(0);

  const [nombreProfesional, setNombreProfesional] = useState("");
  const [guardandoProfesional, setGuardandoProfesional] = useState(false);

  const [nuevoServicio, setNuevoServicio] = useState({
    nombre: "",
    descripcion: "",
    precio: "",
    duracion_minutos: "",
    categoria: "",
  });
  const [guardandoServicio, setGuardandoServicio] = useState(false);

  const [edicionServicioId, setEdicionServicioId] = useState(null);
  const [edicionServicio, setEdicionServicio] = useState({
    nombre: "",
    descripcion: "",
    precio: "",
    duracion_minutos: "",
    categoria: "",
  });
  const [guardandoEdicionServicio, setGuardandoEdicionServicio] = useState(false);

  useEffect(() => {
    async function cargarDatos() {
      setCargando(true);
      setError("");

      const [
        { data: profesionalesData, error: errorProfesionales },
        { data: serviciosData, error: errorServicios },
        { data: sucursalesData, error: errorSucursales },
      ] = await Promise.all([
        supabase
          .from("profesionales")
          .select("id, nombre, sucursal_id")
          .eq("negocio_id", negocio.id)
          .order("nombre"),
        supabase
          .from("servicios")
          .select("id, nombre, descripcion, precio, duracion_minutos, categoria")
          .eq("negocio_id", negocio.id)
          .order("nombre"),
        supabase
          .from("sucursales")
          .select("id, nombre")
          .eq("negocio_id", negocio.id)
          .order("nombre"),
      ]);

      if (errorProfesionales || errorServicios || errorSucursales) {
        setError("No pudimos cargar los datos. Probá recargar la página.");
        setCargando(false);
        return;
      }

      setProfesionales(profesionalesData || []);
      setServicios(serviciosData || []);
      setSucursales(sucursalesData || []);

      const idsServicios = (serviciosData || []).map((s) => s.id);
      if (idsServicios.length > 0) {
        const { data: vinculosData, error: errorVinculos } = await supabase
          .from("servicios_profesionales")
          .select("servicio_id, profesional_id")
          .in("servicio_id", idsServicios);

        if (!errorVinculos) {
          setVinculos(vinculosData || []);
        }
      } else {
        setVinculos([]);
      }

      setCargando(false);
    }

    cargarDatos();
  }, [negocio.id, recargar]);

  function recargarDatos() {
    setRecargar((valor) => valor + 1);
  }

  async function agregarProfesional(e) {
    e.preventDefault();
    if (!nombreProfesional.trim()) return;

    setGuardandoProfesional(true);
    const { error: errorInsert } = await supabase.from("profesionales").insert({
      negocio_id: negocio.id,
      nombre: nombreProfesional.trim(),
    });
    setGuardandoProfesional(false);

    if (errorInsert) {
      window.alert("No pudimos guardar el profesional. Probá de nuevo.");
      return;
    }

    setNombreProfesional("");
    recargarDatos();
  }

  async function eliminarProfesional(id) {
    const confirmar = window.confirm(
      "¿Seguro que querés eliminar este profesional?"
    );
    if (!confirmar) return;

    const { error: errorDelete } = await supabase
      .from("profesionales")
      .delete()
      .eq("id", id);

    if (errorDelete) {
      if (errorDelete.code === "23503") {
        window.alert(
          "No se puede eliminar: este profesional tiene reservas asociadas."
        );
      } else {
        window.alert("No pudimos eliminar el profesional. Probá de nuevo.");
      }
      return;
    }

    recargarDatos();
  }

  async function asignarSucursalProfesional(profesionalId, sucursalId) {
    const { error: errorUpdate } = await supabase
      .from("profesionales")
      .update({ sucursal_id: sucursalId || null })
      .eq("id", profesionalId);

    if (errorUpdate) {
      window.alert("No pudimos actualizar la sucursal de este profesional.");
      return;
    }

    setProfesionales((prev) =>
      prev.map((p) => (p.id === profesionalId ? { ...p, sucursal_id: sucursalId || null } : p))
    );
  }

  async function agregarServicio(e) {
    e.preventDefault();
    const { nombre, descripcion, precio, duracion_minutos, categoria } = nuevoServicio;

    if (!nombre.trim() || !precio || !duracion_minutos) {
      window.alert("Completá al menos nombre, precio y duración.");
      return;
    }

    setGuardandoServicio(true);
    const { error: errorInsert } = await supabase.from("servicios").insert({
      negocio_id: negocio.id,
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      precio: Number(precio),
      duracion_minutos: Number(duracion_minutos),
      categoria: categoria.trim() || null,
    });
    setGuardandoServicio(false);

    if (errorInsert) {
      window.alert("No pudimos guardar el servicio. Probá de nuevo.");
      return;
    }

    setNuevoServicio({
      nombre: "",
      descripcion: "",
      precio: "",
      duracion_minutos: "",
      categoria: "",
    });
    setFormNuevoAbierto(false);
    recargarDatos();
  }

  function comenzarEdicionServicio(servicio) {
    setEdicionServicioId(servicio.id);
    setEdicionServicio({
      nombre: servicio.nombre,
      descripcion: servicio.descripcion || "",
      precio: servicio.precio,
      duracion_minutos: servicio.duracion_minutos,
      categoria: servicio.categoria || "",
    });
  }

  function cancelarEdicionServicio() {
    setEdicionServicioId(null);
  }

  async function guardarEdicionServicio(e) {
    e.preventDefault();
    const { nombre, descripcion, precio, duracion_minutos, categoria } = edicionServicio;

    if (!nombre.trim() || !precio || !duracion_minutos) {
      window.alert("Completá al menos nombre, precio y duración.");
      return;
    }

    setGuardandoEdicionServicio(true);
    const { error: errorUpdate } = await supabase
      .from("servicios")
      .update({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        precio: Number(precio),
        duracion_minutos: Number(duracion_minutos),
        categoria: categoria.trim() || null,
      })
      .eq("id", edicionServicioId);
    setGuardandoEdicionServicio(false);

    if (errorUpdate) {
      window.alert("No pudimos guardar los cambios. Probá de nuevo.");
      return;
    }

    setEdicionServicioId(null);
    recargarDatos();
  }

  async function eliminarServicio(id) {
    const confirmar = window.confirm(
      "¿Seguro que querés eliminar este servicio?"
    );
    if (!confirmar) return;

    const { error: errorDelete } = await supabase
      .from("servicios")
      .delete()
      .eq("id", id);

    if (errorDelete) {
      if (errorDelete.code === "23503") {
        window.alert(
          "No se puede eliminar: este servicio tiene reservas asociadas."
        );
      } else {
        window.alert("No pudimos eliminar el servicio. Probá de nuevo.");
      }
      return;
    }

    recargarDatos();
  }

  function estaVinculado(servicioId, profesionalId) {
    return vinculos.some(
      (v) => v.servicio_id === servicioId && v.profesional_id === profesionalId
    );
  }

  async function alternarVinculo(servicioId, profesionalId, marcado) {
    if (marcado) {
      const { error: errorInsert } = await supabase
        .from("servicios_profesionales")
        .insert({ servicio_id: servicioId, profesional_id: profesionalId });

      if (errorInsert) {
        window.alert("No pudimos vincular el profesional a este servicio.");
        return;
      }

      setVinculos((prev) => [
        ...prev,
        { servicio_id: servicioId, profesional_id: profesionalId },
      ]);
    } else {
      const { error: errorDelete } = await supabase
        .from("servicios_profesionales")
        .delete()
        .eq("servicio_id", servicioId)
        .eq("profesional_id", profesionalId);

      if (errorDelete) {
        window.alert("No pudimos quitar el vínculo. Probá de nuevo.");
        return;
      }

      setVinculos((prev) =>
        prev.filter(
          (v) =>
            !(v.servicio_id === servicioId && v.profesional_id === profesionalId)
        )
      );
    }
  }

  if (cargando) {
    return <p className="text-sm text-[#6B6461]">Cargando...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-700">{error}</p>;
  }

  // Si algún servicio tiene categoría, se muestran agrupados (igual que las
  // pestañas que ve el cliente al reservar); si no, en una sola lista.
  const hayCategorias = servicios.some((s) => s.categoria?.trim());
  const grupos = hayCategorias
    ? Object.entries(
        servicios.reduce((acc, s) => {
          const categoria = s.categoria?.trim() || SIN_CATEGORIA;
          (acc[categoria] ||= []).push(s);
          return acc;
        }, {})
      ).sort(([a], [b]) => (a === SIN_CATEGORIA ? 1 : b === SIN_CATEGORIA ? -1 : a.localeCompare(b)))
    : [["", servicios]];

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold text-[#1E1B1A]">Equipo</h2>
        <p className="mb-3 text-sm text-[#6B6461]">
          Quiénes atienden.{sucursales.length > 0 ? " Elegí en qué sucursal trabaja cada una." : ""}
        </p>

        <ul className="mb-4 space-y-1">
          {profesionales.length === 0 && (
            <li className="text-[#6B6461] text-sm">
              Todavía no hay profesionales cargados.
            </li>
          )}
          {profesionales.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between border border-[#DCD5CE] bg-white rounded-xl px-3 py-2"
            >
              <div className="flex flex-1 items-center gap-3">
                <span>{p.nombre}</span>
                {sucursales.length > 0 && (
                  <select
                    value={p.sucursal_id || ""}
                    onChange={(e) => asignarSucursalProfesional(p.id, e.target.value)}
                    className="border border-[#DCD5CE] bg-white rounded-full px-3 py-1 text-xs text-[#5B5451] focus:border-[#1E1B1A] focus:outline-none transition"
                  >
                    <option value="">Todas las sucursales</option>
                    {sucursales.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <button
                onClick={() => eliminarProfesional(p.id)}
                className="text-red-700 text-sm hover:underline"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={agregarProfesional} className="flex gap-2">
          <input
            type="text"
            placeholder="Nombre (como lo ven tus clientes)"
            value={nombreProfesional}
            onChange={(e) => setNombreProfesional(e.target.value)}
            className="border border-[#DCD5CE] bg-white rounded-xl px-3 py-2 min-h-11 text-base focus:border-[#1E1B1A] focus:outline-none transition flex-1 min-w-0"
          />
          <button
            type="submit"
            disabled={guardandoProfesional}
            className="bg-[#1E1B1A] text-white font-semibold rounded-full px-5 min-h-11 hover:bg-black transition disabled:opacity-50"
          >
            {guardandoProfesional ? "Guardando..." : "Agregar"}
          </button>
        </form>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#1E1B1A]">Servicios</h2>
            <p className="text-sm text-[#6B6461]">Lo que tus clientes pueden reservar, y quién hace cada uno.</p>
          </div>
          {!formNuevoAbierto && (
            <button
              type="button"
              onClick={() => setFormNuevoAbierto(true)}
              className="min-h-10 rounded-full border border-[#DCD5CE] px-4 text-sm"
            >
              + Agregar servicio
            </button>
          )}
        </div>

        {formNuevoAbierto && (
        <form onSubmit={agregarServicio} className="mb-6 space-y-2 rounded-xl bg-[#F6F4F1] p-4">
          <p className="font-medium text-sm mb-1">Servicio nuevo</p>
          <input
            type="text"
            placeholder="Nombre"
            value={nuevoServicio.nombre}
            onChange={(e) =>
              setNuevoServicio({ ...nuevoServicio, nombre: e.target.value })
            }
            className="border border-[#DCD5CE] bg-white rounded-xl px-3 py-2 min-h-11 text-base focus:border-[#1E1B1A] focus:outline-none transition w-full"
          />
          <input
            type="text"
            placeholder="Descripción (opcional)"
            value={nuevoServicio.descripcion}
            onChange={(e) =>
              setNuevoServicio({ ...nuevoServicio, descripcion: e.target.value })
            }
            className="border border-[#DCD5CE] bg-white rounded-xl px-3 py-2 min-h-11 text-base focus:border-[#1E1B1A] focus:outline-none transition w-full"
          />
          <input
            type="text"
            list="categorias-existentes"
            placeholder="Categoría (opcional, ej: Manos, Pies, Combos)"
            value={nuevoServicio.categoria}
            onChange={(e) =>
              setNuevoServicio({ ...nuevoServicio, categoria: e.target.value })
            }
            className="border border-[#DCD5CE] bg-white rounded-xl px-3 py-2 min-h-11 text-base focus:border-[#1E1B1A] focus:outline-none transition w-full"
          />
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Precio ($)"
              value={nuevoServicio.precio}
              onChange={(e) =>
                setNuevoServicio({ ...nuevoServicio, precio: e.target.value })
              }
              className="border border-[#DCD5CE] bg-white rounded-xl px-3 py-2 min-h-11 text-base focus:border-[#1E1B1A] focus:outline-none transition flex-1 min-w-0"
            />
            <input
              type="number"
              step="15"
              placeholder="Duración (min)"
              value={nuevoServicio.duracion_minutos}
              onChange={(e) =>
                setNuevoServicio({
                  ...nuevoServicio,
                  duracion_minutos: e.target.value,
                })
              }
              className="border border-[#DCD5CE] bg-white rounded-xl px-3 py-2 min-h-11 text-base focus:border-[#1E1B1A] focus:outline-none transition flex-1 min-w-0"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={guardandoServicio}
              className="bg-[#1E1B1A] text-white font-semibold rounded-full px-5 min-h-11 hover:bg-black transition disabled:opacity-50"
            >
              {guardandoServicio ? "Guardando..." : "Agregar servicio"}
            </button>
            <button
              type="button"
              onClick={() => setFormNuevoAbierto(false)}
              className="min-h-11 rounded-full border border-[#DCD5CE] bg-white px-5"
            >
              Cancelar
            </button>
          </div>
        </form>
        )}
        <datalist id="categorias-existentes">
          {[...new Set(servicios.map((s) => s.categoria?.trim()).filter(Boolean))].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <div className="space-y-6">
          {servicios.length === 0 && (
            <p className="text-[#6B6461] text-sm">
              Todavía no hay servicios cargados.
            </p>
          )}
          {grupos.map(([categoria, serviciosDelGrupo]) => (
          <div key={categoria || "todos"} className="space-y-3">
          {categoria && (
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6B6461]">{categoria}</h3>
          )}
          {serviciosDelGrupo.map((s) => (
            <div key={s.id} className="border border-[#ECE6E0] bg-white rounded-xl px-4 py-3">
              {edicionServicioId === s.id ? (
                <form onSubmit={guardarEdicionServicio} className="space-y-2 mb-2">
                  <input
                    type="text"
                    placeholder="Nombre"
                    value={edicionServicio.nombre}
                    onChange={(e) =>
                      setEdicionServicio({ ...edicionServicio, nombre: e.target.value })
                    }
                    className="border border-[#DCD5CE] bg-white rounded-xl px-3 py-2 min-h-11 text-base focus:border-[#1E1B1A] focus:outline-none transition w-full"
                  />
                  <input
                    type="text"
                    placeholder="Descripción (opcional)"
                    value={edicionServicio.descripcion}
                    onChange={(e) =>
                      setEdicionServicio({ ...edicionServicio, descripcion: e.target.value })
                    }
                    className="border border-[#DCD5CE] bg-white rounded-xl px-3 py-2 min-h-11 text-base focus:border-[#1E1B1A] focus:outline-none transition w-full"
                  />
                  <input
                    type="text"
                    placeholder="Categoría (opcional, ej: Manos, Pies, Combos)"
                    list="categorias-existentes"
                    value={edicionServicio.categoria}
                    onChange={(e) =>
                      setEdicionServicio({ ...edicionServicio, categoria: e.target.value })
                    }
                    className="border border-[#DCD5CE] bg-white rounded-xl px-3 py-2 min-h-11 text-base focus:border-[#1E1B1A] focus:outline-none transition w-full"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Precio"
                      value={edicionServicio.precio}
                      onChange={(e) =>
                        setEdicionServicio({ ...edicionServicio, precio: e.target.value })
                      }
                      className="border border-[#DCD5CE] bg-white rounded-xl px-3 py-2 min-h-11 text-base focus:border-[#1E1B1A] focus:outline-none transition flex-1 min-w-0"
                    />
                    <input
                      type="number"
                      placeholder="Duración (min)"
                      value={edicionServicio.duracion_minutos}
                      onChange={(e) =>
                        setEdicionServicio({
                          ...edicionServicio,
                          duracion_minutos: e.target.value,
                        })
                      }
                      className="border border-[#DCD5CE] bg-white rounded-xl px-3 py-2 min-h-11 text-base focus:border-[#1E1B1A] focus:outline-none transition flex-1 min-w-0"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={guardandoEdicionServicio}
                      className="bg-[#1E1B1A] text-white font-semibold rounded-full px-4 min-h-10 text-sm hover:bg-black transition disabled:opacity-50"
                    >
                      {guardandoEdicionServicio ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelarEdicionServicio}
                      className="text-sm text-[#6B6461] hover:underline"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="font-medium">{s.nombre}</p>
                    <p className="text-sm text-[#3B3532]">
                      {formatearPrecio(s.precio)} · {formatearDuracion(s.duracion_minutos)}
                    </p>
                    {s.descripcion && <p className="text-sm text-[#6B6461]">{s.descripcion}</p>}
                  </div>
                  <div className="flex shrink-0 gap-3">
                    <button
                      onClick={() => comenzarEdicionServicio(s)}
                      className="text-sm hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => eliminarServicio(s.id)}
                      className="text-red-700 text-sm hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              )}

              {profesionales.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                  <span className="text-sm text-[#6B6461]">Lo hacen:</span>
                  {profesionales.map((p) => (
                    <label
                      key={p.id}
                      className="flex min-h-9 items-center gap-1.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#1E1B1A]"
                        checked={estaVinculado(s.id, p.id)}
                        onChange={(e) =>
                          alternarVinculo(s.id, p.id, e.target.checked)
                        }
                      />
                      {p.nombre}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
          </div>
          ))}
        </div>
      </section>
    </div>
  );
}
