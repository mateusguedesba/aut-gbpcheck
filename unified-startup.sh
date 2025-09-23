#!/bin/bash

# Configurar senha VNC
echo "${VNC_PASSWORD}" | vncpasswd -f > ~/.vnc/passwd
chmod 600 ~/.vnc/passwd

# Aguardar um pouco para garantir que tudo está pronto
sleep 2

# Iniciar supervisor que gerencia todos os processos
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf