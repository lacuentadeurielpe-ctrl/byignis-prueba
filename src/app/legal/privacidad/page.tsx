export default function PrivacidadPage() {
  return (
    <div className="text-zinc-300">
      <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-8 tracking-tight">Políticas de Privacidad</h1>
      
      <div className="space-y-8 leading-relaxed">
        <section>
          <p className="text-sm text-zinc-500 mb-6">Última actualización: Julio 2026</p>
          <p>
            En <strong>Uintegrus</strong>, respetamos su privacidad y nos comprometemos a proteger sus datos personales. Esta Política de Privacidad explica cómo recopilamos, utilizamos, compartimos y protegemos la información cuando utiliza nuestra plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">1. Información que Recopilamos</h2>
          <p className="mb-4">
            Recopilamos información que usted nos proporciona directamente al registrarse, incluyendo:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Nombres y apellidos.</li>
            <li>Dirección de correo electrónico y número de teléfono (WhatsApp).</li>
            <li>Datos de la empresa (RUC, Razón Social, Dirección).</li>
            <li>Información de pago (procesada de forma segura a través de nuestras pasarelas, nosotros no almacenamos los números completos de su tarjeta).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">2. Uso de la Información</h2>
          <p className="mb-4">Utilizamos sus datos personales y comerciales para:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Proveer, mantener y mejorar nuestro software.</li>
            <li>Procesar sus transacciones y enviar comprobantes (Facturación Electrónica).</li>
            <li>Brindar soporte técnico y responder a sus consultas.</li>
            <li>Enviarle notificaciones importantes sobre actualizaciones, seguridad y ofertas de la plataforma.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">3. Protección de Datos de sus Clientes</h2>
          <p className="mb-4">
            Como usuario de Uintegrus, usted procesará datos de sus propios clientes (compradores). Uintegrus actúa únicamente como "Encargado de Tratamiento" de estos datos. Usted es el responsable legal de contar con el consentimiento de sus clientes para procesar su información a través de nuestra plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">4. Seguridad y Almacenamiento</h2>
          <p className="mb-4">
            Mantenemos protocolos de seguridad de estándar industrial (encriptación SSL, bases de datos seguras) para proteger su información contra accesos no autorizados. Sin embargo, ningún sistema en internet es 100% infalible.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">5. Compartición de Información</h2>
          <p className="mb-4">
            No vendemos ni alquilamos su información personal a terceros. Solo compartiremos sus datos cuando sea estrictamente necesario con:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Autoridades fiscales (ej. SUNAT) para el procesamiento obligatorio de facturación electrónica.</li>
            <li>Proveedores de servicios en la nube esenciales para operar la plataforma (hosting, pasarelas de pago), bajo estrictos acuerdos de confidencialidad.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">6. Derechos ARCO</h2>
          <p>
            En cumplimiento con la Ley de Protección de Datos Personales, usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse (Derechos ARCO) al uso de sus datos. Para ejercer estos derechos, envíe un correo electrónico a soporte@uintegrus.com.
          </p>
        </section>
      </div>
    </div>
  )
}
