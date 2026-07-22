/**
 * Términos y Condiciones.
 *
 * ⚠️ PENDIENTE DE REVISIÓN LEGAL PROFESIONAL.
 * Las secciones 6, 7 y 8 (Contenido del Usuario, Notificación y Retiro,
 * Indemnidad) se redactaron para cubrir el riesgo de que un cliente suba
 * material protegido por derechos de autor a su catálogo público. Están
 * basadas en el marco peruano (D. Leg. 822 — Derecho de Autor, INDECOPI),
 * NO en la DMCA estadounidense. Deben ser revisadas por un abogado peruano
 * antes de considerarse una protección legal definitiva.
 */
export default function TerminosPage() {
  return (
    <div className="text-zinc-300">
      <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-8 tracking-tight">Términos y Condiciones de Uso</h1>

      <div className="space-y-8 leading-relaxed">
        <section>
          <p className="text-sm text-zinc-500 mb-6">Última actualización: Julio 2026</p>
          <p>
            Bienvenido a <strong>Uintegrus</strong>. Al acceder y utilizar nuestra plataforma de software (en adelante, el "Servicio"), usted acepta estar sujeto a los siguientes Términos y Condiciones. Si no está de acuerdo con alguna parte de estos términos, no debe utilizar nuestro Servicio.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">1. Descripción del Servicio</h2>
          <p className="mb-4">
            Uintegrus provee un software de gestión para PYMES que incluye facturación electrónica, control de inventario, gestión de sucursales y herramientas de venta directa. El Servicio se ofrece bajo un modelo de suscripción o pago directo, alojado en la nube y accesible vía web.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">2. Uso de la Cuenta y Seguridad</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Usted es responsable de mantener la confidencialidad de sus credenciales de acceso.</li>
            <li>Debe proporcionar información veraz, precisa y actualizada al momento de registrarse.</li>
            <li>Uintegrus no se hará responsable por cualquier pérdida o daño que resulte del incumplimiento de esta obligación de seguridad.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">3. Facturación Electrónica (SUNAT)</h2>
          <p className="mb-4">
            Para los usuarios en Perú, la emisión de comprobantes de pago electrónicos está sujeta a las normativas de la SUNAT. Uintegrus actúa como facilitador tecnológico, pero es exclusiva responsabilidad del usuario verificar la validez tributaria de sus operaciones y mantener su RUC en estado Activo y Habido.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">4. Pagos y Suscripciones</h2>
          <p className="mb-4">
            El acceso a la plataforma requiere el pago de las tarifas vigentes (por ejemplo, el pago fijo de S/ 80). No existen contratos de permanencia a largo plazo, salvo que se estipule expresamente en una oferta particular. En caso de falta de pago, Uintegrus se reserva el derecho de suspender o cancelar el acceso a la cuenta.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">5. Propiedad Intelectual de Uintegrus</h2>
          <p className="mb-4">
            El código fuente, diseño, logotipo, y estructura de Uintegrus son propiedad exclusiva de la empresa matriz. Se prohíbe terminantemente la copia, ingeniería inversa o reproducción no autorizada del software. Esta sección se refiere únicamente a los elementos propios de la plataforma; el contenido que usted publica se rige por la sección 6.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">6. Contenido del Usuario</h2>
          <p className="mb-4">
            Se entiende por "Contenido del Usuario" todo material que usted cargue, publique o almacene en el Servicio, incluyendo fotografías e imágenes de productos, logotipos, descripciones, catálogos, listas de precios y datos de sus propios clientes.
          </p>
          <p className="mb-4">
            <strong className="text-white">Usted conserva la titularidad de su Contenido.</strong> Uintegrus no reclama propiedad alguna sobre el mismo. Usted nos otorga únicamente una licencia limitada, no exclusiva y revocable para almacenar, reproducir y mostrar dicho Contenido con el único fin de prestarle el Servicio, lo que incluye su exhibición pública cuando usted decide activar su catálogo o tienda en línea.
          </p>
          <p className="mb-4">
            <strong className="text-white">Al cargar Contenido, usted declara y garantiza que:</strong>
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Es titular de los derechos sobre dicho Contenido, o cuenta con autorización o licencia vigente del titular para usarlo y publicarlo.</li>
            <li>Su publicación no infringe derechos de autor, marcas, derecho a la imagen, secretos empresariales ni ningún otro derecho de terceros.</li>
            <li>El Contenido no es ilícito, engañoso, difamatorio ni contrario a las normas aplicables, incluidas las de protección al consumidor.</li>
            <li>Si el Contenido incluye datos personales de terceros, usted cuenta con la base legal para tratarlos conforme a la Ley N° 29733, Ley de Protección de Datos Personales.</li>
          </ul>
          <p className="mb-4">
            Uintegrus actúa como proveedor de infraestructura tecnológica y no revisa, edita ni supervisa de forma previa el Contenido del Usuario. La responsabilidad por el Contenido publicado recae exclusivamente en el usuario que lo carga.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">7. Infracción de Derechos de Autor: Notificación y Retiro</h2>
          <p className="mb-4">
            Uintegrus respeta los derechos de propiedad intelectual y espera lo mismo de sus usuarios. Si usted considera que contenido alojado en la plataforma infringe sus derechos, puede notificarlo a{' '}
            <a href="mailto:admin@uintegrus.com" className="text-blue-400 hover:text-blue-300 underline">admin@uintegrus.com</a>{' '}
            incluyendo:
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Identificación de la obra o derecho presuntamente infringido.</li>
            <li>Ubicación precisa del contenido dentro de la plataforma (enlace o dirección web).</li>
            <li>Sus datos de contacto: nombre completo o razón social, documento de identidad o RUC, correo y teléfono.</li>
            <li>Una declaración de que actúa de buena fe y de que la información proporcionada es veraz, así como acreditación de su titularidad o representación.</li>
          </ul>
          <p className="mb-4">
            Recibida una notificación válida, Uintegrus podrá <strong className="text-white">retirar o deshabilitar el acceso al contenido señalado, sin necesidad de aviso previo</strong>, e informará de ello al usuario afectado, quien podrá presentar los descargos y la documentación que acredite su derecho de uso. Si el usuario acredita su titularidad o autorización, el contenido podrá ser restituido.
          </p>
          <p className="mb-4">
            Uintegrus se reserva el derecho de <strong className="text-white">suspender o cancelar de forma definitiva</strong> las cuentas de usuarios que incurran de manera reiterada en infracciones a derechos de terceros, sin derecho a reembolso de los pagos ya efectuados.
          </p>
          <p className="mb-4">
            Lo anterior se establece sin perjuicio de las acciones que el titular afectado pueda ejercer directamente contra el usuario infractor ante la Comisión de Derecho de Autor del INDECOPI o ante la autoridad judicial competente, conforme al Decreto Legislativo N° 822, Ley sobre el Derecho de Autor.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">8. Indemnidad</h2>
          <p className="mb-4">
            Usted se obliga a mantener indemne a Uintegrus, sus representantes y colaboradores frente a cualquier reclamo, denuncia, procedimiento administrativo o demanda presentada por un tercero que se origine en el Contenido que usted publique, en el uso que dé al Servicio o en el incumplimiento de estos Términos.
          </p>
          <p className="mb-4">
            Dicha obligación comprende los montos de eventuales multas, indemnizaciones, costos y costas, así como los honorarios de defensa legal en que Uintegrus deba incurrir como consecuencia de tales reclamos.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">9. Limitación de Responsabilidad</h2>
          <p className="mb-4">
            Aunque nos esforzamos por mantener un tiempo de actividad (uptime) del 99.9%, el Servicio se proporciona "tal cual". Uintegrus no será responsable de interrupciones temporales causadas por fallas de los proveedores de nube, ataques de terceros, ni de la pérdida indirecta de beneficios que el usuario pudiera alegar.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">10. Modificaciones a los Términos</h2>
          <p>
            Nos reservamos el derecho de modificar estos Términos en cualquier momento. Los cambios sustanciales serán notificados a través de la plataforma o por correo electrónico. El uso continuado del Servicio constituye la aceptación de dichos cambios.
          </p>
        </section>
      </div>
    </div>
  )
}
