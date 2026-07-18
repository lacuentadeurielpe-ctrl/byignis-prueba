export default function ReembolsoPage() {
  return (
    <div className="text-zinc-300">
      <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-8 tracking-tight">Políticas de Reembolso</h1>
      
      <div className="space-y-8 leading-relaxed">
        <section>
          <p className="text-sm text-zinc-500 mb-6">Última actualización: Julio 2026</p>
          <p>
            Nuestra prioridad en <strong>Uintegrus</strong> es ofrecer un servicio de alta calidad que impulse su negocio. Sin embargo, establecemos las siguientes políticas respecto a devoluciones y reembolsos para brindar total transparencia en nuestras transacciones.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">1. Naturaleza del Servicio</h2>
          <p className="mb-4">
            Al ser Uintegrus un producto de software digital (SaaS) con acceso inmediato e infraestructura en la nube dedicada desde el momento de la activación, no ofrecemos devoluciones genéricas por "cambio de opinión" una vez que el acceso ha sido provisto.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">2. Casos Elegibles para Reembolso</h2>
          <p className="mb-4">Solo se procesarán reembolsos excepcionales bajo las siguientes condiciones:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Cargos duplicados o errores técnicos:</strong> Si nuestro sistema de facturación le ha cobrado dos veces por el mismo periodo por un error técnico atribuible a nuestra pasarela.</li>
            <li><strong>Falla crítica de infraestructura:</strong> Si el software resulta ser completamente inaccesible o disfuncional para su empresa durante los primeros 7 días posteriores a su compra, y nuestro equipo de soporte no logra brindarle una solución técnica en un plazo razonable (72 horas).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">3. Suscripciones y Cancelaciones</h2>
          <p className="mb-4">
            Usted puede cancelar su suscripción (los pagos recurrentes) en cualquier momento desde su panel de control o comunicándose a soporte@uintegrus.com. 
            <br/><br/>
            <strong>Tenga en cuenta:</strong> La cancelación evitará futuros cobros, pero no emitiremos reembolsos prorrateados por los días no utilizados dentro del mes en curso que ya haya sido pagado. Su cuenta permanecerá activa hasta que termine su ciclo de facturación.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4">4. Procedimiento de Solicitud</h2>
          <p className="mb-4">
            Para solicitar un reembolso por las causas mencionadas en el punto 2, debe escribir a <strong>soporte@uintegrus.com</strong> adjuntando:
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Recibo o constancia de pago.</li>
            <li>RUC o Razón Social registrada en el sistema.</li>
            <li>Explicación detallada y evidencia (capturas de pantalla) del problema técnico o doble cobro.</li>
          </ul>
          <p>
            Nuestro equipo evaluará su caso y emitirá una respuesta en un plazo máximo de 3 a 5 días hábiles. En caso de ser aprobado, el reembolso será devuelto a la misma tarjeta o medio de pago utilizado inicialmente, pudiendo demorar entre 5 a 15 días hábiles según la entidad bancaria.
          </p>
        </section>
      </div>
    </div>
  )
}
