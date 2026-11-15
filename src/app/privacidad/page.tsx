import type { Metadata } from 'next'
import Link from 'next/link'
import { OWNER } from '@/legal/owner'

export const metadata: Metadata = { title: 'Política de privacidad · DirectoRadio' }

const H2 = 'mt-8 text-xl font-semibold'
const CELL = 'border border-neutral-200 p-2 align-top dark:border-neutral-800'

export default function PrivacidadPage() {
  return (
    <article className="flex max-w-3xl flex-col gap-3 text-sm leading-relaxed">
      <h1 className="mb-3 text-2xl font-bold">Política de privacidad</h1>

      <h2 className={H2}>Responsable</h2>
      <p>
        {OWNER.name} (NIF {OWNER.nif}), {OWNER.address}. Contacto:{' '}
        <a href={`mailto:${OWNER.email}`} className="underline">{OWNER.email}</a>.
      </p>

      <h2 className={H2}>Qué datos tratamos y para qué</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={CELL}>Datos</th>
            <th className={CELL}>Para qué</th>
            <th className={CELL}>Base jurídica</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={CELL}>Email, valoración (estrellas) y fecha en que aceptas esta política</td>
            <td className={CELL}>Verificar tu valoración y evitar que un mismo email vote varias veces la misma emisora</td>
            <td className={CELL}>Tu consentimiento, al marcar la casilla y confirmar el email</td>
          </tr>
          <tr>
            <td className={CELL}>Dirección IP seudonimizada (un resumen con clave secreta; no guardamos la IP)</td>
            <td className={CELL}>Limitar abusos: votos y reproducciones repetidos en poco tiempo</td>
            <td className={CELL}>Interés legítimo en proteger el servicio</td>
          </tr>
          <tr>
            <td className={CELL}>Dirección IP y datos técnicos del navegador, enviados a Cloudflare</td>
            <td className={CELL}>Comprobar con Cloudflare Turnstile que quien valora no es un robot. No los guardamos nosotros</td>
            <td className={CELL}>Interés legítimo en proteger el servicio</td>
          </tr>
          <tr>
            <td className={CELL}>Identificador anónimo de sesión de reproducción</td>
            <td className={CELL}>Contar una sola reproducción por emisora y sesión</td>
            <td className={CELL}>Interés legítimo; no te identifica</td>
          </tr>
          <tr>
            <td className={CELL}>Datos de navegación de Google Analytics</td>
            <td className={CELL}>Estadísticas de uso de la web</td>
            <td className={CELL}>Tu consentimiento en el aviso de cookies</td>
          </tr>
        </tbody>
      </table>
      <p>No publicamos tu email, no lo usamos para enviarte publicidad ni lo cedemos a terceros.</p>

      <h2 className={H2}>Cuánto tiempo los conservamos</h2>
      <p>Los plazos se aplican en la limpieza diaria automática, así que un dato puede durar hasta un día más.</p>
      <ul className="list-disc pl-6">
        <li>Valoraciones sin confirmar: 7 días.</li>
        <li>Registro de intentos de valoración (email e IP seudonimizada): 48 horas.</li>
        <li>IP seudonimizada de las valoraciones: 35 días.</li>
        <li>IP seudonimizada de las reproducciones: 35 días.</li>
        <li>
          Valoraciones confirmadas y tu email verificado: mientras la web exista o hasta que pidas su borrado. Tu email
          verificado se conserva aunque la emisora que valoraste desaparezca del catálogo.
        </li>
        <li>Analítica: el plazo de conservación configurado en Google Analytics.</li>
      </ul>

      <h2 className={H2}>Quién nos ayuda a tratarlos (encargados del tratamiento)</h2>
      <ul className="list-disc pl-6">
        <li>
          Brevo (Sendinblue SAS, Francia): envío del email de confirmación. Datos alojados en la UE. Brevo conserva sus
          propios registros de envío (destinatario y fecha) según su política; si pides el borrado, también los
          eliminamos de Brevo.
        </li>
        <li>Neon (base de datos, alojada en Fráncfort, Alemania).</li>
        <li>Vercel Inc. (alojamiento de la web, región de Fráncfort).</li>
        <li>Fly.io (proxy de audio y tareas programadas, región de Fráncfort).</li>
        <li>Cloudflare Inc. (DNS y comprobación anti-robots Turnstile, que recibe tu dirección IP y datos técnicos del navegador).</li>
        <li>Google Ireland Ltd. (analítica, solo si la aceptas).</li>
      </ul>
      <p>
        Algunos de estos proveedores son empresas de Estados Unidos o pueden acceder a datos desde allí. Esas
        transferencias se amparan en el Marco de Privacidad de Datos UE-EE. UU. o en las cláusulas contractuales tipo
        aprobadas por la Comisión Europea.
      </p>

      <h2 className={H2}>Tus derechos</h2>
      <p>
        Puedes pedir el acceso, la rectificación o el borrado de tus datos, oponerte a su tratamiento, limitarlo o
        solicitar su portabilidad, y retirar tu consentimiento en cualquier momento, escribiendo a {OWNER.email} desde
        el email afectado. Te responderemos en un mes como máximo. Si crees que no hemos atendido bien tu petición,
        puedes reclamar ante la Agencia Española de Protección de Datos (
        <a href="https://www.aepd.es" className="underline">www.aepd.es</a>).
      </p>

      <h2 className={H2}>Cookies</h2>
      <p>
        Consulta la <Link href="/politica-de-cookies" className="underline">política de cookies</Link>.
      </p>

      <p className="mt-8 text-neutral-500">Última actualización: 14 de noviembre de 2026.</p>
    </article>
  )
}
