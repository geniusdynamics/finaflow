@echo off
set PATH=%~dp0..\node_modules\.bin;C:\Program Files\OpenSSL-Win64\bin;%PATH%
set OPENSSL_CONF=C:\Program Files\OpenSSL-Win64\bin\cnf\openssl.cnf
set PORTLESS_TLD=test
portless %*
