#!/bin/sh
# Sustituye PORT en la config de Apache en tiempo de ejecución.
# Railway inyecta PORT como variable de entorno; sin esto Apache escucha en 80
# pero Railway espera el puerto dinámico asignado.

PORT=${PORT:-80}

sed -i "s/Listen 80/Listen $PORT/" /etc/apache2/ports.conf
sed -i "s/<VirtualHost \*:80>/<VirtualHost *:$PORT>/" /etc/apache2/sites-available/000-default.conf

# Precalentar caché de Symfony
php bin/console cache:warmup --env=prod --no-debug 2>/dev/null || true

exec "$@"
