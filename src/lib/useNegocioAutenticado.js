"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// Hook compartido por todas las pantallas del panel de administración:
// maneja la sesión de Supabase Auth y busca el negocio asociado al usuario
// logueado (por owner_id). Simplificación actual: un negocio por usuario.
export function useNegocioAutenticado() {
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [sesion, setSesion] = useState(null);

  const [negocio, setNegocio] = useState(null);
  const [cargandoNegocio, setCargandoNegocio] = useState(false);
  const [errorNegocio, setErrorNegocio] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargandoSesion(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSesion(nuevaSesion);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Si no hay sesión no hay nada que cargar; las pantallas muestran el
    // login en ese caso y este estado queda sin usar.
    if (!sesion) return;

    async function cargarNegocio() {
      setCargandoNegocio(true);
      setErrorNegocio(null);

      const { data, error } = await supabase
        .from("negocios")
        .select("*")
        .eq("owner_id", sesion.user.id)
        .maybeSingle();

      setCargandoNegocio(false);

      if (error) {
        console.error("Error cargando negocio:", error);
        setErrorNegocio("No pudimos cargar tu negocio.");
        return;
      }

      if (!data) {
        setErrorNegocio("Este usuario no tiene un negocio asociado todavía.");
        return;
      }

      setNegocio(data);
    }

    cargarNegocio();
  }, [sesion]);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
  };

  return {
    cargandoSesion,
    sesion,
    negocio,
    setNegocio,
    cargandoNegocio,
    errorNegocio,
    cerrarSesion,
  };
}
