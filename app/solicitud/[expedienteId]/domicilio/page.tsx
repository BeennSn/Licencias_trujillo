"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StepIndicator } from "@/components/wizard/StepIndicator";
import { encontrarDistritoTrujillo } from "@/lib/distritosTrujillo";
import { GIROS_ACTIVIDAD, GIRO_OTRO } from "@/lib/girosActividad";
import { pasoPorDefecto } from "@/lib/wizardPasos";
import { ESTADOS_QUE_PERMITEN_EDITAR_DOMICILIO } from "@/lib/estadosExpediente";
import type { EstadoExpediente } from "@/lib/estadosExpediente";

type DireccionSugerida = { distrito: string; direccion: string };

export default function PasoDomicilio() {
  const { expedienteId } = useParams<{ expedienteId: string }>();
  const router = useRouter();
  const { data: sesion } = useSession();
  const panelDeRetorno = sesion?.user?.rol === "cajero" ? "/cajero" : "/";

  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [domicilioBloqueado, setDomicilioBloqueado] = useState<{
    distrito: string;
    direccionLocal: string;
    giroActividad: string;
    nombreComercial: string;
    representanteLegalNombre: string;
    representanteLegalDni: string;
    emailContacto: string;
    telefonoContacto: string;
    siguientePaso: string;
    editable: boolean;
  } | null>(null);

  // Sin ninguna dirección de SUNAT no hay nada que ofrecer: ya no se acepta
  // carga manual de domicilio (ver instrucción del cliente).
  const [sinDireccionesSunat, setSinDireccionesSunat] = useState(false);

  const [sugerencias, setSugerencias] = useState<DireccionSugerida[]>([]);
  const [direccionElegida, setDireccionElegida] = useState<number | null>(null);

  const [distrito, setDistrito] = useState("");
  const [direccionLocal, setDireccionLocal] = useState("");
  const [giroSeleccionado, setGiroSeleccionado] = useState("");
  const [giroOtro, setGiroOtro] = useState("");
  const [nombreComercial, setNombreComercial] = useState("");
  const [representanteLegalNombre, setRepresentanteLegalNombre] = useState("");
  const [representanteLegalDni, setRepresentanteLegalDni] = useState("");
  // Si consultasPeru.ts encuentra un representante, el dato queda fijo (no
  // editable) igual que distrito/dirección — solo se deja editable cuando
  // no se pudo autocompletar, para que el negocio lo complete a mano.
  const [representanteAutocompletado, setRepresentanteAutocompletado] = useState(false);
  const [emailContacto, setEmailContacto] = useState("");
  const [telefonoContacto, setTelefonoContacto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    fetch(`/api/solicitudes/${expedienteId}`)
      .then((r) => r.json())
      .then((datos) => {
        // Las sugerencias de SUNAT se cargan siempre (incluso si el
        // domicilio ya está guardado), para poder volver a elegir una
        // dirección distinta al corregir un error.
        const lista: DireccionSugerida[] = datos.negocio?.direccionesTrujillo ?? [];
        setSugerencias(lista);

        if (datos.expediente?.distrito) {
          // El domicilio queda fijo apenas se guarda, pero sigue siendo
          // editable mientras el expediente no haya pasado el pago (ver
          // ESTADOS_QUE_PERMITEN_EDITAR_DOMICILIO) — así se puede corregir
          // un error sin tener que iniciar un trámite nuevo.
          setDomicilioBloqueado({
            distrito: datos.expediente.distrito ?? "",
            direccionLocal: datos.expediente.direccionLocal ?? "",
            giroActividad: datos.expediente.giroActividad ?? "",
            nombreComercial: datos.expediente.nombreComercial ?? "",
            representanteLegalNombre: datos.expediente.representanteLegalNombre ?? "",
            representanteLegalDni: datos.expediente.representanteLegalDni ?? "",
            emailContacto: datos.expediente.emailContacto ?? "",
            telefonoContacto: datos.expediente.telefonoContacto ?? "",
            siguientePaso: pasoPorDefecto(datos.expediente),
            editable: ESTADOS_QUE_PERMITEN_EDITAR_DOMICILIO.includes(
              datos.expediente.estado as EstadoExpediente
            ),
          });
          setCargandoInicial(false);
          return;
        }

        if (lista.length === 0) setSinDireccionesSunat(true);
        setCargandoInicial(false);

        // Autocompletar representante legal (ver lib/consultasPeru.ts): nunca
        // bloquea nada si no se encuentra, el negocio lo completa a mano.
        const ruc: string | undefined = datos.negocio?.ruc;
        if (ruc) {
          fetch(`/api/ruc/representante?ruc=${ruc}`)
            .then((r) => r.json())
            .then((datosRepresentante) => {
              if (datosRepresentante.representante) {
                setRepresentanteLegalNombre(datosRepresentante.representante.nombre);
                setRepresentanteLegalDni(datosRepresentante.representante.dni);
                setRepresentanteAutocompletado(true);
              }
            })
            .catch(() => {});
        }
      });
  }, [expedienteId]);

  // Pasa del resumen fijo al formulario editable, precargado con lo que ya
  // se había guardado, para corregir un error sin perder los demás datos.
  function iniciarEdicion() {
    if (!domicilioBloqueado) return;

    setDistrito(domicilioBloqueado.distrito);
    setDireccionLocal(domicilioBloqueado.direccionLocal);
    setNombreComercial(domicilioBloqueado.nombreComercial);
    setRepresentanteLegalNombre(domicilioBloqueado.representanteLegalNombre);
    setRepresentanteLegalDni(domicilioBloqueado.representanteLegalDni);
    // El representante legal no se vuelve a habilitar para editar: es un
    // dato oficial (de SUNAT o ya guardado), no algo que se corrija a mano.
    setRepresentanteAutocompletado(true);
    setEmailContacto(domicilioBloqueado.emailContacto);
    setTelefonoContacto(domicilioBloqueado.telefonoContacto);

    if ((GIROS_ACTIVIDAD as readonly string[]).includes(domicilioBloqueado.giroActividad)) {
      setGiroSeleccionado(domicilioBloqueado.giroActividad);
      setGiroOtro("");
    } else {
      setGiroSeleccionado(GIRO_OTRO);
      setGiroOtro(domicilioBloqueado.giroActividad);
    }

    const indiceCoincidente = sugerencias.findIndex(
      (s) => s.distrito === domicilioBloqueado.distrito && s.direccion === domicilioBloqueado.direccionLocal
    );
    setDireccionElegida(indiceCoincidente >= 0 ? indiceCoincidente : -1);

    setDomicilioBloqueado(null);
  }

  function elegirSugerencia(indice: number) {
    const sugerencia = sugerencias[indice];
    setDireccionElegida(indice);
    setDistrito(encontrarDistritoTrujillo(sugerencia.distrito) ?? "");
    setDireccionLocal(sugerencia.direccion);
  }

  async function manejarEnvio(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    const giroActividad = giroSeleccionado === GIRO_OTRO ? giroOtro.trim() : giroSeleccionado;
    if (!giroActividad) {
      setError("Indica el giro o actividad económica del negocio.");
      return;
    }

    if (!/^9\d{8}$/.test(telefonoContacto)) {
      setError("Ingresa un celular peruano válido: 9 dígitos, empieza con 9.");
      return;
    }

    if (!/^\d{8}$/.test(representanteLegalDni)) {
      setError("El DNI del representante legal debe tener 8 dígitos.");
      return;
    }

    setCargando(true);

    const respuesta = await fetch(`/api/solicitudes/${expedienteId}/domicilio`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        distrito,
        direccionLocal,
        giroActividad,
        emailContacto,
        telefonoContacto,
        nombreComercial,
        representanteLegalNombre,
        representanteLegalDni,
      }),
    });

    const datos = await respuesta.json();
    setCargando(false);

    if (!respuesta.ok) {
      setError(datos.error ?? "No se pudo guardar el domicilio.");
      return;
    }

    router.push(`/solicitud/${expedienteId}/documentos`);
  }

  if (cargandoInicial) {
    return (
      <main className="flex-1 flex items-center justify-center px-4 py-16 bg-gray-50">
        <p className="text-sm text-gray-500">Cargando...</p>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16 bg-gray-50">
      <div className="w-full max-w-lg">
        <StepIndicator pasoActual={2} />
        <Card className="space-y-6">
          <Link href={panelDeRetorno} className="text-xs text-gray-500 hover:underline">
            ← {sesion?.user?.rol === "cajero" ? "Volver al panel principal" : "Volver al inicio"}
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Domicilio fiscal y del local</h1>
            <p className="text-sm text-gray-500">
              Solo se atienden trámites de negocios ubicados en la Provincia de Trujillo.
            </p>
          </div>

          {domicilioBloqueado ? (
            <div className="space-y-4">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-1 text-sm">
                <p className="text-xs text-gray-500 mb-2">
                  {domicilioBloqueado.editable
                    ? "Estos son los datos que guardaste. Puedes corregirlos si hubo un error."
                    : "Este paso ya quedó completado y no se puede modificar."}
                </p>
                <p><span className="font-medium">Distrito:</span> {domicilioBloqueado.distrito}</p>
                <p><span className="font-medium">Dirección:</span> {domicilioBloqueado.direccionLocal}</p>
                <p><span className="font-medium">Giro:</span> {domicilioBloqueado.giroActividad}</p>
                <p><span className="font-medium">Nombre comercial:</span> {domicilioBloqueado.nombreComercial}</p>
                <p><span className="font-medium">Representante legal:</span> {domicilioBloqueado.representanteLegalNombre} (DNI {domicilioBloqueado.representanteLegalDni})</p>
              </div>
              <Button
                onClick={() => router.push(`/solicitud/${expedienteId}/${domicilioBloqueado.siguientePaso}`)}
                className="w-full"
              >
                Continuar
              </Button>
              {domicilioBloqueado.editable && (
                <button
                  type="button"
                  onClick={iniciarEdicion}
                  className="w-full text-center text-sm text-blue-700 hover:underline"
                >
                  Editar estos datos
                </button>
              )}
            </div>
          ) : sinDireccionesSunat ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
              SUNAT no tiene ninguna dirección registrada en la Provincia de Trujillo para este RUC (ni domicilio
              fiscal ni local anexo). Actualiza tu domicilio fiscal o registra el local como anexo ante SUNAT y
              vuelve a intentarlo.
            </p>
          ) : (
            <>
              {direccionElegida === null && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-800">
                    SUNAT tiene estas direcciones registradas para tu RUC en Trujillo. Elige la que corresponde a
                    este local:
                  </p>
                  <div className="space-y-2">
                    {sugerencias.map((sugerencia, indice) => (
                      <button
                        key={indice}
                        type="button"
                        onClick={() => elegirSugerencia(indice)}
                        className="w-full text-left border border-gray-300 hover:border-blue-500 hover:bg-blue-50 rounded-md px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{sugerencia.distrito}</span> — {sugerencia.direccion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {direccionElegida !== null && (
                <form onSubmit={manejarEnvio} className="space-y-4">
                  {sugerencias.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setDireccionElegida(null)}
                      className="text-xs text-blue-700 hover:underline"
                    >
                      ← Elegir otra dirección de la lista
                    </button>
                  )}

                  <Input label="Distrito" value={distrito} readOnly />

                  <Input label="Dirección del local" value={direccionLocal} readOnly />

                  <Select
                    label="Giro / actividad económica"
                    required
                    value={giroSeleccionado}
                    onChange={(e) => setGiroSeleccionado(e.target.value)}
                  >
                    <option value="">Selecciona un giro</option>
                    {GIROS_ACTIVIDAD.map((giro) => (
                      <option key={giro} value={giro}>{giro}</option>
                    ))}
                    <option value={GIRO_OTRO}>Otro (especificar)</option>
                  </Select>

                  {giroSeleccionado === GIRO_OTRO && (
                    <Input
                      label="Especifica el giro"
                      required
                      value={giroOtro}
                      onChange={(e) => setGiroOtro(e.target.value)}
                    />
                  )}

                  <Input
                    label="Nombre comercial del local"
                    required
                    value={nombreComercial}
                    onChange={(e) => setNombreComercial(e.target.value)}
                  />

                  <Input
                    label="Nombre del representante legal"
                    required
                    readOnly={representanteAutocompletado}
                    value={representanteLegalNombre}
                    onChange={(e) => setRepresentanteLegalNombre(e.target.value)}
                  />

                  <Input
                    label="DNI del representante legal"
                    inputMode="numeric"
                    maxLength={8}
                    required
                    readOnly={representanteAutocompletado}
                    value={representanteLegalDni}
                    onChange={(e) => setRepresentanteLegalDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  />

                  <Input
                    label="Correo de contacto"
                    type="email"
                    required
                    value={emailContacto}
                    onChange={(e) => setEmailContacto(e.target.value)}
                  />

                  <Input
                    label="Teléfono de contacto (Perú, +51)"
                    placeholder="987654321"
                    inputMode="numeric"
                    maxLength={9}
                    required
                    value={telefonoContacto}
                    onChange={(e) => setTelefonoContacto(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  />

                  {error && <p className="text-sm text-red-600">{error}</p>}

                  <Button type="submit" disabled={cargando} className="w-full">
                    {cargando ? "Guardando..." : "Continuar"}
                  </Button>
                </form>
              )}
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
