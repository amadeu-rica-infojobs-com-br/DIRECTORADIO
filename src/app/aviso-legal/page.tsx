import type { Metadata } from 'next'
import Link from 'next/link'
import { OWNER } from '@/legal/owner'

export const metadata: Metadata = { title: 'Aviso legal · DirectoRadio' }

const H2 = 'mt-8 text-xl font-semibold'

export default function AvisoLegalPage() {
  return (
    <article className="flex max-w-3xl flex-col gap-3 text-sm leading-relaxed">
      <h1 className="mb-3 text-2xl font-bold">Aviso legal</h1>

      <h2 className={H2}>Titular de la web</h2>
      <p>
        En cumplimiento de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico
        (LSSI), te informamos de que el titular de {OWNER.domain} es:
      </p>
      <ul className="list-disc pl-6">
        <li>Nombre: {OWNER.name}</li>
        <li>NIF: {OWNER.nif}</li>
        <li>Domicilio: {OWNER.address}</li>
        <li>
          Email de contacto: <a href={`mailto:${OWNER.email}`} className="underline">{OWNER.email}</a>
        </li>
      </ul>

      <h2 className={H2}>Objeto</h2>
      <p>
        DirectoRadio es un directorio gratuito para descubrir y escuchar emisoras de radio online de todo el mundo.
        La web no emite contenido propio: enlaza y reproduce las emisiones que publican las propias emisoras.
      </p>

      <h2 className={H2}>Condiciones de uso</h2>
      <p>
        El uso de la web es gratuito y atribuye la condición de usuario. Te comprometes a usarla de forma lícita y a no
        intentar alterar su funcionamiento, saturarla o usarla para fines distintos de escuchar y valorar emisoras. Las
        valoraciones deben reflejar tu opinión real; podemos retirar las que sean fraudulentas o abusivas.
      </p>

      <h2 className={H2}>Propiedad intelectual</h2>
      <p>
        Los nombres, logotipos y marcas de las emisoras pertenecen a sus respectivos titulares y se muestran solo para
        identificarlas. Los datos del catálogo proceden de Radio-Browser, una base de datos abierta y colaborativa. El
        diseño, el código y los textos propios de DirectoRadio pertenecen a su titular.
      </p>

      <h2 className={H2}>Responsabilidad</h2>
      <p>
        Las emisiones son responsabilidad de cada emisora. DirectoRadio no controla su contenido ni garantiza que estén
        disponibles en todo momento, y comprueba periódicamente que funcionan para ocultar las que no responden. Si
        crees que un contenido vulnera tus derechos, escríbenos a {OWNER.email} y lo revisaremos.
      </p>

      <h2 className={H2}>Protección de datos y cookies</h2>
      <p>
        Consulta la <Link href="/privacidad" className="underline">política de privacidad</Link> y la{' '}
        <Link href="/politica-de-cookies" className="underline">política de cookies</Link>.
      </p>

      <h2 className={H2}>Legislación aplicable</h2>
      <p>Este aviso legal se rige por la legislación española.</p>

      <p className="mt-8 text-neutral-500">Última actualización: 14 de noviembre de 2026.</p>
    </article>
  )
}
