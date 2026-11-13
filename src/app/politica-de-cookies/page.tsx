import type { Metadata } from 'next'
import { t } from '@/i18n'

export const metadata: Metadata = {
  title: t('cookiePolicy.metaTitle'),
}

const H2 = 'mt-8 text-xl font-semibold'
const CELL = 'border border-neutral-200 p-2 align-top dark:border-neutral-800'

export default function CookiePolicyPage() {
  return (
    <article className="max-w-3xl text-sm leading-relaxed">
      <h1 className="mb-6 text-2xl font-bold">{t('cookiePolicy.title')}</h1>

      <p>
        Las cookies y tecnologías parecidas (como el almacenamiento local del navegador) son pequeños datos que una
        web guarda en tu dispositivo. En DirectoRadio usamos solo los que se explican aquí.
      </p>

      <h2 className={H2}>Técnicas (siempre activas)</h2>
      <p>Son necesarias para que la web funcione y no requieren tu consentimiento.</p>
      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr>
            <th className={CELL}>Nombre</th>
            <th className={CELL}>Para qué sirve</th>
            <th className={CELL}>Duración</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={CELL}>
              <code>dr.session</code> (sessionStorage)
            </td>
            <td className={CELL}>
              Identificador anónimo de la sesión, para contar una sola reproducción por emisora y sesión.
            </td>
            <td className={CELL}>Hasta que cierras la pestaña.</td>
          </tr>
          <tr>
            <td className={CELL}>
              <code>dr.consent</code> (localStorage)
            </td>
            <td className={CELL}>Recuerda si has aceptado o rechazado la analítica, y cuándo.</td>
            <td className={CELL}>12 meses. Después te lo volvemos a preguntar.</td>
          </tr>
        </tbody>
      </table>

      <h2 className={H2}>Analítica (solo si la aceptas)</h2>
      <p>
        Usamos Google Analytics, cargado mediante Google Tag Manager, para obtener estadísticas de uso: qué páginas
        se visitan y cómo se llega a ellas. Estas cookies solo se instalan si pulsas «Aceptar» en el aviso de
        cookies. Su proveedor es Google. Mientras no aceptes, o si rechazas, Google puede recibir avisos de visita
        sin cookies ni identificadores (por ejemplo, que se ha visto una página), que no permiten reconocerte en
        visitas posteriores.
      </p>
      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr>
            <th className={CELL}>Nombre</th>
            <th className={CELL}>Para qué sirve</th>
            <th className={CELL}>Duración</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={CELL}>
              <code>_ga</code>
            </td>
            <td className={CELL}>Distingue a visitantes de forma anónima.</td>
            <td className={CELL}>Hasta 2 años.</td>
          </tr>
          <tr>
            <td className={CELL}>
              <code>_ga_*</code>
            </td>
            <td className={CELL}>Mantiene el estado de la sesión de analítica.</td>
            <td className={CELL}>Hasta 2 años.</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3">No usamos cookies de publicidad.</p>

      <h2 className={H2}>Cómo cambiar tu elección</h2>
      <p>
        Puedes cambiar de opinión cuando quieras con el enlace «Configurar cookies» del pie de la página. Si
        retiras el consentimiento, dejamos de usar cookies de analítica, pero las cookies <code>_ga</code> que ya
        estuvieran instaladas siguen en tu navegador hasta que caducan o las borras tú desde su configuración (en la
        mayoría de navegadores: Configuración → Privacidad → Cookies y datos de sitios).
      </p>

      <h2 className={H2}>Responsable</h2>
      <p>Los datos del responsable de la web y la forma de contacto figurarán en el aviso legal.</p>
    </article>
  )
}
