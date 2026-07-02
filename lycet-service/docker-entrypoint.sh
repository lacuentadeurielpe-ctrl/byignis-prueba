#!/bin/sh
set -e

PORT=${PORT:-80}

# Actualizar el puerto en nginx config
sed -i "s/listen PORT;/listen $PORT;/" /etc/nginx/sites-available/lycet

# Arrancar php-fpm en segundo plano
php-fpm -D

# Arrancar nginx en primer plano (proceso principal del contenedor)
exec nginx -g 'daemon off;'
