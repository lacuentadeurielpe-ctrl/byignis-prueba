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
          <h2 className="text-xl font-bold text-white mb-4">5. Propiedad Intelectual</h2>
          <p className="mb-4">
            El código fuente, diseño, logotipo, y estructura de Uintegrus son propiedad exclusiva de la empresa matriz. Se prohíbe terminantemente la copia, ingeniería inversa o reproducción no autorizada del software.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">6. Limitación de Responsabilidad</h2>
          <p className="mb-4">
            Aunque nos esforzamos por mantener un tiempo de actividad (uptime) del 99.9%, el Servicio se proporciona "tal cual". Uintegrus no será responsable de interrupciones temporales causadas por fallas de los proveedores de nube, ataques de terceros, ni de la pérdida indirecta de beneficios que el usuario pudiera alegar.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">7. Modificaciones a los Términos</h2>
          <p>
            Nos reservamos el derecho de modificar estos Términos en cualquier momento. Los cambios sustanciales serán notificados a través de la plataforma o por correo electrónico. El uso continuado del Servicio constituye la aceptación de dichos cambios.
          </p>
        </section>
      </div>
    </div>
  )
}
